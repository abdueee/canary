import { isNullValue } from "../values";
import type { NullRateConfig } from "../schemas";
import {
  countOf,
  findFailingRows,
  formatNumber,
  round2,
  skippedForMissingColumn,
  type CheckContext,
  type CheckOutcome,
} from "./shared";

// NULL_RATE: the share of empty values (empty, NULL or NA) in a column is at
// most maxPct percent.

export function evaluateNullRate(column: string, config: NullRateConfig, { table }: CheckContext): CheckOutcome {
  const index = table.columns.indexOf(column);
  if (index === -1) return skippedForMissingColumn(column);

  const { failingCount, sampleRows } = findFailingRows(table, index, isNullValue);
  const rowCount = table.rows.length;
  // Compared after rounding, so the check agrees with the percentage people see.
  const nullPct = rowCount === 0 ? 0 : round2((failingCount / rowCount) * 100);
  const passed = nullPct <= config.maxPct;

  const actual = { nullCount: failingCount, nullPct, rowCount };
  const expected = { maxPct: config.maxPct };
  const summary =
    `${formatNumber(nullPct)}% of "${column}" is empty (${formatNumber(failingCount)} of ${countOf(rowCount, "row")}); ` +
    `the limit is ${formatNumber(config.maxPct)}%.`;

  if (passed) {
    return { status: "PASSED", message: summary, actual, expected, failingCount: 0 };
  }
  return { status: "FAILED", message: summary, actual, expected, failingCount, sampleRows };
}
