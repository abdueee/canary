import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { DEFAULT_ROLE, isRole, type Role } from "@/lib/roles";

// Authorization helpers. Every Server Component, Server Action and Route Handler
// that reads or changes data should start with one of these. Hiding a button in
// the UI is not protection: a Server Action is a public endpoint and can be
// called directly.

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// The signed-in user, or null. Validates the session against the database.
// Wrapped in React's cache() so a layout and a page in the same request share
// one lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email, role } = session.user;
  return { id, name, email, role: isRole(role) ? role : DEFAULT_ROLE };
});

// Pages and Server Actions: send signed-out users to /login.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Pages and Server Actions: allow only the given roles; others go to the dashboard.
// Usage: const admin = await requireRole("admin");
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

// Route Handlers (uploads, downloads, SSE) should return JSON errors rather
// than redirect, so use getCurrentUser() there:
//
//   const user = await getCurrentUser();
//   if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
//   if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
