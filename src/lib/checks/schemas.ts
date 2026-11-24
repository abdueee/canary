import { z } from "zod";

// Shared shapes for profiling and checks. Profiles are stored as JSON on
// DatasetVersion.profile, so anything that reads one back from the database
// (charts, suggestions, checks) should parse it with profileSchema.
// Check config schemas are added here with the check engine (feature 6).

export const INFERRED_TYPES = ["integer", "number", "boolean", "date", "string"] as const;

export const inferredTypeSchema = z.enum(INFERRED_TYPES);
export type InferredType = z.infer<typeof inferredTypeSchema>;

export const columnProfileSchema = z.object({
  name: z.string(),
  inferredType: inferredTypeSchema,
  nullCount: z.number().int().nonnegative(),
  /** Percentage from 0 to 100, rounded to 2 decimals. */
  nullPct: z.number().min(0).max(100),
  /** Distinct non-null values, capped: 10_000 means 10,000 or more. */
  distinctCount: z.number().int().nonnegative(),
  /** Numeric columns: the smallest/largest number. Date columns: the earliest/latest value as written. */
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  /** Every distinct value with its count, most common first. Only when there are 20 or fewer. */
  topValues: z.array(z.object({ value: z.string(), count: z.number().int().positive() })).optional(),
});
export type ColumnProfile = z.infer<typeof columnProfileSchema>;

export const profileSchema = z.object({
  rowCount: z.number().int().nonnegative(),
  columns: z.array(columnProfileSchema),
});
export type Profile = z.infer<typeof profileSchema>;
