// Runs once when the Next.js server starts.
export async function register() {
  // Only in the Node.js server, and not while `next build` prerenders pages.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  // Check runs happen inside this server process, so any run left QUEUED or
  // RUNNING was cut off when the server last stopped. Run them again.
  // Not awaited: the server starts taking requests while they finish.
  const { resumeUnfinishedRuns } = await import("@/lib/checks/run");
  resumeUnfinishedRuns().catch((error) => {
    console.error("Could not resume unfinished check runs", error);
  });
}
