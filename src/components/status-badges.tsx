import type { AlertStatus, ResultStatus, RunStatus } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  ALERT_STATUS_LABELS,
  HEALTH_LABELS,
  RUN_STATUS_LABELS,
  type Health,
  healthFromRun,
} from "@/lib/health";

// One colour language across the app: green = healthy/passed, amber = acknowledged,
// red = failing, blue = in progress, grey = nothing yet. Every badge also shows
// a word, so colour is never the only signal.
const TONE = {
  green: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blue: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  grey: "border-transparent bg-muted text-muted-foreground",
} as const;

const HEALTH_TONE: Record<Health, keyof typeof TONE> = {
  healthy: "green",
  failing: "red",
  checking: "blue",
  none: "grey",
};

export function HealthBadge({ health }: { health: Health }) {
  return <Badge className={TONE[HEALTH_TONE[health]]}>{HEALTH_LABELS[health]}</Badge>;
}

export function RunStatusBadge({ status }: { status: RunStatus | null | undefined }) {
  if (!status) return <Badge className={TONE.grey}>No run</Badge>;
  return (
    <Badge className={TONE[HEALTH_TONE[healthFromRun(status)]]}>{RUN_STATUS_LABELS[status]}</Badge>
  );
}

const ALERT_TONE: Record<AlertStatus, keyof typeof TONE> = {
  OPEN: "red",
  ACKNOWLEDGED: "amber",
  RESOLVED: "green",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <Badge className={TONE[ALERT_TONE[status]]}>{ALERT_STATUS_LABELS[status]}</Badge>;
}

// One check's result within a run.
const RESULT_TONE: Record<ResultStatus, keyof typeof TONE> = {
  PASSED: "green",
  FAILED: "red",
  SKIPPED: "grey",
  ERROR: "red",
};

const RESULT_LABELS: Record<ResultStatus, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  ERROR: "Error",
};

export function ResultStatusBadge({ status }: { status: ResultStatus }) {
  return <Badge className={TONE[RESULT_TONE[status]]}>{RESULT_LABELS[status]}</Badge>;
}

export function EnabledBadge({ enabled }: { enabled: boolean }) {
  return <Badge className={TONE[enabled ? "green" : "grey"]}>{enabled ? "Enabled" : "Disabled"}</Badge>;
}
