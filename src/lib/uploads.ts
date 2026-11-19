// Upload limits shared by the dropzone (browser) and the upload route (server).
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_LABEL = "20 MB";

export function isCsvFileName(name: string) {
  return name.toLowerCase().endsWith(".csv");
}
