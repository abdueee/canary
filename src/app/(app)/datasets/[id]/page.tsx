import Link from "next/link";
import { notFound } from "next/navigation";
import { DatasetForm } from "@/components/dataset-form";
import { TrendCharts, type TrendPoint } from "@/components/datasets/trend-charts";
import { VersionsTable, type VersionRow } from "@/components/datasets/versions-table";
import { DeleteDatasetButton } from "@/components/delete-dataset-button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { requireUser } from "@/lib/authz";
import { profileSchema } from "@/lib/checks/schemas";
import { db } from "@/lib/db";
import { deleteDataset, updateDataset } from "@/server/actions/datasets";

// Dataset overview. Skeleton for now: the empty sections are filled in by later features.
export default async function DatasetPage({ params }: PageProps<"/datasets/[id]">) {
  const { id } = await params;
  const [user, dataset] = await Promise.all([
    requireUser(),
    db.dataset.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            runs: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
            uploadedBy: { select: { name: true } },
          },
        },
        _count: { select: { checks: { where: { enabled: true } } } },
      },
    }),
  ]);

  if (!dataset) {
    notFound();
  }

  const isAdmin = user.role === "admin";
  const latestVersion = dataset.versions[0];
  const latestRun = latestVersion?.runs[0];
  const runHref = (runId: string) => `/datasets/${dataset.id}/runs/${runId}`;

  // Versions table rows (newest first; the table re-sorts on click).
  const versionRows: VersionRow[] = dataset.versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    fileName: version.fileName,
    sizeBytes: version.sizeBytes,
    rowCount: version.rowCount,
    uploadedAt: version.createdAt.toISOString(),
    uploadedBy: version.uploadedBy.name,
    runStatus: version.runs[0]?.status ?? null,
    runHref: version.runs[0] ? runHref(version.runs[0].id) : null,
  }));

  // Trend points: profiled versions only, oldest first. The profile JSON is
  // validated with the shared schema; anything that doesn't parse is skipped.
  const trendPoints: TrendPoint[] = [...dataset.versions].reverse().flatMap((version) => {
    const profile = profileSchema.safeParse(version.profile);
    if (!profile.success) return [];
    return [
      {
        label: `v${version.versionNumber}`,
        rowCount: profile.data.rowCount,
        runStatus: version.runs[0]?.status ?? null,
        nullPct: Object.fromEntries(profile.data.columns.map((c) => [c.name, c.nullPct])),
      },
    ];
  });

  return (
    <>
      <p>
        <Link href="/">Dashboard</Link> / {dataset.name}
      </p>
      <h1>{dataset.name}</h1>
      {dataset.description && <p>{dataset.description}</p>}

      {isAdmin && (
        <details>
          <summary>Edit dataset</summary>
          <DatasetForm
            action={updateDataset.bind(null, dataset.id)}
            submitLabel="Save changes"
            defaultValues={{ name: dataset.name, description: dataset.description }}
          />
          <DeleteDatasetButton action={deleteDataset.bind(null, dataset.id)} />
        </details>
      )}

      <section>
        <h2>Upload a new version</h2>
        <UploadDropzone datasetId={dataset.id} />
      </section>

      <section>
        <h2>Checks</h2>
        <p>
          {dataset._count.checks} enabled. <Link href={`/datasets/${dataset.id}/checks`}>View checks</Link>
        </p>
      </section>

      <section>
        <h2>Latest run</h2>
        {latestRun ? (
          <p>
            v{latestVersion.versionNumber}: {latestRun.status} (<Link href={runHref(latestRun.id)}>see results</Link>)
          </p>
        ) : (
          <p>No runs yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Trends</h2>
        <TrendCharts points={trendPoints} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Versions</h2>
        {versionRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet. Upload a CSV to create the first one.</p>
        ) : (
          <VersionsTable versions={versionRows} />
        )}
      </section>
    </>
  );
}
