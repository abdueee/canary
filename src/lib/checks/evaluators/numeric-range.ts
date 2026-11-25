import { isNullValue, parseNumber } from "../values";
import type { NumericRangeConfig } from "../schemas";
import {
  countOf,
  describeRange,
  findFailingRows,
  formatNumber,
  skippedForMissingColumn,
  type CheckContext,
  type CheckOutcome,
} from "./shared";

// NUMERIC_RANGE: every non-empty value in a column is a number within min/max.
// A value that isn't a number at all also fails. Empty values are ignored.

export function evaluateNumericRange(
  column: string,
  config: NumericRangeConfig,
  { table }: CheckContext,
): CheckOutcome {
  const index = table.columns.indexOf(column);
  if (index === -1) return skippedForMissingColumn(column);

  const { min, max } = config;
  let belowMin = 0;
  let aboveMax = 0;
  let notNumeric = 0;
  let observedMin: number | null = null;
  let observedMax: number | null = null;

  const { failingCount, sampleRows } = findFailingRows(table, index, (cell) => {
    if (isNullValue(cell)) return false;
    const value = parseNumber(cell.trim());
    if (value === null) {
      notNumeric += 1;
      return true;
    }
    observedMin = observedMin === null ? value : Math.min(observedMin, value);
    observedMax = observedMax === null ? value : Math.max(observedMax, value);
    if (min !== undefined && value < min) {
      belowMin += 1;
      return true;
    }
    if (max !== undefined && value > max) {
      aboveMax += 1;
      return true;
    }
    return false;
  });

  const range = describeRange(min, max);
  const actual = { min: observedMin, max: observedMax, belowMin, aboveMax, notNumeric };
  const expected = { min: min ?? null, max: max ?? null };

  if (failingCount === 0) {
    return {
      status: "PASSED",
      message: `Every value in "${column}" is ${range}.`,
      actual,
      expected,
      failingCount: 0,
    };
  }

  const reasons = [
    ...(belowMin > 0 ? [`${formatNumber(belowMin)} below the minimum`] : []),
    ...(aboveMax > 0 ? [`${formatNumber(aboveMax)} above the maximum`] : []),
    ...(notNumeric > 0 ? [`${formatNumber(notNumeric)} not a number`] : []),
  ];
  return {
    status: "FAILED",
    message:
      `${countOf(failingCount, "row")} in "${column}" ${failingCount === 1 ? "is" : "are"} out of range ` +
      `(expected ${range}): ${reasons.join(", ")}.`,
    actual,
    expected,
    failingCount,
    sampleRows,
  };
}
