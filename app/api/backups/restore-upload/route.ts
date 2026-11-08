/**
 * POST /api/backups/restore-upload
 *
 * Receives an encrypted backup file upload, validates it, stores it in a temp
 * file, and returns a short-lived token that can be passed to
 * executeRestoreFromUpload(). The actual restore is a separate server-action
 * call requiring explicit confirmation.
 *
 * maxDuration: 300 seconds (file upload + decrypt + inspect)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import { resolveEffectiveRole } from "@/lib/employee-access";
import { env } from "@/lib/env";
import { validateHeader, decryptBackup, parseManifest } from "@/features/backups/backup-format";
import { pgRestoreList, deleteTempFile } from "@/features/backups/pg-tools";
import { storeUploadEntry } from "@/features/backups/upload-token-store";
import { writeFile, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const effectiveRole = await resolveEffectiveRole(session.user.id, session.user.role as Role);
  if (!can(effectiveRole, "MANAGE_BACKUP_RESTORE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keyHex = env.BACKUP_ENCRYPTION_KEY;
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    return NextResponse.json(
      { error: "Backup is not configured: encryption key missing." },
      { status: 500 }
    );
  }

  let tmpPath: string | null = null;

  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const encryptedBuffer = Buffer.from(await file.arrayBuffer());

    // Validate header before writing to disk
    try {
      validateHeader(encryptedBuffer);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid backup file." },
        { status: 400 }
      );
    }

    // Decrypt and validate
    let dumpBuffer: Buffer;
    let manifestJson: string;
    try {
      const decrypted = decryptBackup(encryptedBuffer, keyHex);
      dumpBuffer = decrypted.dumpBuffer;
      manifestJson = decrypted.manifestJson;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Backup is corrupted or key is wrong." },
        { status: 400 }
      );
    }

    // Parse manifest
    let manifest;
    try {
      manifest = parseManifest(manifestJson);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid backup manifest." },
        { status: 400 }
      );
    }

    // Write encrypted file to temp location (executeRestoreFromUpload re-reads + decrypts it)
    const tmpDir = await mkdtemp(join(tmpdir(), "siko-mendo-upload-"));
    tmpPath = join(tmpDir, "upload.enc");
    await writeFile(tmpPath, encryptedBuffer);

    // Inspect TOC (non-fatal)
    let tableCount = 0;
    let inspectTmpPath: string | null = null;
    try {
      const inspectDir = await mkdtemp(join(tmpdir(), "siko-mendo-inspect-"));
      inspectTmpPath = join(inspectDir, "inspect.pgcustom");
      await writeFile(inspectTmpPath, dumpBuffer);
      const toc = await pgRestoreList(inspectTmpPath);
      tableCount = toc.filter((e) => e.type === "TABLE" || e.type === "TABLE DATA").length;
    } catch {
      // Non-fatal — table count just won't show
    } finally {
      if (inspectTmpPath) await deleteTempFile(inspectTmpPath);
    }

    const details = {
      backupId: "upload",
      filename: file.name,
      formatVersion: 2 as const,
      createdAt: manifest.generatedAt,
      sizeBytes: encryptedBuffer.length,
      tableCount,
      assetCount: manifest.assets.length,
      source: "UPLOAD" as const,
    };

    const token = storeUploadEntry(tmpPath, details);
    return NextResponse.json({ token, details });
  } catch (err) {
    if (tmpPath) await deleteTempFile(tmpPath);
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
