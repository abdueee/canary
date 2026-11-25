import { ListChecks, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DatasetForm } from "@/components/dataset-form";
import { TrendCharts, type TrendPoint } from "@/components/datasets/trend-charts";
import { VersionsTable, type VersionRow } from "@/components/datasets/versions-table";
import { DeleteDatasetButton } from "@/components/delete-dataset-button";
import { PageHeader } from "@/components/page-header";
import { HealthBadge, RunStatusBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@/components/upload-dropzone";
import { requireUser } from "@/lib/authz";
import { profileSchema } from "@/lib/checks/schemas";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { healthFromRun } from "@/lib/health";
import { deleteDataset, updateDataset } from "@/server/actions/datasets";

// Dataset overview: summary tiles, upload, trends and the version history.
// Admins open the edit panel with ?edit=1 (a link, so it works without JS).
export default async function DatasetPage({ params, searchParams }: PageProps<"/datasets/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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
  const editing = isAdmin && query.edit === "1";
  const latestVersion = dataset.versions[0];
  const latestRun = latestVersion?.runs[0];
  const datasetHref = `/datasets/${dataset.id}`;
  const runHref = (runId: string) => `${datasetHref}/runs/${runId}`;

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

  const checkCount = dataset._count.checks;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/" }, { label: dataset.name }]}
        title={dataset.name}
        badge={<HealthBadge health={healthFromRun(latestRun?.status)} />}
        description={dataset.description}
        actions={
          isAdmin &&
          !editing && (
            <Link href={`${datasetHref}?edit=1`} scroll={false} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden />
              Edit dataset
            </Link>
          )
        }
      />

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit dataset</CardTitle>
            <CardDescription>Change the name or description shown on the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="max-w-2xl">
              <DatasetForm
                action={updateDataset.bind(null, dataset.id)}
                submitLabel="Save changes"
                defaultValues={{ name: dataset.name, description: dataset.description }}
                secondaryAction={
                  <Link href={datasetHref} scroll={false} className={buttonVariants({ variant: "ghost" })}>
                    Close
                  </Link>
                }
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Delete this dataset</p>
                <p className="text-sm text-muted-foreground">
                  Removes every version, run, check and alert. This can&apos;t be undone.
                </p>
              </div>
              <DeleteDatasetButton action={deleteDataset.bind(null, dataset.id)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Latest run</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            {latestRun ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">v{latestVersion.versionNumber}</span>
                  <RunStatusBadge status={latestRun.status} />
                </div>
                <Link href={runHref(latestRun.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  See results
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">No runs yet.</p>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Checks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            <span className="text-lg font-semibold">{checkCount} enabled</span>
            <Link
              href={`${datasetHref}/checks`}
              className={buttonVariants({ variant: checkCount === 0 && isAdmin ? "default" : "outline", size: "sm" })}
            >
              <ListChecks aria-hidden />
              {checkCount === 0 && isAdmin ? "Add checks" : "Manage checks"}
            </Link>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Versions</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{formatNumber(dataset.versions.length)}</span>
            <span className="text-muted-foreground" title={latestVersion ? formatDateTime(latestVersion.createdAt) : undefined}>
              {latestVersion ? `Last upload ${formatRelative(latestVersion.createdAt)}` : "Nothing uploaded yet"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload a new version</CardTitle>
          <CardDescription>
            The file is profiled and checked as soon as it&apos;s uploaded.
            {checkCount === 0 && " This dataset has no enabled checks yet, so every run will pass."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadDropzone datasetId={dataset.id} />
        </CardContent>
      </Card>

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
