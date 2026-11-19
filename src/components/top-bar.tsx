import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";

// The bar at the top of every logged-in page. Functional only; styling, the
// phone menu and sign-out come with the UI pass and auth.
export async function TopBar() {
  const [user, openAlerts] = await Promise.all([
    requireUser(),
    db.alert.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <header className="border-b p-4">
      <nav className="flex flex-wrap items-center gap-4">
        <Link href="/">Canary</Link>
        <Link href="/">Dashboard</Link>
        <Link href="/alerts">Alerts ({openAlerts})</Link>
        {user.role === "ADMIN" && <Link href="/admin/users">Users</Link>}
        <span className="ml-auto">
          {user.name} ({user.role === "ADMIN" ? "Admin" : "Viewer"})
        </span>
      </nav>
    </header>
  );
}
