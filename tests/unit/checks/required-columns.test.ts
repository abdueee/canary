import { describe, expect, it } from "vitest";
import { evaluateRequiredColumns } from "@/lib/checks/evaluators/required-columns";
import { contextFor } from "./context";

const claims = contextFor(["claim_id,amount,status", "1,10.5,approved", "2,20,pending"]);

describe("evaluateRequiredColumns", () => {
  it("passes when every column is present with its type", () => {
    const outcome = evaluateRequiredColumns(
      { columns: [{ name: "claim_id", type: "integer" }, { name: "amount", type: "number" }, { name: "status" }] },
      claims,
    );
    expect(outcome.status).toBe("PASSED");
    expect(outcome.message).toBe("All 3 required columns are present.");
    expect(outcome.actual).toMatchObject({ missing: [], typeChanges: [], unexpected: [] });
  });

  it("fails and names missing columns", () => {
    const outcome = evaluateRequiredColumns({ columns: [{ name: "claim_id" }, { name: "region" }] }, claims);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.message).toContain("Missing column: region.");
    expect(outcome.actual).toMatchObject({ missing: ["region"] });
  });

  it("fails when a column's type changed", () => {
    const outcome = evaluateRequiredColumns({ columns: [{ name: "status", type: "integer" }] }, claims);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.message).toContain('"status" is now string, expected integer.');
    expect(outcome.actual).toMatchObject({
      typeChanges: [{ column: "status", expected: "integer", actual: "string" }],
    });
  });

  it("accepts a whole-number column where a number column is expected", () => {
    const outcome = evaluateRequiredColumns(
      { columns: [{ name: "claim_id", type: "number" }] },
      claims,
    );
    expect(outcome.status).toBe("PASSED");
  });

  it("does not accept decimals where integers are expected", () => {
    const outcome = evaluateRequiredColumns({ columns: [{ name: "amount", type: "integer" }] }, claims);
    expect(outcome.status).toBe("FAILED");
  });

  it("reports new columns without failing", () => {
    const outcome = evaluateRequiredColumns({ columns: [{ name: "claim_id" }] }, claims);
    expect(outcome.status).toBe("PASSED");
    expect(outcome.message).toContain("New columns: amount, status.");
    expect(outcome.actual).toMatchObject({ unexpected: ["amount", "status"] });
  });

  it("doesn't compare types for a column with no values", () => {
    const empty = contextFor(["claim_id,amount", "1,", "2,"]);
    const outcome = evaluateRequiredColumns({ columns: [{ name: "amount", type: "number" }] }, empty);
    expect(outcome.status).toBe("PASSED");
  });

  it("matches column names exactly", () => {
    const outcome = evaluateRequiredColumns({ columns: [{ name: "Claim_ID" }] }, claims);
    expect(outcome.status).toBe("FAILED");
  });

  it("records what was expected", () => {
    const outcome = evaluateRequiredColumns({ columns: [{ name: "claim_id", type: "integer" }, { name: "x" }] }, claims);
    expect(outcome.expected).toEqual({
      columns: [
        { name: "claim_id", type: "integer" },
        { name: "x", type: null },
      ],
    });
  });
});
