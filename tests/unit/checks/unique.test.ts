import { describe, expect, it } from "vitest";
import { evaluateUnique } from "@/lib/checks/evaluators/unique";
import { contextFor } from "./context";

describe("evaluateUnique", () => {
  it("passes when every value is distinct", () => {
    const outcome = evaluateUnique("id", contextFor(["id", "A1", "A2", "A3"]));
    expect(outcome).toMatchObject({ status: "PASSED", failingCount: 0 });
    expect(outcome.message).toBe('All 3 values in "id" are distinct.');
  });

  it("fails and counts every row that shares a repeated value", () => {
    const context = contextFor(["id", "A1", "A2", "A1", "A3", "A2", "A1"]);
    const outcome = evaluateUnique("id", context);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.failingCount).toBe(5);
    expect(outcome.actual).toEqual({
      duplicateValues: [
        { value: "A1", count: 3 },
        { value: "A2", count: 2 },
      ],
      duplicateDistinct: 2,
    });
    expect(outcome.message).toBe('2 values in "id" appear more than once (5 rows): "A1" (3), "A2" (2).');
    expect(outcome.sampleRows?.map((row) => row.rowNumber)).toEqual([1, 2, 3, 5, 6]);
  });

  it("ignores empty values", () => {
    expect(evaluateUnique("id", contextFor(["id", "A1", "", "NA", ""])).status).toBe("PASSED");
  });

  it("treats values that differ only by surrounding spaces as the same", () => {
    expect(evaluateUnique("id", contextFor(["id", "A1", " A1 "])).status).toBe("FAILED");
  });

  it("is case-sensitive", () => {
    expect(evaluateUnique("id", contextFor(["id", "a1", "A1"])).status).toBe("PASSED");
  });

  it("is skipped when the column is missing", () => {
    expect(evaluateUnique("claim_id", contextFor(["id", "1"])).status).toBe("SKIPPED");
  });
});
