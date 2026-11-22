"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

// Browser-side helper used by the login, register and sign-out UI.
// It calls the /api/auth/* endpoints; it never sees password hashes or tokens.
// inferAdditionalFields gives `role` the right TypeScript type on the client.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
