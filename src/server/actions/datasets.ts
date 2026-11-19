"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { datasetPrefix, deletePrefix } from "@/lib/storage";

// Returned to the form so it can show validation errors next to each field.
export type DatasetFormState = {
  errors?: { name?: string[]; description?: string[] };
  message?: string;
};

const datasetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .transform((value) => value || null),
});

function parseDatasetForm(formData: FormData) {
  return datasetSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });
}

export async function createDataset(
  _prevState: DatasetFormState,
  formData: FormData,
): Promise<DatasetFormState> {
  const user = await requireRole("ADMIN");

  const parsed = parseDatasetForm(formData);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const dataset = await db.dataset.create({
    data: { ...parsed.data, createdById: user.id },
  });

  revalidatePath("/");
  redirect(`/datasets/${dataset.id}`);
}

export async function updateDataset(
  id: string,
  _prevState: DatasetFormState,
  formData: FormData,
): Promise<DatasetFormState> {
  await requireRole("ADMIN");

  const parsed = parseDatasetForm(formData);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { count } = await db.dataset.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) {
    return { message: "Dataset not found" };
  }

  revalidatePath("/");
  revalidatePath(`/datasets/${id}`);
  return { message: "Saved" };
}

export async function deleteDataset(id: string): Promise<void> {
  await requireRole("ADMIN");

  // Versions, checks, runs, results and alerts are removed by the schema's cascade deletes.
  const { count } = await db.dataset.deleteMany({ where: { id } });

  // Then remove its CSV files. Done after the database delete so no version is
  // ever left pointing at a missing file; a failure here only leaves stray files.
  if (count > 0) {
    await deletePrefix(datasetPrefix(id)).catch((error) => {
      console.error(`Failed to delete Spaces files for dataset ${id}`, error);
    });
  }

  revalidatePath("/");
  redirect("/");
}
