import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { AlertActions } from "@/components/alerts/alert-actions";
import { FilterLinks } from "@/components/filter-links";
import { AlertStatusBadge, RunStatusBadge } from "@/components/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AlertStatus, Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Alerts · Canary" };

// Filters live in the URL: /alerts?status=resolved&dataset=<id>
const STATUS_FILTERS = ["active", "open", "acknowledged", "resolved", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABELS: Record<StatusFilter, string> = {
  active: "Active",
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  all: "All",
};

const STATUS_WHERE: Record<StatusFilter, Prisma.AlertWhereInput> = {
  active: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  open: { status: "OPEN" },
  acknowledged: { status: "ACKNOWLEDGED" },
  resolved: { status: "RESOLVED" },
  all: {},
};

export default async function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const params = await searchParams;
  const status = z.enum(STATUS_FILTERS).catch("active").parse(params.status);
  const datasetId = typeof params.dataset === "string" ? params.dataset : undefined;

  const where: Prisma.AlertWhereInput = {
    ...STATUS_WHERE[status],
    ...(datasetId ? { datasetId } : {}),
  };

  const [user, alerts, datasets, statusCounts] = await Promise.all([
    requireUser(),
    db.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
        dataset: { select: { id: true, name: true } },
        acknowledgedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
        run: {
          select: {
            status: true,
            version: { select: { versionNumber: true, fileName: true } },
            _count: { select: { results: { where: { status: "FAILED" } } } },
          },
        },
      },
    }),
    db.dataset.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.alert.groupBy({
      by: ["status"],
      where: datasetId ? { datasetId } : {},
      _count: { _all: true },
    }),
  ]);

  const isAdmin = user.role === "admin";
  const countOf = (s: AlertStatus) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;
  const counts: Record<StatusFilter, number> = {
    open: countOf("OPEN"),
    acknowledged: countOf("ACKNOWLEDGED"),
    resolved: countOf("RESOLVED"),
    active: countOf("OPEN") + countOf("ACKNOWLEDGED"),
    all: countOf("OPEN") + countOf("ACKNOWLEDGED") + countOf("RESOLVED"),
  };
  const kept = { status: params.status as string | undefined, dataset: datasetId };

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          An alert is created when a run fails.
          {isAdmin ? " Acknowledge it while you investigate, then resolve it once the data is fixed." : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <FilterLinks
          label="Status"
          param="status"
          pathname="/alerts"
          searchParams={kept}
          current={status}
          defaultValue="active"
          options={STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_LABELS[s], count: counts[s] }))}
        />
        {datasets.length > 1 && (
          <FilterLinks
            label="Dataset"
            param="dataset"
            pathname="/alerts"
            searchParams={kept}
            current={datasetId ?? "all"}
            defaultValue="all"
            options={[{ value: "all", label: "All" }, ...datasets.map((d) => ({ value: d.id, label: d.name }))]}
          />
        )}
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {status === "active" ? "No active alerts. Everything looks good." : "No alerts match these filters."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* md and up: table */}
          <div className="hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Run</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">
                      <Link href={`/datasets/${alert.dataset.id}`} className="hover:underline">
                        {alert.dataset.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">v{alert.run.version.versionNumber}</span>
                      <span className="block max-w-56 truncate text-xs text-muted-foreground" title={alert.run.version.fileName}>
                        {alert.run.version.fileName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <RunStatusBadge status={alert.run.status} />
                        <FailedCount count={alert.run._count.results} />
                      </div>
                    </TableCell>
                    <TableCell title={formatDateTime(alert.createdAt)}>{formatRelative(alert.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <AlertStatusBadge status={alert.status} />
                        <WhoWhen alert={alert} />
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex justify-end">
                          <AlertActions alertId={alert.id} status={alert.status} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Below md: stacked cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/datasets/${alert.dataset.id}`} className="font-medium hover:underline">
                        {alert.dataset.name}
                      </Link>
                      <AlertStatusBadge status={alert.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      v{alert.run.version.versionNumber} · {formatRelative(alert.createdAt)}
                    </p>
                    <div className="flex items-center gap-2">
                      <RunStatusBadge status={alert.run.status} />
                      <FailedCount count={alert.run._count.results} />
                    </div>
                    <WhoWhen alert={alert} />
                    {isAdmin && <AlertActions alertId={alert.id} status={alert.status} />}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function FailedCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {count} failed check{count > 1 ? "s" : ""}
    </span>
  );
}

function WhoWhen({
  alert,
}: {
  alert: {
    status: AlertStatus;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    acknowledgedBy: { name: string } | null;
    resolvedBy: { name: string } | null;
  };
}) {
  if (alert.status === "RESOLVED" && alert.resolvedAt) {
    return (
      <span className="text-xs text-muted-foreground">
        by {alert.resolvedBy?.name ?? "a deleted user"}, {formatRelative(alert.resolvedAt)}
      </span>
    );
  }
  if (alert.status === "ACKNOWLEDGED" && alert.acknowledgedAt) {
    return (
      <span className="text-xs text-muted-foreground">
        by {alert.acknowledgedBy?.name ?? "a deleted user"}, {formatRelative(alert.acknowledgedAt)}
      </span>
    );
  }
  return null;
}
