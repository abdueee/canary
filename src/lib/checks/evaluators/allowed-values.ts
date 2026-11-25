import { isNullValue } from "../values";
import type { AllowedValuesConfig } from "../schemas";
import {
  countOf,
  describeValues,
  findFailingRows,
  mostCommon,
  skippedForMissingColumn,
  type CheckContext,
  type CheckOutcome,
} from "./shared";

// ALLOWED_VALUES: every non-empty value in a column is one of a fixed list.
// Empty values are ignored here; NULL_RATE is the check for those.

export function evaluateAllowedValues(
  column: string,
  config: AllowedValuesConfig,
  { table }: CheckContext,
): CheckOutcome {
  const index = table.columns.indexOf(column);
  if (index === -1) return skippedForMissingColumn(column);

  const normalize = config.caseSensitive ? (value: string) => value : (value: string) => value.toLowerCase();
  const allowed = new Set(config.values.map(normalize));
  const unexpected = new Map<string, number>();

  const { failingCount, sampleRows } = findFailingRows(table, index, (cell) => {
    if (isNullValue(cell)) return false;
    const value = cell.trim();
    if (allowed.has(normalize(value))) return false;
    unexpected.set(value, (unexpected.get(value) ?? 0) + 1);
    return true;
  });

  const expected = { values: config.values, caseSensitive: config.caseSensitive };

  if (failingCount === 0) {
    return {
      status: "PASSED",
      message: `Every value in "${column}" is in the allowed list.`,
      actual: { unexpectedValues: [], unexpectedDistinct: 0 },
      expected,
      failingCount: 0,
    };
  }

  const unexpectedValues = mostCommon(unexpected);
  return {
    status: "FAILED",
    message:
      `${countOf(failingCount, "row")} in "${column}" ${failingCount === 1 ? "has a value" : "have values"} ` +
      `outside the allowed list: ${describeValues(unexpectedValues, unexpected.size)}.`,
    actual: { unexpectedValues, unexpectedDistinct: unexpected.size },
    expected,
    failingCount,
    sampleRows,
  };
}
