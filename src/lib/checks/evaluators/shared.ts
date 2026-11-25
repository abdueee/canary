import type { Table } from "@/lib/csv";
import type { Profile } from "../schemas";

// Types and helpers shared by the check evaluators.
//
// Evaluators are pure functions: they get the parsed file, its profile and the
// row counts of earlier versions, and return an outcome. They never touch the
// database or Spaces, which keeps them easy to unit test.

/** Anything that can be stored in a Json column. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** An earlier version of the same dataset that was read successfully. */
export type HistoryEntry = { versionNumber: number; rowCount: number };

export type CheckContext = {
  table: Table;
  profile: Profile;
  /** Earlier versions of the dataset, most recent first. */
  history: HistoryEntry[];
};

/**
 * One row that broke the rule. rowNumber is the 1-based data row (the header
 * is not counted), and values are the row's cells in the file's column order.
 */
export type SampleRow = { rowNumber: number; values: string[] };

export type CheckOutcome = {
  status: "PASSED" | "FAILED" | "SKIPPED";
  /** One sentence for people, e.g. "3 rows have values outside the allowed list". */
  message: string;
  actual?: Json;
  expected?: Json;
  /** How many rows broke the rule (row-level checks only). */
  failingCount?: number;
  /** Up to MAX_SAMPLE_ROWS rows that broke the rule. */
  sampleRows?: SampleRow[];
};

export const MAX_SAMPLE_ROWS = 20;

/** How many values to list in actual (e.g. unexpected values with counts). */
export const MAX_LISTED_VALUES = 20;

/** How many values to name in a message before saying "and N more". */
const MAX_VALUES_IN_MESSAGE = 5;

/**
 * Goes through one column and collects the rows whose cell fails the test.
 * The test gets the raw cell, so each check decides how to treat spaces and nulls.
 */
export function findFailingRows(
  table: Table,
  columnIndex: number,
  fails: (cell: string) => boolean,
): { failingCount: number; sampleRows: SampleRow[] } {
  let failingCount = 0;
  const sampleRows: SampleRow[] = [];

  table.rows.forEach((row, index) => {
    if (!fails(row[columnIndex])) return;
    failingCount += 1;
    if (sampleRows.length < MAX_SAMPLE_ROWS) {
      sampleRows.push({ rowNumber: index + 1, values: row });
    }
  });

  return { failingCount, sampleRows };
}

/** Column checks are skipped, not failed, when their column is missing. REQUIRED_COLUMNS reports that. */
export function skippedForMissingColumn(column: string): CheckOutcome {
  return { status: "SKIPPED", message: `Skipped because the file has no "${column}" column.` };
}

/** Counts values and returns the most common first (ties in alphabetical order), up to MAX_LISTED_VALUES. */
export function mostCommon(counts: Map<string, number>): { value: string; count: number }[] {
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, MAX_LISTED_VALUES);
}

/** '"Pending" (100), "REOPENED" (12) and 3 more' */
export function describeValues(values: { value: string; count: number }[], total: number): string {
  const shown = values.slice(0, MAX_VALUES_IN_MESSAGE).map((v) => `"${v.value}" (${formatNumber(v.count)})`);
  const remaining = total - shown.length;
  return remaining > 0 ? `${shown.join(", ")} and ${formatNumber(remaining)} more` : shown.join(", ");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-CA", { maximumFractionDigits: 2 });
}

/** "1 row", "3 rows" */
export function countOf(count: number, noun: string): string {
  return `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** "between 0 and 100", "at least 0", "at most 100" */
export function describeRange(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `between ${formatNumber(min)} and ${formatNumber(max)}`;
  if (min !== undefined) return `at least ${formatNumber(min)}`;
  if (max !== undefined) return `at most ${formatNumber(max)}`;
  return "any value";
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
