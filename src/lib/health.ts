import type { AlertStatus, RunStatus } from "@/generated/prisma/client";

// Dataset health is never stored (see data-and-screens.md): it is derived from
// the status of the latest version's latest check run.
export type Health = "healthy" | "failing" | "checking" | "none";

export const HEALTH_FILTERS = ["all", "failing", "healthy", "checking", "none"] as const;
export type HealthFilter = (typeof HEALTH_FILTERS)[number];

export const HEALTH_LABELS: Record<Health, string> = {
  healthy: "Healthy",
  failing: "Failing",
  checking: "Checking",
  none: "No uploads",
};

/** `latestRunStatus` is undefined when the dataset has no versions (or no run yet). */
export function healthFromRun(latestRunStatus: RunStatus | undefined): Health {
  switch (latestRunStatus) {
    case "PASSED":
      return "healthy";
    case "FAILED":
    case "ERROR":
      return "failing";
    case "QUEUED":
    case "RUNNING":
      return "checking";
    default:
      return "none";
  }
}

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  PASSED: "Passed",
  FAILED: "Failed",
  ERROR: "Error",
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
};
