import Link from "next/link";
import { DatasetForm } from "@/components/dataset-form";
import { requireRole } from "@/lib/authz";
import { createDataset } from "@/server/actions/datasets";

export default async function NewDatasetPage() {
  await requireRole("admin");

  return (
    <>
      <p>
        <Link href="/">Dashboard</Link> / New dataset
      </p>
      <h1>New dataset</h1>
      <DatasetForm action={createDataset} submitLabel="Create dataset" />
    </>
  );
}
