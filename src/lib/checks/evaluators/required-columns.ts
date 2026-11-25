import type { InferredType, RequiredColumnsConfig } from "../schemas";
import type { CheckContext, CheckOutcome } from "./shared";

// REQUIRED_COLUMNS: every listed column is in the file and, when a type is
// given, still has that type. Columns that aren't listed are reported but
// don't fail the check.

/** A column of whole numbers still counts as a "number" column. */
function typeMatches(expected: InferredType, actual: InferredType): boolean {
  return expected === actual || (expected === "number" && actual === "integer");
}

export function evaluateRequiredColumns(config: RequiredColumnsConfig, { profile }: CheckContext): CheckOutcome {
  const columns = new Map(profile.columns.map((column) => [column.name, column]));
  const missing: string[] = [];
  const typeChanges: { column: string; expected: InferredType; actual: InferredType }[] = [];

  for (const { name, type } of config.columns) {
    const column = columns.get(name);
    if (!column) {
      missing.push(name);
      continue;
    }
    // A column with no values at all has no real type, so there's nothing to compare.
    const hasValues = column.nullCount < profile.rowCount;
    if (type && hasValues && !typeMatches(type, column.inferredType)) {
      typeChanges.push({ column: name, expected: type, actual: column.inferredType });
    }
  }

  const required = new Set(config.columns.map((column) => column.name));
  const unexpected = profile.columns.map((column) => column.name).filter((name) => !required.has(name));

  const actual = {
    columns: profile.columns.map((column) => ({ name: column.name, type: column.inferredType })),
    missing,
    typeChanges,
    unexpected,
  };
  const expected = { columns: config.columns.map((column) => ({ name: column.name, type: column.type ?? null })) };
  const newColumns = unexpected.length > 0 ? ` New columns: ${unexpected.join(", ")}.` : "";

  if (missing.length === 0 && typeChanges.length === 0) {
    return {
      status: "PASSED",
      message: `All ${config.columns.length} required columns are present.${newColumns}`,
      actual,
      expected,
    };
  }

  const problems = [
    ...(missing.length > 0 ? [`Missing ${missing.length === 1 ? "column" : "columns"}: ${missing.join(", ")}.`] : []),
    ...typeChanges.map((change) => `"${change.column}" is now ${change.actual}, expected ${change.expected}.`),
  ];
  return { status: "FAILED", message: `${problems.join(" ")}${newColumns}`, actual, expected };
}
