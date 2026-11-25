"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { checkDefinitionSchema, COLUMN_CHECK_TYPES } from "@/lib/checks/schemas";
import { db } from "@/lib/db";

// Admin actions for a dataset's checks. Barebones for now: settings are entered
// as JSON. Feature 10 replaces that with a form per check type, plus updateCheck
// and acceptSuggestions.

export type CheckFormState = { error?: string; message?: string };

const isColumnCheck = (type: string) => (COLUMN_CHECK_TYPES as readonly string[]).includes(type);

export async function createCheck(
  datasetId: string,
  _prevState: CheckFormState,
  formData: FormData,
): Promise<CheckFormState> {
  await requireRole("admin");

  const type = String(formData.get("type") ?? "");
  const column = String(formData.get("column") ?? "").trim();

  let config: unknown;
  try {
    config = JSON.parse(String(formData.get("config") ?? ""));
  } catch {
    return { error: "Settings must be valid JSON." };
  }

  const parsed = checkDefinitionSchema.safeParse({
    type,
    // Whole-file checks have no column, whatever was typed in the field.
    column: isColumnCheck(type) ? column : null,
    config,
  });
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error) };
  }

  const dataset = await db.dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
  if (!dataset) {
    return { error: "Dataset not found." };
  }

  await db.check.create({ data: { datasetId, ...parsed.data } });

  revalidatePath(`/datasets/${datasetId}/checks`);
  return { message: "Check added." };
}

export async function setCheckEnabled(datasetId: string, checkId: string, enabled: boolean): Promise<void> {
  await requireRole("admin");
  await db.check.updateMany({ where: { id: checkId, datasetId }, data: { enabled } });
  revalidatePath(`/datasets/${datasetId}/checks`);
}

export async function deleteCheck(datasetId: string, checkId: string): Promise<void> {
  await requireRole("admin");
  // Also deletes this check's results from past runs (cascade).
  await db.check.deleteMany({ where: { id: checkId, datasetId } });
  revalidatePath(`/datasets/${datasetId}/checks`);
}
