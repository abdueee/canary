import "server-only";
import { parseCsv, type Table } from "@/lib/csv";
import { db } from "@/lib/db";
import { getObjectBytes } from "@/lib/storage";
import { profileTable } from "./profile";
import type { Profile } from "./schemas";

/**
 * Downloads a version's CSV from Spaces, parses and profiles it, and saves
 * rowCount and profile on the version.
 *
 * Throws CsvError when the file itself is unusable (the run should be marked
 * ERROR with that message, without retrying). Other errors (Spaces or database)
 * are temporary and can be retried.
 *
 * Returns the parsed table as well, so the check run can evaluate checks
 * without downloading and parsing the file a second time.
 */
export async function profileVersion(versionId: string): Promise<{ table: Table; profile: Profile }> {
  const version = await db.datasetVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: { fileKey: true },
  });

  const table = parseCsv(await getObjectBytes(version.fileKey));
  const profile = profileTable(table);

  await db.datasetVersion.update({
    where: { id: versionId },
    data: { rowCount: profile.rowCount, profile },
  });

  return { table, profile };
}
