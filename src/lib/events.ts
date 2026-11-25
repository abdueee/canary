import "server-only";
import { Client } from "pg";
import type { RunStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Live updates over Postgres LISTEN/NOTIFY.
//
// notify() publishes a small event (IDs only: Postgres caps payloads at 8,000
// bytes). subscribe() receives them. Every subscriber in this server process
// shares one LISTEN connection, kept on globalThis so dev reloads don't open
// new ones. The SSE route handlers subscribe and forward events to browsers.

/** Progress of one run, for its run page. */
export type RunEvent =
  | { type: "status"; runId: string; status: RunStatus }
  | { type: "result"; runId: string; checkId: string }
  | { type: "completed"; runId: string; status: RunStatus };

/** Site-wide changes, for the top bar, dashboard and dataset pages. */
export type AppEvent =
  | { type: "run"; runId: string; datasetId: string; status: RunStatus }
  | { type: "alert"; runId: string; datasetId: string };

type Events = { run_events: RunEvent; app_events: AppEvent };
export type Channel = keyof Events;
const CHANNELS: Channel[] = ["run_events", "app_events"];

/**
 * Publishes an event. Never throws: live updates are a convenience, and
 * everything they announce is already saved in the database.
 */
export async function notify<C extends Channel>(channel: C, event: Events[C]): Promise<void> {
  try {
    await db.$executeRaw`SELECT pg_notify(${channel}, ${JSON.stringify(event)})`;
  } catch (error) {
    console.error(`Could not publish ${channel} event`, error);
  }
}

type Listener = (event: unknown) => void;
type Hub = {
  client: Client | null;
  connecting: Promise<void> | null;
  listeners: Map<Channel, Set<Listener>>;
};

const globalForEvents = globalThis as unknown as { canaryEvents?: Hub };
const hub: Hub = (globalForEvents.canaryEvents ??= {
  client: null,
  connecting: null,
  listeners: new Map(),
});

/**
 * Calls `listener` for every event on `channel` until the returned function
 * is called. Resolves once the LISTEN connection is ready, so events published
 * after that are never missed.
 */
export async function subscribe<C extends Channel>(
  channel: C,
  listener: (event: Events[C]) => void,
): Promise<() => void> {
  const listeners = hub.listeners.get(channel) ?? new Set<Listener>();
  hub.listeners.set(channel, listeners);
  const wrapped: Listener = (event) => listener(event as Events[C]);
  listeners.add(wrapped);

  try {
    await connect();
  } catch (error) {
    listeners.delete(wrapped);
    throw error;
  }
  return () => {
    listeners.delete(wrapped);
  };
}

function connect(): Promise<void> {
  if (hub.client) return Promise.resolve();
  hub.connecting ??= openConnection().finally(() => {
    hub.connecting = null;
  });
  return hub.connecting;
}

async function openConnection() {
  const client = new Client({ connectionString: env.DATABASE_URL });

  client.on("notification", ({ channel, payload }) => {
    const listeners = hub.listeners.get(channel as Channel);
    if (!listeners || !payload) return;
    let event: unknown;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Event listener failed", error);
      }
    }
  });
  client.on("error", (error) => {
    console.error("Lost the live updates connection to Postgres", error);
    reconnect(client);
  });
  client.on("end", () => reconnect(client));

  await client.connect();
  for (const channel of CHANNELS) {
    await client.query(`LISTEN ${channel}`);
  }
  hub.client = client;
}

/**
 * Drops a broken connection and opens a new one if anyone is still listening.
 * Events published while disconnected are missed, but browsers refetch the
 * current state whenever their stream reconnects.
 */
function reconnect(client: Client) {
  if (hub.client !== client) return;
  hub.client = null;
  client.end().catch(() => {});

  const anyoneListening = [...hub.listeners.values()].some((listeners) => listeners.size > 0);
  if (anyoneListening) {
    setTimeout(() => {
      connect().catch((error) => console.error("Could not reconnect live updates", error));
    }, 1000);
  }
}

/** Formats one Server-Sent Events message. */
export function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A comment line; keeps idle connections from being closed by proxies and browsers. */
export const SSE_HEARTBEAT = ": heartbeat\n\n";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  // no-transform also stops the server from compressing (and so buffering) the stream.
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
