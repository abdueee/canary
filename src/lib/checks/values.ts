// How a single CSV cell is read. Shared by profiling and the check evaluators so
// both agree on what counts as null, a number, a date, and so on.
//
// The parse functions expect a trimmed, non-null value and return null when the
// value isn't of that type.

const NULL_TOKENS = new Set(["", "null", "na"]);

/** Empty after trimming, or NULL / null / NA in any case. */
export function isNullValue(raw: string): boolean {
  return NULL_TOKENS.has(raw.trim().toLowerCase());
}

const INTEGER_PATTERN = /^[+-]?\d+$/;
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

export function parseInteger(value: string): number | null {
  if (!INTEGER_PATTERN.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseNumber(value: string): number | null {
  if (!NUMBER_PATTERN.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const BOOLEAN_VALUES: Record<string, boolean> = {
  true: true,
  false: false,
  yes: true,
  no: false,
};

export function parseBoolean(value: string): boolean | null {
  return BOOLEAN_VALUES[value.toLowerCase()] ?? null;
}

// YYYY-MM-DD, optionally followed by a time (T or space), seconds, fractions,
// and a Z or ±hh:mm offset. That covers plain dates and ISO 8601 date-times.
const DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Returns the date as milliseconds since 1970 (UTC), or null if it isn't a real date. */
export function parseDate(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0", second = "0", fraction, offset] = match;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second);

  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59) return null;

  // Rejects days that don't exist, like 2026-02-30 (Date would roll it into March).
  const utc = Date.UTC(y, mo - 1, d, h, mi, s, fraction ? Math.round(Number(fraction) * 1000) : 0);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }

  if (!offset || offset === "Z") return utc;

  const sign = offset.startsWith("-") ? -1 : 1;
  const digits = offset.slice(1).replace(":", "");
  const offsetMinutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2));
  return utc - sign * offsetMinutes * 60_000;
}
