import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckForm } from "@/components/check-form";
import { requireUser } from "@/lib/authz";
import { profileSchema } from "@/lib/checks/schemas";
import { db } from "@/lib/db";
import { createCheck, deleteCheck, setCheckEnabled } from "@/server/actions/checks";

// A dataset's checks. Barebones: admins add checks with JSON settings and can
// disable or delete them; viewers only see the list. Styled in feature 10.
export default async function ChecksPage({ params }: PageProps<"/datasets/[id]/checks">) {
  const { id } = await params;
  const [user, dataset, latest] = await Promise.all([
    requireUser(),
    db.dataset.findUnique({
      where: { id },
      select: { id: true, name: true, checks: { orderBy: { createdAt: "asc" } } },
    }),
    // The newest version that was read successfully, for column names.
    db.datasetVersion.findFirst({
      where: { datasetId: id, rowCount: { not: null } },
      orderBy: { versionNumber: "desc" },
      select: { profile: true },
    }),
  ]);

  if (!dataset) {
    notFound();
  }

  const isAdmin = user.role === "admin";
  const profile = profileSchema.safeParse(latest?.profile);
  const columns = profile.success ? profile.data.columns.map((c) => ({ name: c.name, type: c.inferredType })) : [];

  return (
    <>
      <p>
        <Link href="/">Dashboard</Link> / <Link href={`/datasets/${dataset.id}`}>{dataset.name}</Link> / Checks
      </p>
      <h1>Checks</h1>
      <p>Every enabled check runs on each new upload. Any failure fails the run.</p>

      <section>
        <h2>Current checks</h2>
        {dataset.checks.length === 0 ? (
          <p>No checks yet.{isAdmin && " Add one below."}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Column</th>
                <th>Settings</th>
                <th>Enabled</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {dataset.checks.map((check) => (
                <tr key={check.id}>
                  <td>{check.type}</td>
                  <td>{check.column ?? "(whole file)"}</td>
                  <td>
                    <code>{JSON.stringify(check.config)}</code>
                  </td>
                  <td>{check.enabled ? "Yes" : "No"}</td>
                  {isAdmin && (
                    <td className="flex gap-2">
                      <form action={setCheckEnabled.bind(null, dataset.id, check.id, !check.enabled)}>
                        <button type="submit" className="border px-2">
                          {check.enabled ? "Disable" : "Enable"}
                        </button>
                      </form>
                      <form action={deleteCheck.bind(null, dataset.id, check.id)}>
                        <button type="submit" className="border px-2">
                          Delete
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isAdmin && dataset.checks.length > 0 && (
          <p className="text-sm">Deleting a check also removes its results from past runs. Disable it to keep them.</p>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2>Add a check</h2>
          {columns.length === 0 && <p className="text-sm">Upload a version first to get column suggestions.</p>}
          <CheckForm action={createCheck.bind(null, dataset.id)} columns={columns} />
        </section>
      )}
    </>
  );
}
