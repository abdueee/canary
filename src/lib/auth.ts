import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { DEFAULT_ROLE } from "@/lib/roles";

// Better Auth server instance. It stores users, sessions and password hashes in
// our Postgres database (the user, session, account and verification tables)
// through the same Prisma client the rest of the app uses.
//
// Sessions are looked up in the database on every request (no cookie cache),
// so a role change on /admin/users takes effect on the user's next request.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true, // registering also signs the user in
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: DEFAULT_ROLE,
        // input: false means the sign-up request cannot set its own role.
        // Without this, anyone could register with { role: "admin" }.
        input: false,
      },
    },
  },

  // Lets Server Actions set auth cookies. Must stay the last plugin.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
