import { describe, expect, it } from "vitest";
import { inferType } from "@/lib/checks/infer";

const repeat = (value: string, times: number) => Array<string>(times).fill(value);

describe("inferType", () => {
  it.each([
    [["1", "2", "-3"], "integer"],
    [["1.5", "2", "3.25"], "number"],
    [["true", "false", "Yes"], "boolean"],
    [["2026-01-05", "2026-01-12T09:00:00Z"], "date"],
    [["approved", "pending"], "string"],
  ])("infers %j as %s", (values, expected) => {
    expect(inferType(values)).toBe(expected);
  });

  it("calls a column with no values a string", () => {
    expect(inferType([])).toBe("string");
  });

  it("prefers integer over number when every value is whole", () => {
    expect(inferType(["10", "20", "30"])).toBe("integer");
  });

  it("prefers integer over boolean for 0/1 columns", () => {
    expect(inferType(["0", "1", "1", "0"])).toBe("integer");
  });

  describe("95% rule", () => {
    it("keeps the type when exactly 95% of values parse", () => {
      expect(inferType([...repeat("7", 19), "oops"])).toBe("integer");
    });

    it("falls through when fewer than 95% parse", () => {
      // 18 of 20 = 90%: not integer, not number, not boolean, not date.
      expect(inferType([...repeat("7", 18), "oops", "oops"])).toBe("string");
    });

    it("falls through to the next type that qualifies", () => {
      // 90% integers, but 100% numbers.
      expect(inferType([...repeat("7", 18), "7.5", "8.5"])).toBe("number");
    });

    it("applies the threshold to dates too", () => {
      expect(inferType([...repeat("2026-01-05", 19), "not a date"])).toBe("date");
      expect(inferType([...repeat("2026-01-05", 9), "not a date"])).toBe("string");
    });
  });
});
