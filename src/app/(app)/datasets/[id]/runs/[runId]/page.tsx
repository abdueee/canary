import { ChevronRight, Download, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRunResults } from "@/components/live-run-results";
import { PageHeader } from "@/components/page-header";
import { AlertStatusBadge, ResultStatusBadge, RunStatusBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/authz";
import { checkTypeLabel } from "@/lib/check-labels";
import { profileSchema, sampleRowsSchema } from "@/lib/checks/schemas";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";

// One run's results. While the run is in progress, results stream in live
// (LiveRunResults); once it's finished, the full list with details is shown.
export default async function RunPage({ params }: PageProps<"/datasets/[id]/runs/[runId]">) {
  const { id, runId } = await params;
  const [, run] = await Promise.all([
    requireUser(),
    db.checkRun.findFirst({
      where: { id: runId, version: { datasetId: id } },
      include: {
        version: {
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            rowCount: true,
            profile: true,
            dataset: { select: { id: true, name: true } },
          },
        },
        results: {
          orderBy: { check: { createdAt: "asc" } },
          include: { check: { select: { type: true, column: true } } },
        },
        alert: { select: { status: true } },
      },
    }),
  ]);

  if (!run) {
    notFound();
  }

  const { version } = run;
  const datasetHref = `/datasets/${version.dataset.id}`;
  const inProgress = run.status === "QUEUED" || run.status === "RUNNING";
  const profile = profileSchema.safeParse(version.profile);
  const header = profile.success ? profile.data.columns.map((c) => c.name) : null;

  const tally = (["FAILED", "ERROR", "PASSED", "SKIPPED"] as const)
    .map((status) => ({ status, count: run.results.filter((r) => r.status === status).length }))
    .filter((t) => t.count > 0);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: "/" },
          { label: version.dataset.name, href: datasetHref },
          { label: `Run for v${version.versionNumber}` },
        ]}
        title={`Run for v${version.versionNumber}`}
        badge={<RunStatusBadge status={run.status} />}
        actions={
          <a href={`/api/versions/${version.id}/download`} className={buttonVariants({ variant: "outline" })}>
            <Download aria-hidden />
            Download CSV
          </a>
        }
      />

      <Card size="sm">
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-muted-foreground">File</dt>
              <dd className="truncate font-medium" title={version.fileName}>
                {version.fileName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rows</dt>
              <dd className="font-medium tabular-nums">
                {version.rowCount !== null ? formatNumber(version.rowCount) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Started · Finished</dt>
              <dd className="font-medium">
                {run.startedAt ? formatDateTime(run.startedAt) : "—"}
                {run.finishedAt && run.startedAt && run.finishedAt.getTime() !== run.startedAt.getTime() && (
                  <> · {formatDateTime(run.finishedAt)}</>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Alert</dt>
              <dd>
                {run.alert ? (
                  <Link href={`/alerts?dataset=${version.dataset.id}&status=all`} className="inline-flex">
                    <AlertStatusBadge status={run.alert.status} />
                  </Link>
                ) : (
                  <span className="font-medium">None</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {run.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {run.error}
        </p>
      )}

      {inProgress && <LiveRunResults runId={run.id} initialStatus={run.status} />}

      {!inProgress && run.results.length === 0 && !run.error && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground">
              No checks ran, so this version passed automatically. Add checks, then upload the next version.
            </p>
            <Link href={`${datasetHref}/checks`} className={buttonVariants()}>
              <ListChecks aria-hidden />
              Add checks
            </Link>
          </CardContent>
        </Card>
      )}

      {!inProgress && run.results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Check results</CardTitle>
            <CardDescription>
              {tally.map((t) => `${t.count} ${t.status.toLowerCase()}`).join(" · ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {run.results.map((result) => {
                const samples = sampleRowsSchema.safeParse(result.sampleRows);
                const highlight = header && result.check.column ? header.indexOf(result.check.column) : -1;
                const hasDetails = result.expected !== null || result.actual !== null || samples.success;
                return (
                  <li key={result.id} className="flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ResultStatusBadge status={result.status} />
                        <span className="font-medium">{checkTypeLabel(result.check.type)}</span>
                        {result.check.column && (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{result.check.column}</code>
                        )}
                      </div>
                      {result.failingCount !== null && result.failingCount > 0 && (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatNumber(result.failingCount)} failing row{result.failingCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{result.message}</p>

                    {hasDetails && (
                      <details className="group">
                        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 -ml-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
                          Details
                        </summary>
                        <div className="mt-2 flex flex-col gap-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <JsonBlock label="Expected" value={result.expected} />
                            <JsonBlock label="Actual" value={result.actual} />
                          </div>
                          {samples.success && samples.data.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <p className="text-sm font-medium">
                                Sample rows (first {samples.data.length}
                                {result.failingCount !== null && ` of ${formatNumber(result.failingCount)}`})
                              </p>
                              <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50 text-left">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Row</th>
                                      {(header ?? samples.data[0].values.map((_, i) => `Column ${i + 1}`)).map((name, i) => (
                                        <th
                                          key={name}
                                          className={`px-3 py-2 font-medium whitespace-nowrap ${i === highlight ? "bg-amber-100 dark:bg-amber-950" : ""}`}
                                        >
                                          {name}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {samples.data.map((row) => (
                                      <tr key={row.rowNumber} className="hover:bg-muted/40">
                                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{row.rowNumber}</td>
                                        {row.values.map((value, i) => (
                                          <td
                                            key={i}
                                            className={`px-3 py-1.5 whitespace-nowrap ${i === highlight ? "bg-amber-50 font-medium dark:bg-amber-950/50" : ""}`}
                                          >
                                            {i === highlight && !value ? (
                                              <span className="text-muted-foreground italic">(empty)</span>
                                            ) : (
                                              value
                                            )}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
