import type { Table } from "@/lib/csv";
import { inferType } from "./infer";
import type { ColumnProfile, Profile } from "./schemas";
import { isNullValue, parseDate, parseNumber } from "./values";

// Builds the per-column summary stored on each version (Context.md section 8).
// Trend charts, suggestions and some checks read from it.

/** distinctCount stops counting here; this value means "this many or more". */
export const DISTINCT_CAP = 10_000;
/** topValues is only included when a column has this many distinct values or fewer. */
export const TOP_VALUES_LIMIT = 20;

export function profileTable(table: Table): Profile {
  const rowCount = table.rows.length;
  return {
    rowCount,
    columns: table.columns.map((name, index) =>
      profileColumn(name, table.rows.map((row) => row[index]), rowCount),
    ),
  };
}

function profileColumn(name: string, rawValues: string[], rowCount: number): ColumnProfile {
  const values: string[] = [];
  let nullCount = 0;
  for (const raw of rawValues) {
    if (isNullValue(raw)) nullCount++;
    else values.push(raw.trim());
  }

  const inferredType = inferType(values);
  const counts = countValues(values);

  const column: ColumnProfile = {
    name,
    inferredType,
    nullCount,
    nullPct: percent(nullCount, rowCount),
    distinctCount: counts.size,
  };

  const range =
    inferredType === "integer" || inferredType === "number"
      ? numericRange(values)
      : inferredType === "date"
        ? dateRange(values)
        : null;
  if (range) {
    column.min = range.min;
    column.max = range.max;
  }

  if (counts.size <= TOP_VALUES_LIMIT) {
    column.topValues = [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }

  return column;
}

// Counts each distinct value. Once DISTINCT_CAP values have been seen, new ones
// are no longer added (keeps memory bounded for ID-like columns).
function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const count = counts.get(value);
    if (count !== undefined) counts.set(value, count + 1);
    else if (counts.size < DISTINCT_CAP) counts.set(value, 1);
  }
  return counts;
}

// Values that don't parse (the up-to-5% that inference tolerates) are ignored.
function numericRange(values: string[]) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    const parsed = parseNumber(value);
    if (parsed === null) continue;
    if (parsed < min) min = parsed;
    if (parsed > max) max = parsed;
  }
  return min === Infinity ? null : { min, max };
}

// Compared as points in time, reported as the original text.
function dateRange(values: string[]) {
  let min: { time: number; value: string } | null = null;
  let max: { time: number; value: string } | null = null;
  for (const value of values) {
    const time = parseDate(value);
    if (time === null) continue;
    if (!min || time < min.time) min = { time, value };
    if (!max || time > max.time) max = { time, value };
  }
  return min && max ? { min: min.value, max: max.value } : null;
}

function percent(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 100;
}
