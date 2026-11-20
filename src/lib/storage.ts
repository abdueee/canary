import "server-only";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

// The only module that talks to DigitalOcean Spaces (S3-compatible object storage).
//
// The SPACES_* variables are checked the first time storage is used, not at app
// startup, so pages that don't touch files still work without Spaces credentials.

const spacesEnvSchema = z.object({
  SPACES_ENDPOINT: z.url(),
  SPACES_REGION: z.string().min(1),
  SPACES_BUCKET: z.string().min(1),
  SPACES_KEY: z.string().min(1),
  SPACES_SECRET: z.string().min(1),
});

type Storage = { client: S3Client; bucket: string };

// Reused across hot reloads in development, like the Prisma client.
const globalForStorage = globalThis as unknown as { storage?: Storage };

function getStorage(): Storage {
  if (globalForStorage.storage) {
    return globalForStorage.storage;
  }

  const parsed = spacesEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Spaces is not configured:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;

  const storage: Storage = {
    bucket: env.SPACES_BUCKET,
    client: new S3Client({
      endpoint: env.SPACES_ENDPOINT,
      region: env.SPACES_REGION,
      credentials: { accessKeyId: env.SPACES_KEY, secretAccessKey: env.SPACES_SECRET },
      // Only send checksums when an operation requires them; newer AWS SDK
      // defaults aren't fully supported by S3-compatible services like Spaces.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  globalForStorage.storage = storage;
  return storage;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const { client, bucket } = getStorage();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

/** Reads a whole object into memory. Files are capped at 20 MB, so this is fine. */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const { client, bucket } = getStorage();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new Error(`Object ${key} has no body`);
  }
  return response.Body.transformToByteArray();
}

/** A temporary link that downloads the object under `fileName`. */
export async function presignDownload(key: string, fileName: string, expiresInSeconds = 300) {
  const { client, bucket } = getStorage();
  const asciiName = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteObject(key: string) {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Deletes every object whose key starts with `prefix` (e.g. all of a dataset's files). */
export async function deletePrefix(prefix: string) {
  const { client, bucket } = getStorage();
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
    if (keys.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
}

export function datasetPrefix(datasetId: string) {
  return `datasets/${datasetId}/`;
}
