import { describe, expect, it } from "vitest";
import { evaluateNullRate } from "@/lib/checks/evaluators/null-rate";
import { MAX_SAMPLE_ROWS } from "@/lib/checks/evaluators/shared";
import { contextFor } from "./context";

// 2 of 8 amounts are empty (an empty cell and "NA"): 25%.
const claims = contextFor(["id,amount", "1,10", "2,", "3,30", "4,NA", "5,50", "6,60", "7,70", "8,80"]);

describe("evaluateNullRate", () => {
  it("passes at or under the limit", () => {
    const outcome = evaluateNullRate("amount", { maxPct: 25 }, claims);
    expect(outcome).toMatchObject({ status: "PASSED", failingCount: 0 });
    expect(outcome.actual).toEqual({ nullCount: 2, nullPct: 25, rowCount: 8 });
    expect(outcome.sampleRows).toBeUndefined();
  });

  it("fails over the limit and lists the empty rows", () => {
    const outcome = evaluateNullRate("amount", { maxPct: 10 }, claims);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.message).toBe('25% of "amount" is empty (2 of 8 rows); the limit is 10%.');
    expect(outcome.failingCount).toBe(2);
    expect(outcome.sampleRows).toEqual([
      { rowNumber: 2, values: ["2", ""] },
      { rowNumber: 4, values: ["4", "NA"] },
    ]);
    expect(outcome.expected).toEqual({ maxPct: 10 });
  });

  it("allows no empty values with a limit of 0", () => {
    expect(evaluateNullRate("id", { maxPct: 0 }, claims).status).toBe("PASSED");
    expect(evaluateNullRate("amount", { maxPct: 0 }, claims).status).toBe("FAILED");
  });

  it("counts spaces, null and NULL as empty", () => {
    const context = contextFor(["x", "  ", "null", "NULL", "1"]);
    expect(evaluateNullRate("x", { maxPct: 0 }, context).failingCount).toBe(3);
  });

  it("passes for a file with no rows", () => {
    expect(evaluateNullRate("x", { maxPct: 0 }, contextFor(["x"])).status).toBe("PASSED");
  });

  it("is skipped when the column is missing", () => {
    const outcome = evaluateNullRate("region", { maxPct: 5 }, claims);
    expect(outcome).toEqual({ status: "SKIPPED", message: 'Skipped because the file has no "region" column.' });
  });

  it("keeps at most 20 sample rows but counts them all", () => {
    const context = contextFor(["x", ...Array<string>(30).fill(",").map(() => "NA")]);
    const outcome = evaluateNullRate("x", { maxPct: 0 }, context);
    expect(outcome.failingCount).toBe(30);
    expect(outcome.sampleRows).toHaveLength(MAX_SAMPLE_ROWS);
  });
});
