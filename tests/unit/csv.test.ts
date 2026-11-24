import { describe, expect, it } from "vitest";
import { CsvError, parseCsv } from "@/lib/csv";

const encode = (text: string) => new TextEncoder().encode(text);

describe("parseCsv", () => {
  it("splits the header from the data rows", () => {
    expect(parseCsv("id,name\n1,Ann\n2,Bo\n")).toEqual({
      columns: ["id", "name"],
      rows: [
        ["1", "Ann"],
        ["2", "Bo"],
      ],
    });
  });

  it("accepts bytes as well as text", () => {
    expect(parseCsv(encode("a,b\n1,2"))).toEqual({ columns: ["a", "b"], rows: [["1", "2"]] });
  });

  it("strips a UTF-8 BOM from bytes and from text", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode("id,name\n1,Ann")]);
    expect(parseCsv(withBom).columns).toEqual(["id", "name"]);
    expect(parseCsv("﻿id,name\n1,Ann").columns).toEqual(["id", "name"]);
  });

  it("trims header names but leaves cell values as they are", () => {
    expect(parseCsv(" id , name \n 1 , Ann ")).toEqual({
      columns: ["id", "name"],
      rows: [[" 1 ", " Ann "]],
    });
  });

  it("handles quoted cells with commas, quotes and line breaks", () => {
    const table = parseCsv('id,note\n1,"Smith, J."\n2,"said ""hi"""\n3,"two\nlines"\n');
    expect(table.rows).toEqual([
      ["1", "Smith, J."],
      ["2", 'said "hi"'],
      ["3", "two\nlines"],
    ]);
  });

  it("handles Windows line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4\r\n").rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n\n").rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("allows a header with no data rows", () => {
    expect(parseCsv("a,b\n")).toEqual({ columns: ["a", "b"], rows: [] });
  });

  it("pads short rows with empty cells", () => {
    expect(parseCsv("a,b,c\n1\n1,2").rows).toEqual([
      ["1", "", ""],
      ["1", "2", ""],
    ]);
  });

  it("drops empty extra cells from trailing commas", () => {
    expect(parseCsv("a,b\n1,2,,\n").rows).toEqual([["1", "2"]]);
  });

  it("rejects rows with more values than the header", () => {
    expect(() => parseCsv("a,b\n1,2\n1,2,3\n")).toThrow(
      new CsvError("Row 2 has 3 values, but the header has 2 columns."),
    );
  });

  it("rejects an empty file", () => {
    expect(() => parseCsv("")).toThrow(CsvError);
    expect(() => parseCsv(" \n\n ")).toThrow("A header row is required");
  });

  it("rejects text that isn't UTF-8", () => {
    const latin1 = new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x4a, 0x6f, 0xeb, 0x6c]); // "name\nJoël" in Latin-1
    expect(() => parseCsv(latin1)).toThrow("isn't valid UTF-8");
  });

  it("rejects duplicate column names", () => {
    expect(() => parseCsv("id,name,id\n1,2,3")).toThrow('duplicate column name: "id"');
  });

  it("rejects a column with no name", () => {
    expect(() => parseCsv("id,,name\n1,2,3")).toThrow("Column 2 in the header row has no name.");
  });

  it("rejects a quote that is never closed, naming the row", () => {
    expect(() => parseCsv('a,b\n1,2\n3,"oops\n')).toThrow(/^Row 2: /);
  });

  it("throws CsvError (not a generic Error) for file problems", () => {
    try {
      parseCsv("a,a\n1,2");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CsvError);
      expect((error as Error).name).toBe("CsvError");
    }
  });
});
