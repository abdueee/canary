import "server-only";
import { Prisma, type RunStatus } from "@/generated/prisma/client";
import { CsvError } from "@/lib/csv";
import { db } from "@/lib/db";
import { notify } from "@/lib/events";
import { evaluateStoredCheck, runStatusFor, type CheckResultOutcome, type FinishedRunStatus } from "./evaluate";
import { profileVersion } from "./profile-version";
import { MAX_ROW_COUNT_LOOKBACK } from "./schemas";

// Runs a CheckRun from start to finish:
//   1. mark it RUNNING
//   2. download, parse and profile the file (profileVersion)
//   3. load the dataset's enabled checks and earlier row counts
//   4. evaluate every check
//   5. save the results, the run's status and, if it didn't pass, an alert
//
// Each step is announced over NOTIFY (lib/events.ts) for live updates.
//
// Runs happen inside the Next.js server process, started right after the
// upload responds (there is no separate worker). Running the same run again
// is safe: results are upserted, the alert is unique per run, and a finished
// run is left alone.

const FINISHED: ReadonlySet<RunStatus> = new Set(["PASSED", "FAILED", "ERROR"]);

/**
 * Runs checks for a run the caller doesn't wait on (after an upload, or when
 * the server starts). Any unexpected error ends the run as ERROR, so it never
 * stays QUEUED or RUNNING.
 */
export async function runInBackground(runId: string): Promise<void> {
  try {
    await executeRun(runId);
  } catch (error) {
    console.error(`Check run ${runId} failed`, error);
    await failRun(runId, "Something went wrong while running the checks.").catch((failError) => {
      console.error(`Could not mark run ${runId} as failed`, failError);
    });
  }
}

/**
 * Called once when the server starts (src/instrumentation.ts). A run still
 * QUEUED or RUNNING was cut off by the server stopping, so it is run again.
 */
export async function resumeUnfinishedRuns(): Promise<void> {
  const runs = await db.checkRun.findMany({
    where: { status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (runs.length === 0) return;

  console.log(`Resuming ${runs.length} unfinished check run(s).`);
  for (const run of runs) {
    await runInBackground(run.id);
  }
}

/**
 * Returns the run's final status. A file that can't be read ends the run as
 * ERROR. Any other error (Spaces or the database being unavailable) is thrown;
 * runInBackground turns that into an ERROR run.
 */
export async function executeRun(runId: string): Promise<RunStatus> {
  const run = await db.checkRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true, version: { select: { id: true, datasetId: true, versionNumber: true } } },
  });
  if (FINISHED.has(run.status)) return run.status;

  const { version } = run;
  await db.checkRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date(), finishedAt: null, error: null },
  });
  await notify("run_events", { type: "status", runId, status: "RUNNING" });
  await notify("app_events", { type: "run", runId, datasetId: version.datasetId, status: "RUNNING" });

  let parsed;
  try {
    parsed = await profileVersion(version.id);
  } catch (error) {
    if (error instanceof CsvError) {
      await failRun(runId, `The file couldn't be read: ${error.message}`);
      return "ERROR";
    }
    throw error;
  }

  const [checks, earlierVersions] = await Promise.all([
    db.check.findMany({
      where: { datasetId: version.datasetId, enabled: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, column: true, config: true },
    }),
    db.datasetVersion.findMany({
      where: { datasetId: version.datasetId, versionNumber: { lt: version.versionNumber }, rowCount: { not: null } },
      orderBy: { versionNumber: "desc" },
      take: MAX_ROW_COUNT_LOOKBACK,
      select: { versionNumber: true, rowCount: true },
    }),
  ]);

  const history = earlierVersions.flatMap(({ versionNumber, rowCount }) =>
    rowCount === null ? [] : [{ versionNumber, rowCount }],
  );
  // Each result is saved and announced as soon as it's ready, so the run page
  // can show results one by one.
  const context = { ...parsed, history };
  const results: CheckResultOutcome[] = [];
  for (const check of checks) {
    const result = evaluateStoredCheck(check, context);
    await db.checkResult.upsert({
      where: { runId_checkId: { runId, checkId: result.checkId } },
      create: { runId, checkId: result.checkId, ...resultData(result) },
      update: resultData(result),
    });
    await notify("run_events", { type: "result", runId, checkId: result.checkId });
    results.push(result);
  }

  const status = runStatusFor(results);
  const erroredChecks = results.filter((result) => result.status === "ERROR").length;

  await db.$transaction([
    // When a run is resumed, drop results for checks that have since been disabled or deleted.
    db.checkResult.deleteMany({ where: { runId, checkId: { notIn: results.map((result) => result.checkId) } } }),
    db.checkRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
        error: status === "ERROR" ? `${erroredChecks} of ${results.length} checks couldn't run.` : null,
      },
    }),
    ...(status === "PASSED" ? [] : [createAlert(runId, version.datasetId)]),
  ]);
  await announceFinished(runId, version.datasetId, status);

  return status;
}

/** Ends a run as ERROR (the run itself crashed) and opens an alert for it. */
export async function failRun(runId: string, message: string): Promise<void> {
  const { version } = await db.checkRun.findUniqueOrThrow({
    where: { id: runId },
    select: { version: { select: { datasetId: true } } },
  });
  await db.$transaction([
    db.checkRun.update({
      where: { id: runId },
      data: { status: "ERROR", error: message, finishedAt: new Date() },
    }),
    createAlert(runId, version.datasetId),
  ]);
  await announceFinished(runId, version.datasetId, "ERROR");
}

async function announceFinished(runId: string, datasetId: string, status: FinishedRunStatus) {
  await notify("run_events", { type: "completed", runId, status });
  await notify("app_events", { type: "run", runId, datasetId, status });
  if (status !== "PASSED") {
    await notify("app_events", { type: "alert", runId, datasetId });
  }
}

/** One alert per run; running this twice leaves the first one as it is. */
function createAlert(runId: string, datasetId: string) {
  return db.alert.upsert({ where: { runId }, create: { runId, datasetId }, update: {} });
}

function resultData(result: CheckResultOutcome) {
  return {
    status: result.status,
    message: result.message,
    actual: toJson(result.actual),
    expected: toJson(result.expected),
    failingCount: result.failingCount ?? null,
    sampleRows: toJson(result.sampleRows),
  };
}

/** Missing values are stored as SQL NULL. */
function toJson(value: unknown) {
  return value === undefined || value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}
