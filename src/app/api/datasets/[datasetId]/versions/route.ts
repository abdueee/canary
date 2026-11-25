import { createHash, randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/authz";
import { executeRun, failRun } from "@/lib/checks/run";
import { db } from "@/lib/db";
import { datasetPrefix, deleteObject, putObject } from "@/lib/storage";
import { isCsvFileName, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploads";

// Upload a new CSV version of a dataset. Any signed-in user may upload.
// Responds 201 { versionId, runId }, or { error } with 400 / 401 / 404 / 409 / 413.

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/datasets/[datasetId]/versions">,
) {
  // Not requireUser(): a redirect to /login would look like a successful upload to fetch().
  const user = await getCurrentUser();
  if (!user) {
    return fail(401, "Unauthorized");
  }
  const { datasetId } = await params;

  const dataset = await db.dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
  if (!dataset) {
    return fail(404, "Dataset not found");
  }

  // Reject obviously oversized requests before reading the body into memory.
  // (The small allowance covers the multipart wrapper around the file.)
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return fail(413, `The file is larger than ${MAX_UPLOAD_LABEL}`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Expected a multipart form upload with a 'file' field");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail(400, "No file was uploaded");
  }
  if (!isCsvFileName(file.name)) {
    return fail(400, "Only .csv files are accepted");
  }
  if (file.size === 0) {
    return fail(400, "The file is empty");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(413, `The file is larger than ${MAX_UPLOAD_LABEL}`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  const latest = await db.datasetVersion.findFirst({
    where: { datasetId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, contentHash: true },
  });
  if (latest?.contentHash === contentHash) {
    return fail(409, `This file is identical to the latest version (v${latest.versionNumber})`);
  }

  // Store the file first, then record it. If recording fails, remove the file
  // so nothing is left in Spaces without a matching version row.
  const fileKey = `${datasetPrefix(datasetId)}${randomUUID()}.csv`;
  await putObject(fileKey, bytes, "text/csv");

  try {
    const version = await createVersionWithRun({
      datasetId,
      fileKey,
      fileName: file.name,
      sizeBytes: file.size,
      contentHash,
      uploadedById: user.id,
    });
    // TODO(feature 7): replace with enqueueing the run-checks job on the worker.
    // For now the checks run in this server process once the response is sent.
    after(() => runChecksInBackground(version.runId));
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    await deleteObject(fileKey).catch((cleanupError) => {
      console.error(`Failed to remove orphaned upload ${fileKey}`, cleanupError);
    });
    throw error;
  }
}

// Stand-in for the worker until feature 7: no retries, so any unexpected error
// (Spaces or the database being unavailable) ends the run as ERROR.
async function runChecksInBackground(runId: string) {
  try {
    await executeRun(runId);
  } catch (error) {
    console.error(`Check run ${runId} failed`, error);
    await failRun(runId, "Something went wrong while running the checks.").catch((failError) => {
      console.error(`Could not mark run ${runId} as failed`, failError);
    });
  }
}

type NewVersion = {
  datasetId: string;
  fileKey: string;
  fileName: string;
  sizeBytes: number;
  contentHash: string;
  uploadedById: string;
};

// Creates the version (next version number) and its QUEUED run together.
// Two uploads at the same moment can pick the same version number; the unique
// constraint rejects the second, and it simply tries again with the next number.
async function createVersionWithRun(data: NewVersion, attemptsLeft = 3) {
  try {
    return await db.$transaction(async (tx) => {
      const last = await tx.datasetVersion.findFirst({
        where: { datasetId: data.datasetId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const version = await tx.datasetVersion.create({
        data: {
          ...data,
          versionNumber: (last?.versionNumber ?? 0) + 1,
          runs: { create: {} },
        },
        select: { id: true, runs: { select: { id: true } } },
      });
      return { versionId: version.id, runId: version.runs[0].id };
    });
  } catch (error) {
    const isVersionClash =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (isVersionClash && attemptsLeft > 1) {
      return createVersionWithRun(data, attemptsLeft - 1);
    }
    throw error;
  }
}
