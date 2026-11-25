import { describe, expect, it } from "vitest";
import { evaluateRowCount } from "@/lib/checks/evaluators/row-count";
import { contextFor, historyOf } from "./context";

/** A file with `n` data rows. */
const rows = (n: number) => ["id", ...Array.from({ length: n }, (_, i) => String(i + 1))];

describe("evaluateRowCount (absolute)", () => {
  it.each([
    [{ min: 5, max: 15 }, 10, "PASSED"],
    [{ min: 10, max: 10 }, 10, "PASSED"],
    [{ min: 11 }, 10, "FAILED"],
    [{ max: 9 }, 10, "FAILED"],
    [{ min: 0 }, 0, "PASSED"],
  ] as const)("%j with %i rows is %s", (bounds, count, status) => {
    expect(evaluateRowCount({ mode: "absolute", ...bounds }, contextFor(rows(count))).status).toBe(status);
  });

  it("describes the range in the message", () => {
    const outcome = evaluateRowCount({ mode: "absolute", min: 1000, max: 5000 }, contextFor(rows(10)));
    expect(outcome.message).toBe("10 rows; expected between 1,000 and 5,000.");
    expect(outcome.actual).toEqual({ rowCount: 10 });
    expect(outcome.expected).toEqual({ mode: "absolute", min: 1000, max: 5000 });
  });
});

describe("evaluateRowCount (relative)", () => {
  const relative = { mode: "relative", tolerancePct: 20, lookback: 5 } as const;

  it("is skipped with fewer than 2 earlier versions", () => {
    expect(evaluateRowCount(relative, contextFor(rows(10))).status).toBe("SKIPPED");
    const outcome = evaluateRowCount(relative, contextFor(rows(10), historyOf(10)));
    expect(outcome.status).toBe("SKIPPED");
    expect(outcome.message).toContain("found 1");
  });

  it("passes within the tolerance of the average", () => {
    // Average 100, so 80 to 120 is allowed.
    expect(evaluateRowCount(relative, contextFor(rows(80), historyOf(90, 110))).status).toBe("PASSED");
    expect(evaluateRowCount(relative, contextFor(rows(120), historyOf(90, 110))).status).toBe("PASSED");
  });

  it("fails outside the tolerance", () => {
    const outcome = evaluateRowCount(relative, contextFor(rows(79), historyOf(90, 110)));
    expect(outcome.status).toBe("FAILED");
    expect(outcome.message).toBe("79 rows, 21% below the average of 100 over the last 2 versions (allowed: ±20%).");
    expect(outcome.actual).toEqual({ rowCount: 79, changePct: -21 });
    expect(outcome.expected).toEqual({
      mode: "relative",
      min: 80,
      max: 120,
      average: 100,
      tolerancePct: 20,
      versions: [2, 1],
    });
  });

  it("only averages the last `lookback` versions", () => {
    // The last 2 average 10; the older 1000s are ignored.
    const history = historyOf(10, 10, 1000, 1000);
    const outcome = evaluateRowCount({ ...relative, lookback: 2 }, contextFor(rows(10), history));
    expect(outcome.status).toBe("PASSED");
    expect(outcome.expected).toMatchObject({ average: 10, versions: [4, 3] });
  });

  it("handles earlier versions with no rows", () => {
    const outcome = evaluateRowCount(relative, contextFor(rows(0), historyOf(0, 0)));
    expect(outcome.status).toBe("PASSED");
    expect(outcome.actual).toEqual({ rowCount: 0, changePct: null });
    expect(evaluateRowCount(relative, contextFor(rows(1), historyOf(0, 0))).status).toBe("FAILED");
  });
});
