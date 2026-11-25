import type { ResultStatus, RunStatus } from "@/generated/prisma/enums";

// Messages sent by GET /api/runs/[runId]/events, shared with the browser.
//
//   event: snapshot   data: RunSnapshot   (first message, and again on every reconnect)
//   event: status     data: { status }
//   event: result     data: LiveResult    (one per check, as it finishes)
//   event: completed  data: { status }    (last message; the stream then closes)

export type LiveResult = {
  checkId: string;
  checkType: string;
  column: string | null;
  status: ResultStatus;
  message: string;
  failingCount: number | null;
};

export type RunSnapshot = { status: RunStatus; results: LiveResult[] };

export const FINISHED_RUN_STATUSES: readonly RunStatus[] = ["PASSED", "FAILED", "ERROR"];
