import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";

// Used on /login and /register: a signed-in user is sent to the dashboard.
// This checks the real session (not just the cookie), so an expired cookie
// can't cause a redirect loop between /login and the dashboard.
export async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}
