"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RunStatus } from "@/generated/prisma/enums";
import { FINISHED_RUN_STATUSES, type LiveResult, type RunSnapshot } from "@/lib/run-stream";

// Shows a run's results as they arrive over SSE, while the run is in progress.
// When the run finishes it refreshes the page, which then shows the full
// results with details. Barebones; styled in feature 9.
export function LiveRunResults({ runId, initialStatus }: { runId: string; initialStatus: RunStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus>(initialStatus);
  const [results, setResults] = useState<LiveResult[]>([]);

  useEffect(() => {
    const source = new EventSource(`/api/runs/${runId}/events`);
    const on = <T,>(name: string, handler: (data: T) => void) =>
      source.addEventListener(name, (event) => handler(JSON.parse((event as MessageEvent<string>).data) as T));
    const finish = () => {
      source.close();
      router.refresh();
    };

    // Sent first, and again whenever the browser reconnects.
    on<RunSnapshot>("snapshot", (snapshot) => {
      setStatus(snapshot.status);
      setResults(snapshot.results);
      if (FINISHED_RUN_STATUSES.includes(snapshot.status)) finish();
    });
    on<{ status: RunStatus }>("status", ({ status }) => setStatus(status));
    on<LiveResult>("result", (result) =>
      setResults((current) =>
        current.some((r) => r.checkId === result.checkId)
          ? current.map((r) => (r.checkId === result.checkId ? result : r))
          : [...current, result],
      ),
    );
    on<{ status: RunStatus }>("completed", ({ status }) => {
      setStatus(status);
      finish();
    });

    return () => source.close();
  }, [runId, router]);

  return (
    <section aria-live="polite">
      <p>Status: {status} (updating live)</p>
      {results.length === 0 ? (
        <p>{status === "QUEUED" ? "Waiting to start…" : "Reading the file…"}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Result</th>
              <th>Failing rows</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.checkId}>
                <td>
                  {result.checkType}
                  {result.column && ` (${result.column})`}
                </td>
                <td>{result.status}</td>
                <td>{result.message}</td>
                <td>{result.failingCount?.toLocaleString("en-CA") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
