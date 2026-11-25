import { checkDefinitionSchema, type CheckDefinition } from "@/lib/checks/schemas";
import { formatNumber } from "@/lib/format";

// Display text for checks: names, short descriptions, and a plain-English
// summary of a check's settings. Presentation only; the rules themselves live
// in lib/checks.

export const CHECK_TYPES = [
  "REQUIRED_COLUMNS",
  "ROW_COUNT",
  "NULL_RATE",
  "ALLOWED_VALUES",
  "NUMERIC_RANGE",
  "UNIQUE",
] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

export const CHECK_TYPE_INFO: Record<CheckType, { label: string; description: string; scope: "file" | "column" }> = {
  REQUIRED_COLUMNS: {
    label: "Required columns",
    description: "Listed columns must exist and keep their type.",
    scope: "file",
  },
  ROW_COUNT: {
    label: "Row count",
    description: "The number of rows stays in a range or close to recent versions.",
    scope: "file",
  },
  NULL_RATE: {
    label: "Missing values",
    description: "A column can't have more than a set share of empty cells.",
    scope: "column",
  },
  ALLOWED_VALUES: {
    label: "Allowed values",
    description: "Every value in a column is from a fixed list.",
    scope: "column",
  },
  NUMERIC_RANGE: {
    label: "Number range",
    description: "Numbers in a column stay between a minimum and maximum.",
    scope: "column",
  },
  UNIQUE: {
    label: "Unique values",
    description: "No value appears twice in a column, e.g. an ID.",
    scope: "column",
  },
};

export function checkTypeLabel(type: string): string {
  return (CHECK_TYPE_INFO as Record<string, { label: string }>)[type]?.label ?? type;
}

function describeRange(min: number | undefined, max: number | undefined, unit = "") {
  const f = (n: number) => `${formatNumber(n)}${unit}`;
  if (min !== undefined && max !== undefined) return `between ${f(min)} and ${f(max)}`;
  if (min !== undefined) return `at least ${f(min)}`;
  if (max !== undefined) return `at most ${f(max)}`;
  return "any value";
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function list(items: string[], max = 5) {
  const shown = items.slice(0, max).join(", ");
  return items.length > max ? `${shown} and ${items.length - max} more` : shown;
}

/** One-line summary of a check definition, e.g. "At most 5% empty". */
export function describeDefinition(definition: CheckDefinition): string {
  switch (definition.type) {
    case "REQUIRED_COLUMNS": {
      const cols = definition.config.columns.map((c) => (c.type ? `${c.name} (${c.type})` : c.name));
      return `${definition.config.columns.length} required: ${list(cols)}`;
    }
    case "ROW_COUNT": {
      const c = definition.config;
      if (c.mode === "relative") {
        return `Within ±${formatNumber(c.tolerancePct)}% of the average of the last ${c.lookback} versions`;
      }
      return `${capitalise(describeRange(c.min, c.max))} rows`;
    }
    case "NULL_RATE":
      return `At most ${formatNumber(definition.config.maxPct)}% empty`;
    case "ALLOWED_VALUES":
      return `One of ${list(definition.config.values, 8)}${definition.config.caseSensitive ? " (exact case)" : " (any case)"}`;
    case "NUMERIC_RANGE":
      return capitalise(describeRange(definition.config.min, definition.config.max));
    case "UNIQUE":
      return "No duplicate values";
  }
}

/** Summary of a stored check; falls back to the raw JSON if it doesn't parse. */
export function describeCheck(check: { type: string; column: string | null; config: unknown }): string {
  const parsed = checkDefinitionSchema.safeParse(check);
  return parsed.success ? describeDefinition(parsed.data) : JSON.stringify(check.config);
}
