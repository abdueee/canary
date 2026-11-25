import { isNullValue } from "../values";
import {
  countOf,
  describeValues,
  findFailingRows,
  mostCommon,
  skippedForMissingColumn,
  type CheckContext,
  type CheckOutcome,
} from "./shared";

// UNIQUE: no non-empty value appears more than once in a column. Values are
// compared exactly, after trimming spaces. Empty values are ignored.
// Every row that shares a repeated value counts as failing.

export function evaluateUnique(column: string, { table }: CheckContext): CheckOutcome {
  const index = table.columns.indexOf(column);
  if (index === -1) return skippedForMissingColumn(column);

  const counts = new Map<string, number>();
  for (const row of table.rows) {
    if (isNullValue(row[index])) continue;
    const value = row[index].trim();
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const duplicates = new Map([...counts].filter(([, count]) => count > 1));
  const { failingCount, sampleRows } = findFailingRows(
    table,
    index,
    (cell) => !isNullValue(cell) && duplicates.has(cell.trim()),
  );

  if (duplicates.size === 0) {
    return {
      status: "PASSED",
      message: `All ${countOf(counts.size, "value")} in "${column}" ${counts.size === 1 ? "is" : "are"} distinct.`,
      actual: { duplicateValues: [], duplicateDistinct: 0 },
      failingCount: 0,
    };
  }

  const duplicateValues = mostCommon(duplicates);
  return {
    status: "FAILED",
    message:
      `${countOf(duplicates.size, "value")} in "${column}" ${duplicates.size === 1 ? "appears" : "appear"} more than once ` +
      `(${countOf(failingCount, "row")}): ${describeValues(duplicateValues, duplicates.size)}.`,
    actual: { duplicateValues, duplicateDistinct: duplicates.size },
    failingCount,
    sampleRows,
  };
}
