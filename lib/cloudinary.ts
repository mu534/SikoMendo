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
};

/**
 * Uploads a file (received as a Blob/File from a multipart form) to Cloudinary.
 * `folder` namespaces assets, e.g. "siko-mendo/employees" or "siko-mendo/documents".
 */
export async function uploadToCloudinary(
  file: File,
  folder: string,
  options?: { resourceType?: "image" | "auto" }
): Promise<CloudinaryAsset> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  const result: UploadApiResponse = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: options?.resourceType ?? "auto",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    format: result.format,
  };
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
