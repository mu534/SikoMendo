/**
 * features/backups/manifest.ts
 *
 * Build and verify the Cloudinary asset manifest embedded in each backup.
 * The manifest lists every public_id stored in the database so that after a
 * restore the admin can verify all referenced files still exist in Cloudinary.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import type { BackupManifest } from "./backup-format";

interface AssetRef {
  publicId: string;
  resourceType: string;
  refTable: string;
}

/**
 * Queries every table that stores Cloudinary public_ids and builds an asset
 * manifest. The manifest is bundled inside the encrypted backup container.
 *
 * Non-blocking: a failure here should NOT abort the backup — the manifest is
 * best-effort diagnostic information.
 */
export async function buildAssetManifest(
  prisma: PrismaClient
): Promise<BackupManifest> {
  const assets: AssetRef[] = [];

  try {
    const [employees, docs, cooperatives, reports, leaves, orgSettings] =
      await Promise.all([
        prisma.employee.findMany({
          select: { profileImageKey: true },
          where: { profileImageKey: { not: undefined } },
        }),
        prisma.document.findMany({
          select: { fileKey: true, fileResourceType: true },
          where: { fileKey: { not: undefined } },
        }),
        prisma.cooperative.findMany({
          select: { legalCertificateKey: true, legalCertificateResourceType: true },
          where: { legalCertificateKey: { not: undefined } },
        }),
        prisma.report.findMany({
          select: { fileKey: true, fileResourceType: true },
          where: { fileKey: { not: undefined } },
        }),
        prisma.leaveRequest.findMany({
          select: { documentKey: true, documentResourceType: true },
          where: { documentKey: { not: undefined } },
        }),
        prisma.orgSettings.findFirst({
          select: { logoKey: true },
        }),
      ]);

    for (const e of employees) {
      if (e.profileImageKey) {
        assets.push({ publicId: e.profileImageKey, resourceType: "image", refTable: "employee" });
      }
    }
    for (const d of docs) {
      if (d.fileKey) {
        assets.push({ publicId: d.fileKey, resourceType: d.fileResourceType ?? "raw", refTable: "document" });
      }
    }
    for (const c of cooperatives) {
      if (c.legalCertificateKey) {
        assets.push({ publicId: c.legalCertificateKey, resourceType: c.legalCertificateResourceType ?? "image", refTable: "cooperative" });
      }
    }
    for (const r of reports) {
      if (r.fileKey) {
        assets.push({ publicId: r.fileKey, resourceType: r.fileResourceType ?? "raw", refTable: "report" });
      }
    }
    for (const l of leaves) {
      if (l.documentKey) {
        assets.push({ publicId: l.documentKey, resourceType: l.documentResourceType ?? "raw", refTable: "leave_request" });
      }
    }
    if (orgSettings?.logoKey) {
      assets.push({ publicId: orgSettings.logoKey, resourceType: "image", refTable: "org_settings" });
    }
  } catch (err) {
    console.error("[buildAssetManifest] Failed to query assets:", err);
  }

  return {
    generatedAt: new Date().toISOString(),
    appVersion:  process.env.npm_package_version ?? "unknown",
    assets,
  };
}

export interface AssetVerificationResult {
  total: number;
  verified: number;
  missing: string[];
}

/**
 * Best-effort verification of each asset in the manifest against Cloudinary.
 * Returns counts; never throws. Missing assets are reported but do not fail
 * the restore.
 */
export async function verifyAssets(
  manifest: BackupManifest
): Promise<AssetVerificationResult> {
  const missing: string[] = [];
  let verified = 0;

  for (const asset of manifest.assets) {
    try {
      await cloudinary.api.resource(asset.publicId, {
        resource_type: asset.resourceType as "image" | "raw" | "video",
      });
      verified++;
    } catch {
      missing.push(asset.publicId);
    }
  }

  return { total: manifest.assets.length, verified, missing };
}
