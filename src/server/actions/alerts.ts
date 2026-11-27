"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { notify } from "@/lib/events";

export type AlertActionResult = { error?: string };

const alertIdSchema = z.string().min(1);

// Alert lifecycle: OPEN → ACKNOWLEDGED → RESOLVED (an OPEN alert can also be
// resolved directly). Admins only; the server checks the role on every call.
//
// Each update is a single conditional UPDATE ("... WHERE id = ? AND status IN
// (...)"), so the transition is atomic: if two admins click at the same moment,
// only one update matches and the other gets a clear message instead of
// overwriting who acknowledged/resolved it.

export async function acknowledgeAlert(alertId: string): Promise<AlertActionResult> {
  const admin = await requireRole("admin");
  const id = alertIdSchema.safeParse(alertId);
  if (!id.success) return { error: "Invalid alert." };

  const { count } = await db.alert.updateMany({
    where: { id: id.data, status: "OPEN" },
    data: { status: "ACKNOWLEDGED", acknowledgedById: admin.id, acknowledgedAt: new Date() },
  });
  if (count === 0) return { error: "This alert was already acknowledged or resolved." };

  revalidateAlertViews();
  await announceAlertChange(id.data);
  return {};
}

export async function resolveAlert(alertId: string): Promise<AlertActionResult> {
  const admin = await requireRole("admin");
  const id = alertIdSchema.safeParse(alertId);
  if (!id.success) return { error: "Invalid alert." };

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    // Resolving an OPEN alert also counts as acknowledging it.
    await tx.alert.updateMany({
      where: { id: id.data, status: "OPEN" },
      data: { acknowledgedById: admin.id, acknowledgedAt: now },
    });
    return tx.alert.updateMany({
      where: { id: id.data, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      data: { status: "RESOLVED", resolvedById: admin.id, resolvedAt: now },
    });
  });
  if (result.count === 0) return { error: "This alert was already resolved." };

  revalidateAlertViews();
  await announceAlertChange(id.data);
  return {};
}

// The alert count in the top bar is rendered by the (app) layout, so refresh
// the layout too, not just the alerts page.
function revalidateAlertViews() {
  revalidatePath("/", "layout");
}

// revalidatePath only refreshes the admin who clicked. This live event makes
// every other open tab refresh too (see LiveUpdates and lib/events.ts).
async function announceAlertChange(alertId: string) {
  const alert = await db.alert.findUnique({ where: { id: alertId }, select: { runId: true, datasetId: true } });
  if (alert) {
    await notify("app_events", { type: "alert", runId: alert.runId, datasetId: alert.datasetId });
  }
}
