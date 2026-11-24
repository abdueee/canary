import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/checks/schemas";
import { DISTINCT_CAP, profileTable } from "@/lib/checks/profile";
import { parseCsv } from "@/lib/csv";

const claims = parseCsv(
  [
    "claim_id,amount,status,filed_on,notes",
    "1,100.50,approved,2026-01-05,",
    "2,75,pending,2026-01-03,NA",
    "3,20.25,approved,2026-01-09,late",
    "4,,denied,2026-01-04,null",
    "5,310,approved,2026-01-02,",
  ].join("\n"),
);

describe("profileTable", () => {
  const profile = profileTable(claims);
  const column = (name: string) => profile.columns.find((c) => c.name === name)!;

  it("counts data rows and keeps column order", () => {
    expect(profile.rowCount).toBe(5);
    expect(profile.columns.map((c) => c.name)).toEqual(["claim_id", "amount", "status", "filed_on", "notes"]);
  });

  it("produces JSON that matches the shared Profile schema", () => {
    expect(profileSchema.parse(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });

  it("profiles an integer column", () => {
    expect(column("claim_id")).toEqual({
      name: "claim_id",
      inferredType: "integer",
      nullCount: 0,
      nullPct: 0,
      distinctCount: 5,
      min: 1,
      max: 5,
      topValues: [
        { value: "1", count: 1 },
        { value: "2", count: 1 },
        { value: "3", count: 1 },
        { value: "4", count: 1 },
        { value: "5", count: 1 },
      ],
    });
  });

  it("profiles a number column with a missing value", () => {
    expect(column("amount")).toMatchObject({
      inferredType: "number",
      nullCount: 1,
      nullPct: 20,
      distinctCount: 4,
      min: 20.25,
      max: 310,
    });
  });

  it("lists a string column's values, most common first", () => {
    expect(column("status")).toMatchObject({
      inferredType: "string",
      nullCount: 0,
      distinctCount: 3,
      topValues: [
        { value: "approved", count: 3 },
        { value: "denied", count: 1 },
        { value: "pending", count: 1 },
      ],
    });
    expect(column("status")).not.toHaveProperty("min");
  });

  it("reports the earliest and latest dates as written", () => {
    expect(column("filed_on")).toMatchObject({ inferredType: "date", min: "2026-01-02", max: "2026-01-09" });
  });

  it("counts empty, NA and null as nulls", () => {
    expect(column("notes")).toMatchObject({ nullCount: 4, nullPct: 80, distinctCount: 1 });
  });

  it("ignores surrounding spaces when counting values", () => {
    const { columns } = profileTable(parseCsv("code\n A \nA\n A"));
    expect(columns[0]).toMatchObject({ distinctCount: 1, topValues: [{ value: "A", count: 3 }] });
  });

  it("leaves out topValues when there are more than 20 distinct values", () => {
    const rows = Array.from({ length: 21 }, (_, i) => `v${i}`);
    const { columns } = profileTable(parseCsv(["code", ...rows].join("\n")));
    expect(columns[0].distinctCount).toBe(21);
    expect(columns[0]).not.toHaveProperty("topValues");
  });

  it("caps distinctCount", () => {
    const rows = Array.from({ length: DISTINCT_CAP + 50 }, (_, i) => [String(i)]);
    const { columns } = profileTable({ columns: ["id"], rows });
    expect(columns[0].distinctCount).toBe(DISTINCT_CAP);
    // min/max still cover every value, not just the first DISTINCT_CAP.
    expect(columns[0]).toMatchObject({ min: 0, max: DISTINCT_CAP + 49 });
  });

  it("ignores the few values that don't fit the inferred type when finding min/max", () => {
    const rows = [...Array.from({ length: 19 }, (_, i) => String(i + 1)), "n/a"];
    const { columns } = profileTable(parseCsv(["qty", ...rows].join("\n")));
    expect(columns[0]).toMatchObject({ inferredType: "integer", min: 1, max: 19 });
  });

  it("handles a file with a header and no rows", () => {
    expect(profileTable(parseCsv("a,b\n"))).toEqual({
      rowCount: 0,
      columns: [
        { name: "a", inferredType: "string", nullCount: 0, nullPct: 0, distinctCount: 0, topValues: [] },
        { name: "b", inferredType: "string", nullCount: 0, nullPct: 0, distinctCount: 0, topValues: [] },
      ],
    });
  });

  it("rounds nullPct to 2 decimals", () => {
    const { columns } = profileTable(parseCsv("x\n1\n\n2\n,"));
    // Only "," is a row here (blank lines are skipped): 1 null of 3 rows.
    expect(columns[0].nullPct).toBe(33.33);
  });
});
