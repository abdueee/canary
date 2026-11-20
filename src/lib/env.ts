import "server-only";
import { z } from "zod";

// Server environment variables, validated once at startup so a missing or
// malformed value fails immediately with a clear message.
// Add each feature's variables here when that feature lands (auth, Spaces, ...).
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a postgresql:// connection string"),

  // Better Auth signs session cookies with this secret. 32+ random characters.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (see README: generate a secret)"),
  // The app's own origin, e.g. http://localhost:3000
  BETTER_AUTH_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
