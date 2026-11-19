import Link from "next/link";
import { notFound } from "next/navigation";
import { DatasetForm } from "@/components/dataset-form";
import { DeleteDatasetButton } from "@/components/delete-dataset-button";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteDataset, updateDataset } from "@/server/actions/datasets";

// Dataset overview. Skeleton for now: the empty sections are filled in by later features.
export default async function DatasetPage({ params }: PageProps<"/datasets/[id]">) {
  const { id } = await params;
  const [user, dataset] = await Promise.all([
    requireUser(),
    db.dataset.findUnique({ where: { id } }),
  ]);

  if (!dataset) {
    notFound();
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <p>
        <Link href="/">Dashboard</Link> / {dataset.name}
      </p>
      <h1>{dataset.name}</h1>
      {dataset.description && <p>{dataset.description}</p>}

      {isAdmin && (
        <details>
          <summary>Edit dataset</summary>
          <DatasetForm
            action={updateDataset.bind(null, dataset.id)}
            submitLabel="Save changes"
            defaultValues={{ name: dataset.name, description: dataset.description }}
          />
          <DeleteDatasetButton action={deleteDataset.bind(null, dataset.id)} />
        </details>
      )}

      <section>
        <h2>Upload a new version</h2>
        <p>Coming with feature 4.</p>
      </section>

      <section>
        <h2>Latest run</h2>
        <p>Coming with feature 6.</p>
      </section>

      <section>
        <h2>Trends</h2>
        <p>Coming with feature 11.</p>
      </section>

      <section>
        <h2>Versions</h2>
        <p>Coming with feature 4.</p>
      </section>
    </>
  );
}
