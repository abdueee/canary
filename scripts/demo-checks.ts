// Dev tool: runs the check engine end to end against the real database and
// Spaces, using a throwaway dataset that is deleted afterwards.
//
// It creates six checks, uploads four versions of a claims file (two good, one
// with problems, one unreadable), runs the checks on each, and prints the results.
// Usage: npm run demo:checks   (needs Postgres running and Spaces credentials in .env)
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { executeRun } from "@/lib/checks/run";
import { checkDefinitionSchema, type CheckDefinition } from "@/lib/checks/schemas";
import { datasetPrefix, deletePrefix, putObject } from "@/lib/storage";

const CHECKS: CheckDefinition[] = [
  {
    type: "REQUIRED_COLUMNS",
    column: null,
    config: {
      columns: [
        { name: "claim_id", type: "integer" },
        { name: "amount", type: "number" },
        { name: "status", type: "string" },
      ],
    },
  },
  { type: "ROW_COUNT", column: null, config: { mode: "relative", tolerancePct: 20, lookback: 5 } },
  { type: "NULL_RATE", column: "amount", config: { maxPct: 5 } },
  { type: "ALLOWED_VALUES", column: "status", config: { values: ["approved", "pending", "denied"], caseSensitive: false } },
  { type: "NUMERIC_RANGE", column: "amount", config: { min: 0, max: 10_000 } },
  { type: "UNIQUE", column: "claim_id", config: {} },
];

const STATUSES = ["approved", "pending", "denied"];

/** A claims file with `rows` rows; `spoil` can change any row. */
function claimsCsv(rows: number, spoil: (row: string[], i: number) => string[] = (row) => row) {
  const lines = Array.from({ length: rows }, (_, i) =>
    spoil([String(i + 1), ((i * 37) % 9000 + 0.5).toFixed(2), STATUSES[i % 3]], i).join(","),
  );
  return ["claim_id,amount,status", ...lines].join("\n");
}

const VERSIONS: { label: string; csv: string }[] = [
  { label: "good, 1,000 rows", csv: claimsCsv(1000) },
  { label: "good, 1,050 rows", csv: claimsCsv(1050) },
  {
    label: "bad: 600 rows, new statuses, empty and negative amounts, duplicate ids",
    csv: claimsCsv(600, ([id, amount, status], i) => [
      i % 50 === 0 ? "7" : id,
      i % 10 === 0 ? "" : i % 75 === 0 ? "-20" : amount,
      i % 40 === 0 ? "REOPENED" : status,
    ]),
  },
  { label: "unreadable: a row with too many values", csv: "claim_id,amount,status\n1,2,approved,extra\n" },
];

async function main() {
  const userId = `demo-checks-${randomUUID()}`;
  await db.user.create({ data: { id: userId, name: "Check demo", email: `${userId}@example.invalid` } });
  const dataset = await db.dataset.create({ data: { name: "Check engine demo", createdById: userId } });

  try {
    await db.check.createMany({
      data: CHECKS.map((check) => ({ datasetId: dataset.id, ...checkDefinitionSchema.parse(check) })),
    });
    const checkNames = new Map(
      (await db.check.findMany({ where: { datasetId: dataset.id } })).map((c) => [c.id, c.column ? `${c.type} (${c.column})` : c.type]),
    );

    for (const [i, { label, csv }] of VERSIONS.entries()) {
      const versionNumber = i + 1;
      const fileKey = `${datasetPrefix(dataset.id)}${randomUUID()}.csv`;
      const bytes = new TextEncoder().encode(csv);
      await putObject(fileKey, bytes, "text/csv");
      const version = await db.datasetVersion.create({
        data: {
          datasetId: dataset.id,
          versionNumber,
          fileKey,
          fileName: `claims_v${versionNumber}.csv`,
          sizeBytes: bytes.byteLength,
          contentHash: randomUUID(),
          uploadedById: userId,
          runs: { create: {} },
        },
        include: { runs: true },
      });

      const runId = version.runs[0].id;
      const status = await executeRun(runId);
      const run = await db.checkRun.findUniqueOrThrow({
        where: { id: runId },
        include: { results: true, alert: true },
      });

      console.log(`\n=== v${versionNumber} (${label}) -> ${status}${run.alert ? ", alert opened" : ""}`);
      if (run.error) console.log(`    ${run.error}`);
      for (const result of run.results) {
        console.log(`    ${result.status.padEnd(7)} ${checkNames.get(result.checkId)}: ${result.message}`);
      }
    }

    // Running a finished run again changes nothing.
    const lastRun = await db.checkRun.findFirstOrThrow({ where: { version: { datasetId: dataset.id, versionNumber: 3 } } });
    const again = await executeRun(lastRun.id);
    const alerts = await db.alert.count({ where: { datasetId: dataset.id } });
    console.log(`\nRe-running v3: ${again}; alerts for the dataset: ${alerts}`);
  } finally {
    await db.dataset.delete({ where: { id: dataset.id } });
    await deletePrefix(datasetPrefix(dataset.id));
    await db.user.delete({ where: { id: userId } });
    console.log("Cleaned up the demo dataset.");
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
