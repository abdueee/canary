import "server-only";
import { redirect } from "next/navigation";

// TEMPORARY STUB until Better Auth lands (feature 2).
// Every caller gets a fake admin so the app is usable locally. Replace the body
// of requireUser() with a real session lookup; keep the exported names and the
// CurrentUser shape so nothing else has to change.
// To try the viewer experience, change DEV_USER.role to "VIEWER".

export type Role = "ADMIN" | "VIEWER";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

const DEV_USER: CurrentUser = {
  id: "dev-admin",
  name: "Dev Admin",
  email: "admin@canary.local",
  role: "ADMIN",
};

/** Returns the signed-in user. The real version redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  return DEV_USER;
}

/** Returns the signed-in user if they have `role`; otherwise sends them to the dashboard. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) {
    redirect("/");
  }
  return user;
}
