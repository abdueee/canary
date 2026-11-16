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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
