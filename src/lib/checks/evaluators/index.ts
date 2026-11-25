import type { CheckDefinition } from "../schemas";
import { evaluateAllowedValues } from "./allowed-values";
import { evaluateNullRate } from "./null-rate";
import { evaluateNumericRange } from "./numeric-range";
import { evaluateRequiredColumns } from "./required-columns";
import { evaluateRowCount } from "./row-count";
import type { CheckContext, CheckOutcome } from "./shared";
import { evaluateUnique } from "./unique";

export type { CheckContext, CheckOutcome, HistoryEntry, Json, SampleRow } from "./shared";

/** Runs one (already validated) check against a file. */
export function evaluateCheck(check: CheckDefinition, context: CheckContext): CheckOutcome {
  switch (check.type) {
    case "REQUIRED_COLUMNS":
      return evaluateRequiredColumns(check.config, context);
    case "ROW_COUNT":
      return evaluateRowCount(check.config, context);
    case "NULL_RATE":
      return evaluateNullRate(check.column, check.config, context);
    case "ALLOWED_VALUES":
      return evaluateAllowedValues(check.column, check.config, context);
    case "NUMERIC_RANGE":
      return evaluateNumericRange(check.column, check.config, context);
    case "UNIQUE":
      return evaluateUnique(check.column, context);
  }
}
