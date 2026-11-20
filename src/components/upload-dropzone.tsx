"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isCsvFileName, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploads";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

// Drag-and-drop (or pick) a CSV to upload a new version. Functional only;
// styling comes with the UI pass.
export function UploadDropzone({ datasetId }: { datasetId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    // Quick checks so obvious mistakes don't wait for the server. The server checks again.
    if (!isCsvFileName(file.name)) {
      setStatus({ kind: "error", message: "Only .csv files are accepted" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({ kind: "error", message: `The file is larger than ${MAX_UPLOAD_LABEL}` });
      return;
    }

    setStatus({ kind: "uploading", fileName: file.name });
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`/api/datasets/${datasetId}/versions`, { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus({ kind: "error", message: data?.error ?? `Upload failed (${response.status})` });
        return;
      }
      setStatus({ kind: "done", message: `Uploaded ${file.name}` });
      // TODO(feature 9): go to the new run's page instead.
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Upload failed. Check your connection and try again." });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  const uploading = status.kind === "uploading";

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !uploading) {
          upload(file);
        }
      }}
      className="flex flex-col gap-2 border border-dashed p-6"
    >
      <p>{dragging ? "Drop to upload" : `Drag a CSV here (max ${MAX_UPLOAD_LABEL}), or choose a file:`}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            upload(file);
          }
        }}
      />
      <p aria-live="polite">
        {status.kind === "uploading" && `Uploading ${status.fileName}…`}
        {status.kind === "error" && status.message}
        {status.kind === "done" && status.message}
      </p>
    </div>
  );
}
