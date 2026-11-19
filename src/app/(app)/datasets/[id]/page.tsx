import Link from "next/link";
import { notFound } from "next/navigation";
import { DatasetForm } from "@/components/dataset-form";
import { DeleteDatasetButton } from "@/components/delete-dataset-button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteDataset, updateDataset } from "@/server/actions/datasets";

// Dataset overview. Skeleton for now: the empty sections are filled in by later features.
export default async function DatasetPage({ params }: PageProps<"/datasets/[id]">) {
  const { id } = await params;
  const [user, dataset] = await Promise.all([
    requireUser(),
    db.dataset.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
        },
      },
    }),
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
        <UploadDropzone datasetId={dataset.id} />
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
        {dataset.versions.length === 0 ? (
          <p>No versions yet. Upload a CSV to create the first one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>File</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Run status</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {dataset.versions.map((version) => (
                <tr key={version.id}>
                  <td>v{version.versionNumber}</td>
                  <td>{version.fileName}</td>
                  <td>{formatBytes(version.sizeBytes)}</td>
                  <td>{version.createdAt.toLocaleString("en-CA")}</td>
                  <td>{version.runs[0]?.status ?? "—"}</td>
                  <td>
                    {/* Plain <a>: this is an API route that redirects to Spaces, not a page. */}
                    <a href={`/api/versions/${version.id}/download`}>Download</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
