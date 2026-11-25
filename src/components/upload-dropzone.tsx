"use client";

import { FileUp, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { isCsvFileName, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploads";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

// Drag-and-drop (or pick) a CSV to upload a new version. The native file input
// is visually hidden; the "Choose file" button opens it.
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
      setStatus({ kind: "done", message: `Uploaded ${file.name}. Opening the run…` });
      const { runId } = (await response.json()) as { versionId: string; runId: string };
      router.push(`/datasets/${datasetId}/runs/${runId}`);
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
        if (!uploading) setDragging(true);
      }}
      onDragLeave={(event) => {
        // Ignore drag-leave events fired when moving over child elements.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !uploading) {
          upload(file);
        }
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-ring/60 hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-full transition-colors",
          dragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {uploading ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <Upload aria-hidden className="size-5" />}
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium">
          {uploading ? `Uploading ${status.fileName}…` : dragging ? "Drop the file to upload" : "Drag a CSV file here"}
        </p>
        <p className="text-sm text-muted-foreground">or choose one from your computer · .csv up to {MAX_UPLOAD_LABEL}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={uploading}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            upload(file);
          }
        }}
      />
      <Button type="button" size="lg" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <FileUp aria-hidden />
        {uploading ? "Uploading…" : "Choose file"}
      </Button>

      <p aria-live="polite" className="min-h-5 text-sm">
        {status.kind === "error" && <span className="text-destructive">{status.message}</span>}
        {status.kind === "done" && <span className="text-emerald-700 dark:text-emerald-400">{status.message}</span>}
      </p>
    </div>
  );
}
