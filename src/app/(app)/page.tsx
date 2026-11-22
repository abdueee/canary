import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";

// Temporary dashboard: a plain list of datasets so they can be reached.
// Replaced by the real dashboard (health cards, summary counts) in feature 11.
export default async function DashboardPage() {
  const [user, datasets] = await Promise.all([
    requireUser(),
    db.dataset.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <h1>Datasets</h1>
      {user.role === "admin" && <Link href="/datasets/new">New dataset</Link>}

      {datasets.length === 0 ? (
        <p>No datasets yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {datasets.map((dataset) => (
            <li key={dataset.id}>
              <Link href={`/datasets/${dataset.id}`}>{dataset.name}</Link>
              {dataset.description && <p>{dataset.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
