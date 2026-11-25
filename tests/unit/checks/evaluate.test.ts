import { describe, expect, it } from "vitest";
import { evaluateChecks, runStatusFor, type StoredCheck } from "@/lib/checks/evaluate";
import { contextFor } from "./context";

const claims = contextFor(["claim_id,status", "1,approved", "2,denied", "2,REOPENED"]);

const check = (id: string, type: StoredCheck["type"], column: string | null, config: unknown): StoredCheck => ({
  id,
  type,
  column,
  config,
});

describe("evaluateChecks", () => {
  it("returns one result per check, in order", () => {
    const results = evaluateChecks(
      [
        check("a", "REQUIRED_COLUMNS", null, { columns: [{ name: "claim_id" }] }),
        check("b", "UNIQUE", "claim_id", {}),
        check("c", "NULL_RATE", "region", { maxPct: 5 }),
      ],
      claims,
    );
    expect(results.map((r) => [r.checkId, r.status])).toEqual([
      ["a", "PASSED"],
      ["b", "FAILED"],
      ["c", "SKIPPED"],
    ]);
  });

  it("gives a check with invalid settings an ERROR result and keeps going", () => {
    const results = evaluateChecks(
      [check("bad", "NULL_RATE", "status", { maxPct: 150 }), check("ok", "UNIQUE", "status", {})],
      claims,
    );
    expect(results[0]).toMatchObject({ checkId: "bad", status: "ERROR" });
    expect(results[0].message).toContain("settings are invalid");
    expect(results[0].message).toContain("maxPct");
    expect(results[1]).toMatchObject({ checkId: "ok", status: "PASSED" });
  });

  it("treats a column check without a column as invalid", () => {
    const [result] = evaluateChecks([check("x", "UNIQUE", null, {})], claims);
    expect(result.status).toBe("ERROR");
  });

  it("returns no results when there are no checks", () => {
    expect(evaluateChecks([], claims)).toEqual([]);
  });
});

describe("runStatusFor", () => {
  it.each([
    [[], "PASSED"],
    [["PASSED", "SKIPPED"], "PASSED"],
    [["SKIPPED"], "PASSED"],
    [["PASSED", "FAILED"], "FAILED"],
    [["PASSED", "ERROR"], "ERROR"],
    [["ERROR", "FAILED"], "FAILED"],
  ] as const)("%j gives %s", (statuses, expected) => {
    expect(runStatusFor(statuses.map((status) => ({ status })))).toBe(expected);
  });
});
