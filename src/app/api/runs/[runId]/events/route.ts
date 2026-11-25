import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { SSE_HEADERS, SSE_HEARTBEAT, sseMessage, subscribe, type RunEvent } from "@/lib/events";
import { FINISHED_RUN_STATUSES, type LiveResult, type RunSnapshot } from "@/lib/run-stream";

// Live progress of one run as Server-Sent Events (message types in lib/run-stream.ts).
//
// It subscribes first, then sends a snapshot of what's saved, then streams
// new events, so nothing that happens in between is missed. The browser may
// see a result twice (in the snapshot and as an event) and keeps the latest
// by checkId. The stream closes once the run finishes.

const HEARTBEAT_MS = 20_000;

export async function GET(request: Request, { params }: RouteContext<"/api/runs/[runId]/events">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { runId } = await params;
  const exists = await db.checkRun.findUnique({ where: { id: runId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        controller.close();
      };

      // Events are handled one at a time, in order, so "completed" can't
      // overtake a result that is still being loaded.
      let ready = false;
      const pending: RunEvent[] = [];
      let chain = Promise.resolve();
      const handle = (event: RunEvent) => {
        chain = chain.then(async () => {
          if (closed) return;
          if (event.type === "status") {
            write(sseMessage("status", { status: event.status }));
          } else if (event.type === "result") {
            const result = await loadResult(runId, event.checkId);
            if (result) write(sseMessage("result", result));
          } else {
            write(sseMessage("completed", { status: event.status }));
            close();
          }
        });
      };

      const unsubscribe = await subscribe("run_events", (event) => {
        if (event.runId !== runId) return;
        if (ready) handle(event);
        else pending.push(event);
      });
      const heartbeat = setInterval(() => write(SSE_HEARTBEAT), HEARTBEAT_MS);
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
      };
      request.signal.addEventListener("abort", close);
      if (request.signal.aborted) return close();

      const snapshot = await loadSnapshot(runId);
      if (!snapshot) return close();
      write(sseMessage("snapshot", snapshot));
      if (FINISHED_RUN_STATUSES.includes(snapshot.status)) return close();

      ready = true;
      pending.forEach(handle);
    },
    // The browser went away.
    cancel() {
      closed = true;
      cleanup();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

const resultSelect = {
  checkId: true,
  status: true,
  message: true,
  failingCount: true,
  check: { select: { type: true, column: true } },
} as const;

type ResultRow = {
  checkId: string;
  status: LiveResult["status"];
  message: string;
  failingCount: number | null;
  check: { type: string; column: string | null };
};

function toLiveResult({ check, ...result }: ResultRow): LiveResult {
  return { ...result, checkType: check.type, column: check.column };
}

async function loadSnapshot(runId: string): Promise<RunSnapshot | null> {
  const run = await db.checkRun.findUnique({
    where: { id: runId },
    select: { status: true, results: { select: resultSelect, orderBy: { check: { createdAt: "asc" } } } },
  });
  return run && { status: run.status, results: run.results.map(toLiveResult) };
}

async function loadResult(runId: string, checkId: string): Promise<LiveResult | null> {
  const result = await db.checkResult.findUnique({
    where: { runId_checkId: { runId, checkId } },
    select: resultSelect,
  });
  return result && toLiveResult(result);
}
