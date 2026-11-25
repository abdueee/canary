"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunStatus } from "@/generated/prisma/client";
import { formatNumber } from "@/lib/format";

// One point per profiled version, oldest first. Built on the server from each
// version's rowCount and profile JSON.
export type TrendPoint = {
  label: string; // "v1"
  rowCount: number;
  runStatus: RunStatus | null;
  /** nullPct per column name (0–100). A column missing from a version is absent. */
  nullPct: Record<string, number>;
};

const BAR_COLOUR: Record<"ok" | "warn" | "bad" | "other", string> = {
  ok: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
  other: "#94a3b8",
};

const LINE_COLOURS = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2"];

function barColour(status: RunStatus | null) {
  if (status === "PASSED") return BAR_COLOUR.ok;
  if (status === "WARNING") return BAR_COLOUR.warn;
  if (status === "FAILED" || status === "ERROR") return BAR_COLOUR.bad;
  return BAR_COLOUR.other;
}

export function TrendCharts({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Trends appear here once uploaded files have been profiled.
        </CardContent>
      </Card>
    );
  }

  // Only chart columns that had missing values in at least one version; the
  // rest are flat at 0% and would just add noise. Largest peaks first, max 6.
  const nullColumns = [...new Set(points.flatMap((p) => Object.keys(p.nullPct)))]
    .map((name) => ({ name, peak: Math.max(...points.map((p) => p.nullPct[name] ?? 0)) }))
    .filter((c) => c.peak > 0)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, LINE_COLOURS.length)
    .map((c) => c.name);

  const nullData = points.map((p) => ({
    label: p.label,
    ...Object.fromEntries(nullColumns.map((name) => [name, p.nullPct[name] ?? null])),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Row count</CardTitle>
          <CardDescription>Rows in each version, coloured by its run result.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <Tooltip formatter={(v) => [formatNumber(Number(v)), "Rows"]} cursor={{ fillOpacity: 0.1 }} />
                <Bar dataKey="rowCount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {points.map((p) => (
                    <Cell key={p.label} fill={barColour(p.runStatus)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missing values</CardTitle>
          <CardDescription>Percentage of empty or null cells per column.</CardDescription>
        </CardHeader>
        <CardContent>
          {nullColumns.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No missing values in any version.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={nullData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis width={44} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip formatter={(v, name) => [`${v}%`, String(name)]} />
                  <Legend />
                  {nullColumns.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={LINE_COLOURS[i]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
