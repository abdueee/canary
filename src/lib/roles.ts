// Roles shared by the server (permission checks) and the client (hiding controls).
// Safe to import anywhere: no server-only code here.

export const ROLES = ["admin", "viewer"] as const;
export type Role = (typeof ROLES)[number];

// Everyone who registers starts as a viewer. Admins are promoted by the seed
// script (SEED_ADMIN_EMAIL) or by another admin on /admin/users.
export const DEFAULT_ROLE: Role = "viewer";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
