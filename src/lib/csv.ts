import Papa from "papaparse";

// Turns an uploaded CSV into a table of raw string cells.
//
// Rules (Context.md section 8): UTF-8 only, BOM stripped, comma-delimited, and
// the first row is always the header. Anything that makes the file unusable
// throws a CsvError with a message that can be shown to the user as-is.

export type Table = {
  /** Header names, trimmed. Unique and non-empty. */
  columns: string[];
  /** Data rows (header excluded). Every row has exactly columns.length cells. */
  rows: string[][];
};

/** A problem with the file itself, not a bug. Shown to the user. */
export class CsvError extends Error {
  override name = "CsvError";
}

export function parseCsv(input: Uint8Array | string): Table {
  const text = typeof input === "string" ? input : decodeUtf8(input);
  const content = text.startsWith("﻿") ? text.slice(1) : text;

  if (content.trim() === "") {
    throw new CsvError("The file is empty. A header row is required.");
  }

  const result = Papa.parse<string[]>(content, {
    delimiter: ",",
    header: false,
    skipEmptyLines: true,
  });

  // With a fixed delimiter and header: false, the only fatal errors are quoting
  // problems (for example a quote that is never closed).
  const quoteError = result.errors.find((error) => error.type === "Quotes");
  if (quoteError) {
    throw new CsvError(`${describeRow(quoteError.row)}: ${quoteError.message}.`);
  }

  const [header, ...dataRows] = result.data;
  const columns = header.map((name) => name.trim());
  validateHeader(columns);

  const rows = dataRows.map((cells, index) => fitRow(cells, columns.length, index + 1));
  return { columns, rows };
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    // fatal: reject invalid byte sequences instead of silently replacing them.
    // TextDecoder also drops a leading BOM.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvError("The file isn't valid UTF-8 text. Re-save it as \"CSV UTF-8\" and upload again.");
  }
}

function validateHeader(columns: string[]) {
  const seen = new Set<string>();
  columns.forEach((name, index) => {
    if (name === "") {
      throw new CsvError(`Column ${index + 1} in the header row has no name.`);
    }
    if (seen.has(name)) {
      throw new CsvError(`The header row has a duplicate column name: "${name}".`);
    }
    seen.add(name);
  });
}

// Short rows are padded with empty cells (read as nulls). Extra trailing cells
// are dropped if they are empty, which covers files with trailing commas; extra
// cells with content mean the row doesn't line up with the header.
function fitRow(cells: string[], width: number, rowNumber: number): string[] {
  if (cells.length === width) return cells;
  if (cells.length < width) {
    return [...cells, ...Array<string>(width - cells.length).fill("")];
  }
  if (cells.slice(width).some((cell) => cell.trim() !== "")) {
    throw new CsvError(
      `Row ${rowNumber} has ${cells.length} values, but the header has ${width} columns.`,
    );
  }
  return cells.slice(0, width);
}

// Papa Parse counts lines from 0 with the header as line 0, which matches our
// 1-based data row numbers (the header isn't a data row).
function describeRow(row: number | undefined) {
  if (row === undefined) return "The file";
  return row === 0 ? "The header row" : `Row ${row}`;
}
