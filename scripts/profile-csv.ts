// Dev tool: parse and profile a local CSV exactly as Canary would, and print the result.
// Usage: npm run profile:csv -- path/to/file.csv
import { readFileSync } from "node:fs";
import { profileTable } from "@/lib/checks/profile";
import { CsvError, parseCsv } from "@/lib/csv";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run profile:csv -- path/to/file.csv");
  process.exit(1);
}

try {
  const table = parseCsv(new Uint8Array(readFileSync(path)));
  const profile = profileTable(table);

  console.log(`${profile.rowCount} rows, ${profile.columns.length} columns\n`);
  console.table(
    profile.columns.map((column) => ({
      column: column.name,
      type: column.inferredType,
      "null %": column.nullPct,
      distinct: column.distinctCount === 10_000 ? "10000+" : column.distinctCount,
      min: column.min ?? "",
      max: column.max ?? "",
      values: column.topValues?.map((v) => `${v.value} (${v.count})`).join(", ") ?? "",
    })),
  );
  console.log("\nFull profile JSON (as saved on the version):");
  console.log(JSON.stringify(profile, null, 2));
} catch (error) {
  if (error instanceof CsvError) {
    console.error(`Canary would reject this file: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
