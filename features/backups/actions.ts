"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadBackupToCloudinary, getSignedFileUrl } from "@/lib/cloudinary";
import { LocalizedError } from "@/lib/errors";
import { env } from "@/lib/env";
import { encryptBackup, decryptBackup, parseManifest } from "./backup-format";
import { runPgDump, runPgRestore, pgRestoreList, deleteTempFile } from "./pg-tools";
import { buildAssetManifest, verifyAssets } from "./manifest";
import { getUploadEntry, removeUploadEntry } from "./upload-token-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackupSource = "MANUAL" | "SAFETY" | "UPLOAD";

export interface BackupDetails {
  backupId: string;
  filename: string;
  formatVersion: number;
  createdAt: string;
  sizeBytes: number;
  tableCount: number;
  assetCount: number;
  source: BackupSource;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateEncryptionKey(): string {
  const key = env.BACKUP_ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new LocalizedError(
      "errors.backups.configIncomplete",
      "Backup is not configured: encryption key or pg_dump path missing."
    );
  }
  return key;
}

// ─── createBackup ─────────────────────────────────────────────────────────────

/**
 * Creates a full PostgreSQL backup, encrypts it with AES-256-GCM, and uploads
 * to Cloudinary as a private raw asset.
 *
 * The ENTIRE pipeline (pg_dump → encrypt → upload) is wrapped in a single
 * try/catch. Any failure marks the BackupRecord FAILED and returns an error
 * ActionResult. No dangling PENDING/COMPLETED rows without cloud assets.
 *
 * Uses direct (opts?) signature — NOT useActionState form-action signature.
 * UI must use useTransition / startTransition with transition.isPending.
 */
export async function createBackup(
  opts?: { source?: BackupSource }
): Promise<ActionResult<{ id: string; filename: string; sizeBytes: number; cloudUploadOk: boolean }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_BACKUP_RESTORE", async () => {
    // Pre-check encryption key
    const keyHex = validateEncryptionKey();

    const source = opts?.source ?? "MANUAL";
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const filename = `siko-mendo-backup-${timestamp}.enc`;

    // Create BackupRecord row (PENDING/optimistic COMPLETED)
    const record = await prisma.backupRecord.create({
      data: {
        filename,
        cloudinaryUploadStatus: "PENDING",
        backupStatus: "COMPLETED",
        source: source as import("@prisma/client").BackupSource,
        createdById: session!.user.id,
        fileSize: 0,
        publicId: `tmp-${Date.now()}`,
      },
    });

    let tmpPath: string | null = null;

    try {
      // Step 4a: pg_dump
      const { dumpBuffer, tmpPath: dumpTmpPath } = await runPgDump();
      tmpPath = dumpTmpPath;

      // Step 4b: Build asset manifest
      const manifest = await buildAssetManifest(prisma);
      const manifestJson = JSON.stringify(manifest);

      // Step 4c: Encrypt
      const encryptedBuffer = encryptBackup(dumpBuffer, manifestJson, keyHex);

      // Step 4d: Upload to Cloudinary
      const folder = env.CLOUDINARY_BACKUP_FOLDER ?? "siko-mendo/backups";
      const uploaded = await uploadBackupToCloudinary(encryptedBuffer, record.id, { folder });

      // Step 4e: Update record to UPLOADED
      await prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          cloudinaryUploadStatus: "UPLOADED",
          fileSize: uploaded.bytes,
          publicId: uploaded.publicId,
          filename,
        },
      });

      // Step 4f: Audit + revalidate
      await logAudit("BACKUP_CREATE", "BackupRecord", record.id, { filename, sizeBytes: uploaded.bytes, source }, session!.user.id);

      revalidatePath("/settings/backup");

      return {
        id: record.id,
        filename,
        sizeBytes: uploaded.bytes,
        cloudUploadOk: true,
      };
    } catch (err) {
      // Mark FAILED on any pipeline error
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          cloudinaryUploadStatus: "FAILED",
          backupStatus: "FAILED",
          notes: errMsg.slice(0, 1000),
        },
      }).catch(() => {});

      await logAudit("BACKUP_FAILED", "BackupRecord", record.id, { error: errMsg.slice(0, 500) }, session!.user.id).catch(() => {});

      revalidatePath("/settings/backup");
      throw err;
    } finally {
      // Always clean up temp files
      if (tmpPath) await deleteTempFile(tmpPath);
    }
  });
}

// ─── prepareRestoreFromCloudinary ─────────────────────────────────────────────

/**
 * Fetches and decrypts a backup from Cloudinary to inspect it before restoring.
 * Does NOT write to the database.
 */
export async function prepareRestoreFromCloudinary(
  backupId: string
): Promise<ActionResult<BackupDetails>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_BACKUP_RESTORE", async () => {
    const keyHex = validateEncryptionKey();

    const record = await prisma.backupRecord.findUnique({
      where: { id: backupId },
      select: {
        id: true,
        filename: true,
        formatVersion: true,
        createdAt: true,
        fileSize: true,
        publicId: true,
        cloudinaryUploadStatus: true,
        backupStatus: true,
        source: true,
      },
    });

    if (!record || record.cloudinaryUploadStatus !== "UPLOADED") {
      throw new LocalizedError("errors.backups.notFound", "Backup record not found.");
    }

    const signedUrl = getSignedFileUrl(record.publicId, "raw", 300);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      throw new LocalizedError("errors.backups.downloadFailed", "Backup file could not be downloaded.");
    }

    const encryptedBuffer = Buffer.from(await upstream.arrayBuffer());
    const { dumpBuffer, manifestJson } = decryptBackup(encryptedBuffer, keyHex);
    const manifest = parseManifest(manifestJson);

    // Inspect TOC
    let tableCount = 0;
    let tmpPath: string | null = null;
    try {
      const { writeFile, mkdtemp } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");
      const dir = await mkdtemp(join(tmpdir(), "siko-mendo-prep-"));
      tmpPath = join(dir, "inspect.pgcustom");
      await writeFile(tmpPath, dumpBuffer);
      const toc = await pgRestoreList(tmpPath);
      tableCount = toc.filter((e) => e.type === "TABLE" || e.type === "TABLE DATA").length;
    } catch {
      // Non-fatal
    } finally {
      if (tmpPath) await deleteTempFile(tmpPath);
    }

    return {
      backupId: record.id,
      filename: record.filename,
      formatVersion: record.formatVersion,
      createdAt: record.createdAt.toISOString(),
      sizeBytes: record.fileSize,
      tableCount,
      assetCount: manifest.assets.length,
      source: record.source as BackupSource,
    };
  });
}

// ─── executeRestore ───────────────────────────────────────────────────────────

/**
 * Restores a database backup from Cloudinary.
 * Always creates a safety backup first. Requires explicit confirmation.
 */
export async function executeRestore(
  backupId: string,
  confirm: boolean
): Promise<ActionResult<{ restoredId: string; safetyBackupId: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_BACKUP_RESTORE", async () => {
    if (!confirm) {
      throw new LocalizedError(
        "errors.backups.confirmRequired",
        "Restore requires explicit confirmation."
      );
    }

    const keyHex = validateEncryptionKey();

    const record = await prisma.backupRecord.findUnique({
      where: { id: backupId },
      select: { id: true, filename: true, publicId: true, cloudinaryUploadStatus: true, fileSize: true },
    });

    if (!record || (record.cloudinaryUploadStatus !== "UPLOADED" && record.backupStatus !== "RESTORED")) {
      throw new LocalizedError("errors.backups.notFound", "Backup record not found.");
    }

    // Safety backup first
    const safetyResult = await createBackup({ source: "SAFETY" });
    if (!safetyResult.success) {
      throw new LocalizedError(
        "errors.backups.safetyBackupFailed",
        "Could not create a safety backup. Restore aborted."
      );
    }
    const safetyBackupId = safetyResult.data.id;

    // Fetch + decrypt
    const signedUrl = getSignedFileUrl(record.publicId, "raw", 300);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      throw new LocalizedError("errors.backups.downloadFailed", "Backup file could not be downloaded.");
    }

    const encryptedBuffer = Buffer.from(await upstream.arrayBuffer());
    const { dumpBuffer, manifestJson } = decryptBackup(encryptedBuffer, keyHex);
    const manifest = parseManifest(manifestJson);

    // Run pg_restore
    try {
      await runPgRestore(dumpBuffer);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await logAudit("BACKUP_RESTORE_FAILED", "BackupRecord", backupId, { error: errMsg.slice(0, 500), safetyBackupId }, session!.user.id).catch(() => {});
      throw new LocalizedError(
        "errors.backups.restoreFailed",
        "Database restore failed. Your database is unchanged. Restore the safety backup to recover."
      );
    }

    // Verify DB
    try {
      await prisma.$queryRaw`SELECT 1 AS ok`;
      await prisma.employee.count();
    } catch {
      await logAudit("BACKUP_RESTORE_VERIFY_FAILED", "BackupRecord", backupId, { safetyBackupId }, session!.user.id).catch(() => {});
      throw new LocalizedError(
        "errors.backups.restoreVerifyFailed",
        "Restore completed but verification failed. Check the database manually."
      );
    }

    // Mark restored — also force cloudinaryUploadStatus to UPLOADED because the
    // pg_restore just overwrote the DB with an older snapshot where this record
    // may have been PENDING. We know it was uploaded (we just downloaded it), so
    // correct both fields together.
    await prisma.backupRecord.update({
      where: { id: backupId },
      data: {
        backupStatus: "RESTORED",
        cloudinaryUploadStatus: "UPLOADED",
        publicId: record.publicId,
        fileSize: record.fileSize ?? 0,
      },
    }).catch(() => {});

    // Best-effort asset verification (non-blocking)
    verifyAssets(manifest).catch(() => {});

    await logAudit("BACKUP_RESTORE", "BackupRecord", backupId, { safetyBackupId, filename: record.filename }, session!.user.id).catch(() => {});

    revalidatePath("/settings/backup");
    return { restoredId: backupId, safetyBackupId };
  });
}

// ─── executeRestoreFromUpload ──────────────────────────────────────────────────

/**
 * Restores from a previously uploaded and validated file (token from Route Handler).
 * storeUploadEntry / getUploadEntry live in upload-token-store.ts (not "use server")
 * so they can be plain synchronous exports without triggering the async-only rule.
 * Same safety-backup-first semantics as executeRestore.
 */
export async function executeRestoreFromUpload(
  token: string,
  confirm: boolean
): Promise<ActionResult<{ safetyBackupId: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_BACKUP_RESTORE", async () => {
    if (!confirm) {
      throw new LocalizedError(
        "errors.backups.confirmRequired",
        "Restore requires explicit confirmation."
      );
    }

    const entry = getUploadEntry(token);
    if (!entry) {
      throw new LocalizedError(
        "errors.backups.uploadExpired",
        "The uploaded backup session has expired. Please upload the file again."
      );
    }

    // Safety backup first
    const safetyResult = await createBackup({ source: "SAFETY" });
    if (!safetyResult.success) {
      throw new LocalizedError(
        "errors.backups.safetyBackupFailed",
        "Could not create a safety backup. Restore aborted."
      );
    }
    const safetyBackupId = safetyResult.data.id;

    // Read and decrypt the uploaded file
    const keyHex = validateEncryptionKey();
    const { readFile } = await import("fs/promises");
    const encryptedBuffer = await readFile(entry.tmpPath);
    const { dumpBuffer } = decryptBackup(encryptedBuffer, keyHex);

    try {
      await runPgRestore(dumpBuffer);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await logAudit("BACKUP_RESTORE_FAILED", "BackupRecord", token, { error: errMsg.slice(0, 500), safetyBackupId, source: "upload" }, session!.user.id).catch(() => {});
      throw new LocalizedError(
        "errors.backups.restoreFailed",
        "Database restore failed. Your database is unchanged. Restore the safety backup to recover."
      );
    }

    // Cleanup
    await deleteTempFile(entry.tmpPath).catch(() => {});
    removeUploadEntry(token);

    await logAudit("BACKUP_RESTORE", "BackupRecord", token, { safetyBackupId, source: "upload" }, session!.user.id).catch(() => {});

    revalidatePath("/settings/backup");
    return { safetyBackupId };
  });
}
