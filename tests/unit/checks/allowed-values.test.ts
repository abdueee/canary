import { describe, expect, it } from "vitest";
import { evaluateAllowedValues } from "@/lib/checks/evaluators/allowed-values";
import { contextFor } from "./context";

const claims = contextFor([
  "id,status",
  "1,approved",
  "2,Pending",
  "3,REOPENED",
  "4,",
  "5, denied ",
  "6,REOPENED",
]);
const allowed = ["approved", "pending", "denied"];

describe("evaluateAllowedValues", () => {
  it("ignores case unless caseSensitive is set", () => {
    const outcome = evaluateAllowedValues("status", { values: allowed, caseSensitive: false }, claims);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.failingCount).toBe(2); // only the REOPENED rows
  });

  it("lists unexpected values with counts, most common first", () => {
    const outcome = evaluateAllowedValues("status", { values: allowed, caseSensitive: true }, claims);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.failingCount).toBe(3);
    expect(outcome.actual).toEqual({
      unexpectedValues: [
        { value: "REOPENED", count: 2 },
        { value: "Pending", count: 1 },
      ],
      unexpectedDistinct: 2,
    });
    expect(outcome.message).toBe(
      '3 rows in "status" have values outside the allowed list: "REOPENED" (2), "Pending" (1).',
    );
    expect(outcome.sampleRows?.map((row) => row.rowNumber)).toEqual([2, 3, 6]);
  });

  it("ignores empty values and surrounding spaces", () => {
    const outcome = evaluateAllowedValues(
      "status",
      { values: [...allowed, "reopened"], caseSensitive: false },
      claims,
    );
    expect(outcome).toMatchObject({ status: "PASSED", failingCount: 0 });
  });

  it("says how many more values there are past the first 5", () => {
    const context = contextFor(["code", "a", "b", "c", "d", "e", "f", "g"]);
    const outcome = evaluateAllowedValues("code", { values: ["z"], caseSensitive: true }, context);
    expect(outcome.message).toContain('"e" (1) and 2 more.');
  });

  it("is skipped when the column is missing", () => {
    const outcome = evaluateAllowedValues("region", { values: allowed, caseSensitive: false }, claims);
    expect(outcome.status).toBe("SKIPPED");
  });
});
