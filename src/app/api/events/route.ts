import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { SSE_HEADERS, SSE_HEARTBEAT, sseMessage, subscribe } from "@/lib/events";

// Site-wide live updates as Server-Sent Events: a run started or finished, or
// an alert was created or changed. Every message is `event: app` with an
// AppEvent (lib/events.ts) as data. Signed-in pages use it to refresh.

const HEARTBEAT_MS = 20_000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

      const unsubscribe = await subscribe("app_events", (event) => write(sseMessage("app", event)));
      const heartbeat = setInterval(() => write(SSE_HEARTBEAT), HEARTBEAT_MS);
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
      };
      request.signal.addEventListener("abort", close);
      if (request.signal.aborted) return close();

      // Lets the browser know the stream is open.
      write(SSE_HEARTBEAT);
    },
    // The browser went away.
    cancel() {
      closed = true;
      cleanup();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
