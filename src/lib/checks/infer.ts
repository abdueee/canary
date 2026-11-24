import type { InferredType } from "./schemas";
import { parseBoolean, parseDate, parseInteger, parseNumber } from "./values";

// Type inference (Context.md section 8): a column gets type T if at least 95% of
// its non-null values parse as T. Types are tried in this order, and the first
// one that qualifies wins; a column that fits none of them is a string.

const CANDIDATES: [InferredType, (value: string) => unknown][] = [
  ["integer", parseInteger],
  ["number", parseNumber],
  ["boolean", parseBoolean],
  ["date", parseDate],
];

/** `values` are a column's non-null values, already trimmed. */
export function inferType(values: string[]): InferredType {
  if (values.length === 0) return "string";

  for (const [type, parse] of CANDIDATES) {
    if (mostlyParses(values, parse)) return type;
  }
  return "string";
}

// True when at most 5% of values fail to parse. Integer maths (failures * 20 <= n)
// avoids floating-point rounding at the boundary, and the loop stops as soon as
// too many values have failed.
function mostlyParses(values: string[], parse: (value: string) => unknown) {
  let failures = 0;
  for (const value of values) {
    if (parse(value) === null) {
      failures++;
      if (failures * 20 > values.length) return false;
    }
  }
  return true;
}
