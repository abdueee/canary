import type { RowCountConfig } from "../schemas";
import { countOf, describeRange, formatNumber, round2, type CheckContext, type CheckOutcome } from "./shared";

// ROW_COUNT, in one of two modes:
//   absolute: the row count is within a fixed min/max.
//   relative: the row count is within tolerancePct of the average of the
//             previous `lookback` versions. Skipped until there are 2 of them.

export function evaluateRowCount(config: RowCountConfig, { profile, history }: CheckContext): CheckOutcome {
  const rowCount = profile.rowCount;

  if (config.mode === "absolute") {
    const { min, max } = config;
    const passed = (min === undefined || rowCount >= min) && (max === undefined || rowCount <= max);
    return {
      status: passed ? "PASSED" : "FAILED",
      message: `${countOf(rowCount, "row")}; expected ${describeRange(min, max)}.`,
      actual: { rowCount },
      expected: { mode: "absolute", min: min ?? null, max: max ?? null },
    };
  }

  const previous = history.slice(0, config.lookback);
  if (previous.length < 2) {
    return {
      status: "SKIPPED",
      message: `Skipped because comparing row counts needs at least 2 earlier versions (found ${previous.length}).`,
      actual: { rowCount },
    };
  }

  const average = previous.reduce((sum, version) => sum + version.rowCount, 0) / previous.length;
  const min = average * (1 - config.tolerancePct / 100);
  const max = average * (1 + config.tolerancePct / 100);
  const passed = rowCount >= min && rowCount <= max;
  const changePct = average === 0 ? null : round2(((rowCount - average) / average) * 100);

  const change =
    changePct === null || changePct === 0
      ? "the same as"
      : `${formatNumber(Math.abs(changePct))}% ${changePct > 0 ? "above" : "below"}`;

  return {
    status: passed ? "PASSED" : "FAILED",
    message:
      `${countOf(rowCount, "row")}, ${change} the average of ${formatNumber(round2(average))} ` +
      `over the last ${previous.length} versions (allowed: ±${formatNumber(config.tolerancePct)}%).`,
    actual: { rowCount, changePct },
    expected: {
      mode: "relative",
      min: round2(Math.max(min, 0)),
      max: round2(max),
      average: round2(average),
      tolerancePct: config.tolerancePct,
      versions: previous.map((version) => version.versionNumber),
    },
  };
}
