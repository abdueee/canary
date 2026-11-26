"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResultStatusBadge, RunStatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkTypeLabel } from "@/lib/check-labels";
import type { RunStatus } from "@/generated/prisma/enums";
import { FINISHED_RUN_STATUSES, type LiveResult, type RunSnapshot } from "@/lib/run-stream";

// Shows a run's results as they arrive over SSE, while the run is in progress.
// When the run finishes it refreshes the page, which then shows the full
// results with details.
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
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Checking… <RunStatusBadge status={status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">{status === "QUEUED" ? "Waiting to start…" : "Reading the file…"}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {results.map((result) => (
              <li key={result.checkId} className="flex flex-col gap-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ResultStatusBadge status={result.status} />
                  <span className="font-medium">{checkTypeLabel(result.checkType)}</span>
                  {result.column && <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{result.column}</code>}
                </div>
                <p className="text-sm">{result.message}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
