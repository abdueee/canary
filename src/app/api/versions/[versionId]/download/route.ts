import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { presignDownload } from "@/lib/storage";

// Download the original CSV of a version. Redirects to a 5-minute presigned
// Spaces link, so the file goes straight from Spaces to the browser.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/versions/[versionId]/download">,
) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { versionId } = await params;

  const version = await db.datasetVersion.findUnique({
    where: { id: versionId },
    select: { fileKey: true, fileName: true },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const url = await presignDownload(version.fileKey, version.fileName);
  return NextResponse.redirect(url, 302);
}
