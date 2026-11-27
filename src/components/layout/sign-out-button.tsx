"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const { error } = await authClient.signOut(); // deletes the session row and clears the cookie
    if (error) {
      setPending(false);
      return;
    }
    // Full page load, not router.replace(): with cacheComponents, Next.js keeps
    // pages you navigate away from in memory with their state, so a client-side
    // navigation brought this button back later still saying "Signing out..."
    // (and the login form still saying "Signing in..."). A full load also drops
    // every cached page from this user's session before someone else signs in.
    window.location.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
