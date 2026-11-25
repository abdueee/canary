import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireUser } from "@/lib/authz";
import { profileSchema, sampleRowsSchema } from "@/lib/checks/schemas";
import { db } from "@/lib/db";

// One run's results. Barebones: a results table with expandable details.
// Live updates (feature 8) and the styled drill-down (feature 9) come later.
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
  const inProgress = run.status === "QUEUED" || run.status === "RUNNING";
  const profile = profileSchema.safeParse(version.profile);
  const header = profile.success ? profile.data.columns.map((c) => c.name) : null;

  return (
    <>
      <p>
        <Link href="/">Dashboard</Link> /{" "}
        <Link href={`/datasets/${version.dataset.id}`}>{version.dataset.name}</Link> / Run for v
        {version.versionNumber}
      </p>
      <h1>
        Run for v{version.versionNumber}: {run.status}
      </h1>
      <p>
        File: {version.fileName} (<a href={`/api/versions/${version.id}/download`}>download</a>)
        {version.rowCount !== null && `, ${version.rowCount.toLocaleString("en-CA")} rows`}
      </p>
      <p>
        Started: {run.startedAt?.toLocaleString("en-CA") ?? "—"} · Finished:{" "}
        {run.finishedAt?.toLocaleString("en-CA") ?? "—"}
        {run.alert && ` · Alert: ${run.alert.status}`}
      </p>
      {run.error && <p role="alert">{run.error}</p>}

      {inProgress && (
        <>
          <p>Checking the file… this page refreshes on its own.</p>
          <AutoRefresh />
        </>
      )}

      {!inProgress && run.results.length === 0 && !run.error && (
        <p>
          No checks ran. <Link href={`/datasets/${version.dataset.id}/checks`}>Add checks</Link> and upload again.
        </p>
      )}

      {run.results.length > 0 && (
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
            {run.results.map((result) => {
              const samples = sampleRowsSchema.safeParse(result.sampleRows);
              const highlight = header && result.check.column ? header.indexOf(result.check.column) : -1;
              return (
                <tr key={result.id} className="align-top">
                  <td>
                    {result.check.type}
                    {result.check.column && ` (${result.check.column})`}
                  </td>
                  <td>{result.status}</td>
                  <td>
                    <p>{result.message}</p>
                    {(result.expected !== null || result.actual !== null || samples.success) && (
                      <details>
                        <summary>Details</summary>
                        <p>Expected:</p>
                        <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result.expected, null, 2)}</pre>
                        <p>Actual:</p>
                        <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result.actual, null, 2)}</pre>
                        {samples.success && samples.data.length > 0 && (
                          <>
                            <p>
                              Sample rows (first {samples.data.length}
                              {result.failingCount !== null && ` of ${result.failingCount.toLocaleString("en-CA")}`}):
                            </p>
                            <table className="text-sm">
                              <thead>
                                <tr>
                                  <th>Row</th>
                                  {(header ?? samples.data[0].values.map((_, i) => `Column ${i + 1}`)).map((name) => (
                                    <th key={name}>{name}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {samples.data.map((row) => (
                                  <tr key={row.rowNumber}>
                                    <td>{row.rowNumber}</td>
                                    {row.values.map((value, i) => (
                                      <td key={i}>{i === highlight ? <mark>{value || "(empty)"}</mark> : value}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}
                      </details>
                    )}
                  </td>
                  <td>{result.failingCount?.toLocaleString("en-CA") ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
