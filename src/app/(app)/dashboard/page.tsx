import Link from "next/link";
import { z } from "zod";
import { FilterLinks } from "@/components/filter-links";
import { HealthBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { HEALTH_FILTERS, HEALTH_LABELS, type Health, healthFromRun } from "@/lib/health";

// Dashboard: one small card per dataset showing only what matters at a glance
// (health, last upload, active alerts). ?health=failing (etc.) filters the cards.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const healthFilter = z.enum(HEALTH_FILTERS).catch("all").parse(params.health);

  const [user, rows] = await Promise.all([
    requireUser(),
    db.dataset.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        // Only the latest version and its latest run are needed for health.
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            createdAt: true,
            runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
          },
        },
        _count: { select: { alerts: { where: { status: { not: "RESOLVED" } } } } },
      },
    }),
  ]);

  const datasets = rows.map((dataset) => {
    const latest = dataset.versions[0];
    return {
      id: dataset.id,
      name: dataset.name,
      health: healthFromRun(latest?.runs[0]?.status),
      lastUpload: latest?.createdAt,
      activeAlerts: dataset._count.alerts,
    };
  });

  const counts = Object.fromEntries(
    HEALTH_FILTERS.map((h) => [h, h === "all" ? datasets.length : datasets.filter((d) => d.health === h).length]),
  ) as Record<(typeof HEALTH_FILTERS)[number], number>;
  const visible = healthFilter === "all" ? datasets : datasets.filter((d) => d.health === healthFilter);

  // A narrower, centered column with two cards per row, so a handful of
  // datasets fills the page instead of hugging the left edge.
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        {user.role === "admin" && (
          <Link href="/datasets/new" className={buttonVariants()}>
            New dataset
          </Link>
        )}
      </div>

      {datasets.length > 0 && (
        <FilterLinks
          label="Show"
          param="health"
          pathname="/dashboard"
          searchParams={{}}
          current={healthFilter}
          defaultValue="all"
          options={HEALTH_FILTERS.filter((h) => h === "all" || counts[h] > 0 || h === healthFilter).map((h) => ({
            value: h,
            label: h === "all" ? "All" : HEALTH_LABELS[h as Health],
            count: counts[h],
          }))}
        />
      )}

      {datasets.length === 0 ? (
        <EmptyState isAdmin={user.role === "admin"} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No datasets match this filter.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((dataset) => (
            <li key={dataset.id}>
              <DatasetCard dataset={dataset} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DashboardDataset = {
  id: string;
  name: string;
  health: Health;
  lastUpload?: Date;
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
      <Card
        className={`h-full min-h-36 border-l-4 transition-colors hover:bg-accent/60 ${HEALTH_BORDER[dataset.health]}`}
      >
        <CardContent className="flex flex-1 flex-col justify-between gap-6 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-semibold leading-snug">{dataset.name}</p>
            <HealthBadge health={dataset.health} />
          </div>
          <p className="text-sm text-muted-foreground">
            {dataset.lastUpload ? `Last upload ${formatRelative(dataset.lastUpload)}` : "No uploads yet"}
            {dataset.activeAlerts > 0 && (
              <span className="font-medium text-red-700 dark:text-red-400">
                {" · "}
                {dataset.activeAlerts} alert{dataset.activeAlerts > 1 ? "s" : ""}
              </span>
            )}
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
