import { describe, expect, it } from "vitest";
import { checkDefinitionSchema } from "@/lib/checks/schemas";

const valid = (value: unknown) => checkDefinitionSchema.safeParse(value).success;

describe("checkDefinitionSchema", () => {
  it.each([
    { type: "REQUIRED_COLUMNS", column: null, config: { columns: [{ name: "id", type: "integer" }, { name: "x" }] } },
    { type: "ROW_COUNT", column: null, config: { mode: "absolute", min: 10 } },
    { type: "ROW_COUNT", column: null, config: { mode: "relative", tolerancePct: 20, lookback: 5 } },
    { type: "NULL_RATE", column: "amount", config: { maxPct: 0 } },
    { type: "ALLOWED_VALUES", column: "status", config: { values: ["a", "b"], caseSensitive: false } },
    { type: "NUMERIC_RANGE", column: "amount", config: { min: -1.5, max: 100 } },
    { type: "UNIQUE", column: "id", config: {} },
  ])("accepts $type $config", (definition) => {
    expect(valid(definition)).toBe(true);
  });

  it.each([
    ["no required columns", { type: "REQUIRED_COLUMNS", column: null, config: { columns: [] } }],
    [
      "a column listed twice",
      { type: "REQUIRED_COLUMNS", column: null, config: { columns: [{ name: "a" }, { name: "a" }] } },
    ],
    ["an unknown type", { type: "REQUIRED_COLUMNS", column: null, config: { columns: [{ name: "a", type: "text" }] } }],
    ["a row range with no bounds", { type: "ROW_COUNT", column: null, config: { mode: "absolute" } }],
    ["min above max", { type: "ROW_COUNT", column: null, config: { mode: "absolute", min: 10, max: 5 } }],
    ["a lookback of 1", { type: "ROW_COUNT", column: null, config: { mode: "relative", tolerancePct: 20, lookback: 1 } }],
    ["a percentage over 100", { type: "NULL_RATE", column: "a", config: { maxPct: 101 } }],
    ["an empty allowed list", { type: "ALLOWED_VALUES", column: "a", config: { values: [], caseSensitive: true } }],
    ["a numeric range with no bounds", { type: "NUMERIC_RANGE", column: "a", config: {} }],
    ["a column check with no column", { type: "UNIQUE", column: null, config: {} }],
    ["a column check with a blank column", { type: "NULL_RATE", column: "  ", config: { maxPct: 5 } }],
    ["a table check with a column", { type: "ROW_COUNT", column: "a", config: { mode: "absolute", min: 1 } }],
  ])("rejects %s", (_, definition) => {
    expect(valid(definition)).toBe(false);
  });

  it("trims column names and allowed values", () => {
    const parsed = checkDefinitionSchema.parse({
      type: "ALLOWED_VALUES",
      column: " status ",
      config: { values: [" a "], caseSensitive: true },
    });
    expect(parsed).toEqual({ type: "ALLOWED_VALUES", column: "status", config: { values: ["a"], caseSensitive: true } });
  });
});
