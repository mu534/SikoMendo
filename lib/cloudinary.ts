import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "@/lib/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type CloudinaryAsset = {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
  resourceType: string;
};

/**
 * Uploads a file (received as a Blob/File from a multipart form) to Cloudinary.
 * `folder` namespaces assets, e.g. "siko-mendo/employees" or "siko-mendo/documents".
 *
 * `access` controls who can fetch the resulting file:
 *   - "public" (default): a normal Cloudinary URL that works for anyone who has
 *     it, forever. Fine for things like avatar photos that aren't sensitive.
 *   - "authenticated": Cloudinary will reject the plain `url` with a 401. The
 *     file can only be fetched via a short-lived signed URL generated on
 *     demand with getSignedFileUrl() — use this for anything containing
 *     personal or sensitive information (ID documents, contracts, leave
 *     attachments, generated reports).
 */
export async function uploadToCloudinary(
  file: File | Buffer,
  folder: string,
  options?: {
    resourceType?: "image" | "auto";
    access?: "public" | "authenticated";
    /** Optional Cloudinary transformation applied at upload time (eager). */
    transformation?: Array<Record<string, string | number>>;
    /** MIME type hint — required when passing a Buffer directly. */
    mimeType?: string;
  }
): Promise<CloudinaryAsset> {
  const buf = file instanceof Buffer ? file : Buffer.from(await (file as File).arrayBuffer());
  const mime = file instanceof Buffer ? (options?.mimeType ?? "image/jpeg") : (file as File).type;
  const base64 = `data:${mime};base64,${buf.toString("base64")}`;

  const result: UploadApiResponse = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: options?.resourceType ?? "auto",
    type: options?.access === "authenticated" ? "authenticated" : "upload",
    ...(options?.transformation ? { eager: options.transformation } : {}),
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    format: result.format,
    resourceType: result.resource_type,
  };
}

/**
 * Generates a short-lived signed URL for a file uploaded with
 * `access: "authenticated"`. Call this fresh every time the file needs to be
 * viewed or downloaded — never store the result, since it expires
 * (default 5 minutes) and each call produces a new one.
 */
export function getSignedFileUrl(
  publicId: string,
  resourceType: "image" | "raw" | "video" = "raw",
  expiresInSeconds = 300
): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
}

/** Deletes a previously uploaded asset. Safe to call with a stale/unknown publicId. */
export async function deleteFromCloudinary(publicId: string, resourceType: "image" | "raw" = "image") {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    // Non-fatal: don't block the calling mutation if cleanup fails.
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, error);
  }
}

/**
 * Uploads an encrypted backup buffer to Cloudinary as a private raw asset.
 * Uses upload_stream for streaming without base64 overhead.
 * Backups are stored in a separate folder from employee documents.
 */
export async function uploadBackupToCloudinary(
  buffer: Buffer,
  publicId: string,
  opts?: { filename?: string; folder?: string }
): Promise<{ publicId: string; bytes: number; url: string }> {
  const folder = opts?.folder ?? "siko-mendo/backups";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "raw",
        type: "authenticated",
        overwrite: true,
      },
      (err, res) => {
        if (err) return reject(err);
        if (!res) return reject(new Error("No response from Cloudinary upload"));
        resolve({ publicId: res.public_id, bytes: res.bytes, url: res.secure_url });
      }
    );
    stream.end(buffer);
  });
}
