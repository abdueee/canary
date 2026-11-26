import Link from "next/link";
import { z } from "zod";
import { FilterLinks } from "@/components/filter-links";
import { HealthBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatNumber, formatRelative } from "@/lib/format";
import { HEALTH_FILTERS, HEALTH_LABELS, type Health, healthFromRun } from "@/lib/health";

// Dashboard: one card per dataset, coloured by its derived health, plus a
// summary row. ?health=failing (etc.) filters the cards.
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const healthFilter = z.enum(HEALTH_FILTERS).catch("all").parse(params.health);

  const [user, rows] = await Promise.all([
    requireUser(),
    db.dataset.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        // Only the latest version and its latest run are needed for health.
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            versionNumber: true,
            rowCount: true,
            createdAt: true,
            runs: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                status: true,
                _count: { select: { results: { where: { status: "FAILED" } } } },
              },
            },
          },
        },
        _count: { select: { alerts: { where: { status: { not: "RESOLVED" } } } } },
      },
    }),
  ]);

  const datasets = rows.map((dataset) => {
    const latest = dataset.versions[0];
    const run = latest?.runs[0];
    return {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      health: healthFromRun(run?.status),
      versionNumber: latest?.versionNumber,
      rowCount: latest?.rowCount ?? null,
      lastUpload: latest?.createdAt,
      failedChecks: run?._count.results ?? 0,
      activeAlerts: dataset._count.alerts,
    };
  });

  const counts = Object.fromEntries(
    HEALTH_FILTERS.map((h) => [h, h === "all" ? datasets.length : datasets.filter((d) => d.health === h).length]),
  ) as Record<(typeof HEALTH_FILTERS)[number], number>;
  const visible = healthFilter === "all" ? datasets : datasets.filter((d) => d.health === healthFilter);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Health of each dataset, based on its latest upload.</p>
        </div>
        {user.role === "admin" && (
          <Link href="/datasets/new" className={buttonVariants()}>
            New dataset
          </Link>
        )}
      </div>

      {/* Summary: how many datasets there are, and how many of them are healthy or failing. */}
      {datasets.length > 0 && <HealthSummary counts={counts} />}

      <FilterLinks
        label="Show"
        param="health"
        pathname="/"
        searchParams={{}}
        current={healthFilter}
        defaultValue="all"
        options={HEALTH_FILTERS.filter((h) => h === "all" || counts[h] > 0 || h === healthFilter).map((h) => ({
          value: h,
          label: h === "all" ? "All" : HEALTH_LABELS[h as Health],
          count: counts[h],
        }))}
      />

      {datasets.length === 0 ? (
        <EmptyState isAdmin={user.role === "admin"} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No datasets match this filter.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((dataset) => (
            <li key={dataset.id}>
              <DatasetCard dataset={dataset} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type DashboardDataset = {
  id: string;
  name: string;
  description: string | null;
  health: Health;
  versionNumber?: number;
  rowCount: number | null;
  lastUpload?: Date;
  failedChecks: number;
  activeAlerts: number;
};

const HEALTH_BORDER: Record<Health, string> = {
  healthy: "border-l-emerald-500",
  failing: "border-l-red-500",
  checking: "border-l-sky-500",
  none: "border-l-border",
};

function DatasetCard({ dataset }: { dataset: DashboardDataset }) {
  return (
    <Link
      href={`/datasets/${dataset.id}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className={`h-full border-l-4 transition-colors hover:bg-muted/40 ${HEALTH_BORDER[dataset.health]}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="leading-snug">{dataset.name}</CardTitle>
            <HealthBadge health={dataset.health} />
          </div>
          {dataset.description && (
            <CardDescription className="line-clamp-2">{dataset.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {dataset.versionNumber === undefined ? (
            <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Latest version" value={`v${dataset.versionNumber}`} />
              <Stat label="Rows" value={dataset.rowCount === null ? "—" : formatNumber(dataset.rowCount)} />
              <Stat
                label="Failed checks"
                value={String(dataset.failedChecks)}
                emphasis={dataset.failedChecks > 0}
              />
              <Stat label="Last upload" value={dataset.lastUpload ? formatRelative(dataset.lastUpload) : "—"} />
            </dl>
          )}
          {dataset.activeAlerts > 0 && (
            <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
              {dataset.activeAlerts} active alert{dataset.activeAlerts > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium tabular-nums ${emphasis ? "text-red-700 dark:text-red-400" : ""}`}>{value}</dd>
    </div>
  );
}

type Counts = Record<(typeof HEALTH_FILTERS)[number], number>;

// Other states (still being checked, nothing uploaded) only show when they occur.
const OTHER_STATES: { key: Exclude<Health, "healthy" | "failing">; label: string }[] = [
  { key: "warning", label: "with warnings" },
  { key: "checking", label: "being checked" },
  { key: "none", label: "with no uploads yet" },
];

function HealthSummary({ counts }: { counts: Counts }) {
  const total = counts.all;
  const others = OTHER_STATES.filter((s) => counts[s.key] > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="h-full">
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Datasets</p>
          <p className="text-2xl font-semibold tabular-nums">{total}</p>
          <p className="text-sm text-muted-foreground">
            {counts.healthy} healthy · {counts.failing} failing
            {others.map((s) => ` · ${counts[s.key]} ${s.label}`).join("")}
          </p>
        </CardContent>
      </Card>
      <HealthTile
        href="/?health=healthy"
        label="Healthy"
        count={counts.healthy}
        total={total}
        tone="text-emerald-700 dark:text-emerald-400"
      />
      <HealthTile
        href="/?health=failing"
        label="Failing"
        count={counts.failing}
        total={total}
        tone="text-red-700 dark:text-red-400"
      />
    </div>
  );
}

// Clicking a tile filters the cards below to that state.
function HealthTile({
  href,
  label,
  count,
  total,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  total: number;
  tone: string;
}) {
  return (
    <Link href={href} className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="tabular-nums">
            <span className={`text-2xl font-semibold ${tone}`}>{count}</span>
            <span className="text-sm text-muted-foreground"> of {total}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <p className="font-medium">No datasets yet</p>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Create a dataset for each recurring CSV feed, then upload its first file."
            : "An admin needs to create a dataset before files can be uploaded."}
        </p>
        {isAdmin && (
          <Link href="/datasets/new" className={buttonVariants()}>
            New dataset
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
