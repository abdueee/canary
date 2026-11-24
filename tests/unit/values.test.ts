import { describe, expect, it } from "vitest";
import {
  isNullValue,
  parseBoolean,
  parseDate,
  parseInteger,
  parseNumber,
} from "@/lib/checks/values";

describe("isNullValue", () => {
  it.each(["", "   ", "NULL", "null", "Null", "NA", "na", " NA "])("treats %j as null", (value) => {
    expect(isNullValue(value)).toBe(true);
  });

  it.each(["0", "N/A", "none", "-", "nan"])("treats %j as a value", (value) => {
    expect(isNullValue(value)).toBe(false);
  });
});

describe("parseInteger", () => {
  it.each([
    ["42", 42],
    ["-7", -7],
    ["+3", 3],
    ["007", 7],
  ])("parses %j", (value, expected) => {
    expect(parseInteger(value)).toBe(expected);
  });

  it.each(["4.0", "1e3", "1,000", "abc", "99999999999999999999"])("rejects %j", (value) => {
    expect(parseInteger(value)).toBeNull();
  });
});

describe("parseNumber", () => {
  it.each([
    ["42", 42],
    ["-3.5", -3.5],
    [".5", 0.5],
    ["5.", 5],
    ["1e3", 1000],
    ["2.5E-2", 0.025],
  ])("parses %j", (value, expected) => {
    expect(parseNumber(value)).toBe(expected);
  });

  it.each(["1,000", "$5", "12abc", "Infinity", "NaN", "0x10", "1e999"])("rejects %j", (value) => {
    expect(parseNumber(value)).toBeNull();
  });
});

describe("parseBoolean", () => {
  it.each([
    ["true", true],
    ["FALSE", false],
    ["Yes", true],
    ["no", false],
  ])("parses %j", (value, expected) => {
    expect(parseBoolean(value)).toBe(expected);
  });

  it.each(["1", "0", "y", "maybe"])("rejects %j", (value) => {
    expect(parseBoolean(value)).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses a plain date as UTC midnight", () => {
    expect(parseDate("2026-11-23")).toBe(Date.UTC(2026, 10, 23));
  });

  it("parses ISO 8601 date-times, with or without an offset", () => {
    expect(parseDate("2026-11-23T10:30:00Z")).toBe(Date.UTC(2026, 10, 23, 10, 30));
    expect(parseDate("2026-11-23 10:30")).toBe(Date.UTC(2026, 10, 23, 10, 30));
    expect(parseDate("2026-11-23T10:30:00.250Z")).toBe(Date.UTC(2026, 10, 23, 10, 30, 0, 250));
    expect(parseDate("2026-11-23T10:30:00-05:00")).toBe(Date.UTC(2026, 10, 23, 15, 30));
    expect(parseDate("2026-11-23T10:30:00+0130")).toBe(Date.UTC(2026, 10, 23, 9, 0));
  });

  it.each(["2026-02-30", "2026-13-01", "2026-11-23T24:00", "23/11/2026", "Nov 23 2026", "2026-1-5", "20261123"])(
    "rejects %j",
    (value) => {
      expect(parseDate(value)).toBeNull();
    },
  );

  it("accepts leap days only in leap years", () => {
    expect(parseDate("2028-02-29")).not.toBeNull();
    expect(parseDate("2026-02-29")).toBeNull();
  });
});
