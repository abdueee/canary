import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { DEFAULT_ROLE, isRole } from "@/lib/roles";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Users · Canary" };

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-zinc-600">
          Admins can create datasets, manage checks and resolve alerts. Viewers can
          view everything and upload files. There must always be at least one admin.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading users...</p>}>
        <UsersTable />
      </Suspense>
    </div>
  );
}

async function UsersTable() {
  const me = await requireRole("admin"); // viewers are redirected to the dashboard

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <>
      {/* Wide screens: a table */}
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  {user.name}
                  {user.id === me.id && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                </td>
                <td className="px-4 py-2 text-zinc-600">{user.email}</td>
                <td className="px-4 py-2 text-zinc-600">{user.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <RoleForm userId={user.id} role={isRole(user.role) ? user.role : DEFAULT_ROLE} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <li key={user.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="font-medium">
              {user.name}
              {user.id === me.id && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
            </p>
            <p className="mb-3 text-sm text-zinc-600">{user.email}</p>
            <RoleForm userId={user.id} role={isRole(user.role) ? user.role : DEFAULT_ROLE} />
          </li>
        ))}
      </ul>
    </>
  );
}
