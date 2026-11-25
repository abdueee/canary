import { describe, expect, it } from "vitest";
import { evaluateNumericRange } from "@/lib/checks/evaluators/numeric-range";
import { contextFor } from "./context";

const claims = contextFor(["id,amount", "1,10", "2,-5", "3,", "4,250.75", "5,abc", "6,1e2", "7,0"]);

describe("evaluateNumericRange", () => {
  it("fails values below, above, or not numbers", () => {
    const outcome = evaluateNumericRange("amount", { min: 0, max: 100 }, claims);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.failingCount).toBe(3);
    expect(outcome.actual).toEqual({ min: -5, max: 250.75, belowMin: 1, aboveMax: 1, notNumeric: 1 });
    expect(outcome.expected).toEqual({ min: 0, max: 100 });
    expect(outcome.message).toBe(
      '3 rows in "amount" are out of range (expected between 0 and 100): 1 below the minimum, 1 above the maximum, 1 not a number.',
    );
    expect(outcome.sampleRows?.map((row) => row.rowNumber)).toEqual([2, 4, 5]);
  });

  it("includes the bounds themselves", () => {
    const context = contextFor(["x", "0", "100"]);
    expect(evaluateNumericRange("x", { min: 0, max: 100 }, context).status).toBe("PASSED");
  });

  it("works with only a minimum or only a maximum", () => {
    const context = contextFor(["x", "5", "500"]);
    expect(evaluateNumericRange("x", { min: 0 }, context).status).toBe("PASSED");
    const outcome = evaluateNumericRange("x", { max: 100 }, context);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.message).toBe('1 row in "x" is out of range (expected at most 100): 1 above the maximum.');
  });

  it("ignores empty values", () => {
    const context = contextFor(["x", "1", "", "NA"]);
    const outcome = evaluateNumericRange("x", { min: 0 }, context);
    expect(outcome).toMatchObject({ status: "PASSED", failingCount: 0 });
    expect(outcome.message).toBe('Every value in "x" is at least 0.');
  });

  it("is skipped when the column is missing", () => {
    expect(evaluateNumericRange("price", { min: 0 }, claims).status).toBe("SKIPPED");
  });
});
