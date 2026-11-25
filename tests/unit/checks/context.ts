import type { CheckContext, HistoryEntry } from "@/lib/checks/evaluators";
import { profileTable } from "@/lib/checks/profile";
import { parseCsv } from "@/lib/csv";

/** Builds what an evaluator receives from CSV lines, exactly as a real run would. */
export function contextFor(lines: string[], history: HistoryEntry[] = []): CheckContext {
  const table = parseCsv(lines.join("\n"));
  return { table, profile: profileTable(table), history };
}

/** History with the given row counts, most recent first (versions numbered downwards). */
export function historyOf(...rowCounts: number[]): HistoryEntry[] {
  return rowCounts.map((rowCount, i) => ({ versionNumber: rowCounts.length - i, rowCount }));
}
