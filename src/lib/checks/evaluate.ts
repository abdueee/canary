import { z } from "zod";
import type { CheckType, ResultStatus } from "@/generated/prisma/enums";
import { evaluateCheck, type CheckContext, type CheckOutcome } from "./evaluators";
import { checkDefinitionSchema } from "./schemas";

// The pure half of a check run: grade a file against a list of checks and
// decide the run's status. run.ts does the loading and saving around it.

/** A Check row as loaded from the database (config not yet validated). */
export type StoredCheck = { id: string; type: CheckType; column: string | null; config: unknown };

export type CheckResultOutcome = Omit<CheckOutcome, "status"> & { checkId: string; status: ResultStatus };

/**
 * Evaluates one check. A check whose settings are invalid, or that throws,
 * gets an ERROR result instead of throwing, so the other checks still run.
 */
export function evaluateStoredCheck(check: StoredCheck, context: CheckContext): CheckResultOutcome {
  const parsed = checkDefinitionSchema.safeParse({ type: check.type, column: check.column, config: check.config });
  if (!parsed.success) {
    return {
      checkId: check.id,
      status: "ERROR",
      message: `This check's settings are invalid, so it couldn't run. ${z.prettifyError(parsed.error)}`,
    };
  }

  try {
    return { checkId: check.id, ...evaluateCheck(parsed.data, context) };
  } catch (error) {
    return {
      checkId: check.id,
      status: "ERROR",
      message: `This check couldn't run: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Evaluates every check, in order. */
export function evaluateChecks(checks: StoredCheck[], context: CheckContext): CheckResultOutcome[] {
  return checks.map((check) => evaluateStoredCheck(check, context));
}

export type FinishedRunStatus = "PASSED" | "FAILED" | "ERROR";

/**
 * FAILED if any check failed. Otherwise ERROR if any check couldn't run, since
 * the file wasn't fully checked. Otherwise PASSED. Skipped checks don't count.
 */
export function runStatusFor(results: { status: ResultStatus }[]): FinishedRunStatus {
  if (results.some((result) => result.status === "FAILED")) return "FAILED";
  if (results.some((result) => result.status === "ERROR")) return "ERROR";
  return "PASSED";
}
