"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { RunStatusBadge } from "@/components/status-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RunStatus } from "@/generated/prisma/client";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";

// One row per uploaded version. Dates are ISO strings because this is a
// Client Component (props must be serializable).
export type VersionRow = {
  id: string;
  versionNumber: number;
  fileName: string;
  sizeBytes: number;
  rowCount: number | null;
  uploadedAt: string;
  uploadedBy: string;
  runStatus: RunStatus | null;
  runHref: string | null;
};

// Features and columns live at module scope so they are stable across renders
// (TanStack Table v9 rebuilds its row models when these change).
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const column = createColumnHelper<typeof features, VersionRow>();

const columns = column.columns([
  column.accessor("versionNumber", {
    header: "Version",
    cell: (info) => <span className="font-medium tabular-nums">v{info.getValue()}</span>,
  }),
  column.accessor("fileName", {
    header: "File",
    sortFn: "alphanumeric",
    cell: (info) => (
      <span className="block max-w-64 truncate" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  column.accessor("rowCount", {
    header: "Rows",
    sortUndefined: "last",
    cell: (info) => {
      const value = info.getValue();
      return <span className="tabular-nums">{value === null ? "—" : formatNumber(value)}</span>;
    },
  }),
  column.accessor("sizeBytes", {
    header: "Size",
    cell: (info) => <span className="tabular-nums">{formatBytes(info.getValue())}</span>,
  }),
  column.accessor("uploadedAt", {
    header: "Uploaded",
    cell: (info) => (
      <span>
        {formatDateTime(info.getValue())}
        <span className="block text-xs text-muted-foreground">by {info.row.original.uploadedBy}</span>
      </span>
    ),
  }),
  column.accessor("runStatus", {
    header: "Run",
    enableSorting: false,
    cell: (info) => <RunStatusLink status={info.getValue()} href={info.row.original.runHref} />,
  }),
  column.display({
    id: "download",
    header: () => <span className="sr-only">Download</span>,
    cell: (info) => <DownloadLink versionId={info.row.original.id} />,
  }),
]);

export function VersionsTable({ versions }: { versions: VersionRow[] }) {
  const table = useTable({
    features,
    columns,
    data: versions,
    initialState: { sorting: [{ id: "versionNumber", desc: true }] },
    enableSortingRemoval: false,
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      {/* md and up: sortable table */}
      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown aria-hidden />
                          ) : (
                            <ArrowUpDown aria-hidden className="opacity-40" />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Below md: stacked cards, same (sorted) rows */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map(({ original: version }) => (
          <li key={version.id}>
            <Card>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">v{version.versionNumber}</span>
                  <RunStatusLink status={version.runStatus} href={version.runHref} />
                </div>
                <p className="truncate" title={version.fileName}>
                  {version.fileName}
                </p>
                <p className="text-muted-foreground">
                  {version.rowCount === null ? "Not profiled yet" : `${formatNumber(version.rowCount)} rows`} ·{" "}
                  {formatBytes(version.sizeBytes)}
                </p>
                <p className="text-muted-foreground">
                  {formatDateTime(version.uploadedAt)} by {version.uploadedBy}
                </p>
                <DownloadLink versionId={version.id} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

// Links the status badge to the run's results page when the version has a run.
function RunStatusLink({ status, href }: { status: RunStatus | null; href: string | null }) {
  const badge = <RunStatusBadge status={status} />;
  return href ? (
    <Link href={href} title="See run results">
      {badge}
    </Link>
  ) : (
    badge
  );
}

function DownloadLink({ versionId }: { versionId: string }) {
  // A plain <a>, not <Link>: this API route redirects to a signed Spaces URL.
  return (
    <a href={`/api/versions/${versionId}/download`} className={buttonVariants({ variant: "outline", size: "sm" })}>
      Download
    </a>
  );
}
