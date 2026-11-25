import { z } from "zod";

// Shared shapes for profiling and checks. Profiles are stored as JSON on
// DatasetVersion.profile, and check settings as JSON on Check.config, so
// anything that reads one back from the database (charts, suggestions, the
// check engine, the check forms) should parse it with these schemas.

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

// ---------------------------------------------------------------------------
// Check settings (Check.config), one schema per check type.

/** Used by suggestions and as the form defaults for a relative row count check. */
export const DEFAULT_ROW_COUNT_TOLERANCE_PCT = 20;
export const DEFAULT_ROW_COUNT_LOOKBACK = 5;
export const MAX_ROW_COUNT_LOOKBACK = 50;

const columnName = z.string().trim().min(1, "Column name is required.");

/** min and max are each optional, but at least one is needed and min can't exceed max. */
function hasValidBounds({ min, max }: { min?: number; max?: number }) {
  return (min !== undefined || max !== undefined) && (min === undefined || max === undefined || min <= max);
}
const BOUNDS_MESSAGE = "Set a minimum, a maximum or both, with the minimum no larger than the maximum.";

export const requiredColumnsConfigSchema = z.object({
  columns: z
    .array(z.object({ name: columnName, type: inferredTypeSchema.optional() }))
    .min(1, "List at least one column.")
    .refine((columns) => new Set(columns.map((c) => c.name)).size === columns.length, "Each column can be listed once."),
});
export type RequiredColumnsConfig = z.infer<typeof requiredColumnsConfigSchema>;

export const rowCountConfigSchema = z.discriminatedUnion("mode", [
  /** A fixed range, e.g. between 5,000 and 15,000 rows. */
  z
    .object({
      mode: z.literal("absolute"),
      min: z.number().int().nonnegative().optional(),
      max: z.number().int().nonnegative().optional(),
    })
    .refine(hasValidBounds, BOUNDS_MESSAGE),
  /** Within tolerancePct of the average row count of the previous `lookback` versions. */
  z.object({
    mode: z.literal("relative"),
    tolerancePct: z.number().positive().max(1000),
    lookback: z.number().int().min(2).max(MAX_ROW_COUNT_LOOKBACK),
  }),
]);
export type RowCountConfig = z.infer<typeof rowCountConfigSchema>;

export const nullRateConfigSchema = z.object({
  /** The highest allowed percentage (0 to 100) of empty values. */
  maxPct: z.number().min(0).max(100),
});
export type NullRateConfig = z.infer<typeof nullRateConfigSchema>;

export const allowedValuesConfigSchema = z.object({
  values: z.array(z.string().trim().min(1)).min(1, "List at least one allowed value."),
  caseSensitive: z.boolean(),
});
export type AllowedValuesConfig = z.infer<typeof allowedValuesConfigSchema>;

export const numericRangeConfigSchema = z
  .object({ min: z.number().optional(), max: z.number().optional() })
  .refine(hasValidBounds, BOUNDS_MESSAGE);
export type NumericRangeConfig = z.infer<typeof numericRangeConfigSchema>;

export const uniqueConfigSchema = z.object({});
export type UniqueConfig = z.infer<typeof uniqueConfigSchema>;

/**
 * A check's type, column and settings together, as stored on a Check row.
 * REQUIRED_COLUMNS and ROW_COUNT look at the whole file (column is null);
 * the others look at one column.
 */
export const checkDefinitionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REQUIRED_COLUMNS"), column: z.null(), config: requiredColumnsConfigSchema }),
  z.object({ type: z.literal("ROW_COUNT"), column: z.null(), config: rowCountConfigSchema }),
  z.object({ type: z.literal("NULL_RATE"), column: columnName, config: nullRateConfigSchema }),
  z.object({ type: z.literal("ALLOWED_VALUES"), column: columnName, config: allowedValuesConfigSchema }),
  z.object({ type: z.literal("NUMERIC_RANGE"), column: columnName, config: numericRangeConfigSchema }),
  z.object({ type: z.literal("UNIQUE"), column: columnName, config: uniqueConfigSchema }),
]);
export type CheckDefinition = z.infer<typeof checkDefinitionSchema>;

/** CheckResult.sampleRows: rows that broke the rule, values in the file's column order. */
export const sampleRowsSchema = z.array(
  z.object({ rowNumber: z.number().int().positive(), values: z.array(z.string()) }),
);

/** Check types that apply to a single column (Check.column is set). */
export const COLUMN_CHECK_TYPES = ["NULL_RATE", "ALLOWED_VALUES", "NUMERIC_RANGE", "UNIQUE"] as const;
