"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
import { Pool } from "pg";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);

// ── Tables to include in backup (in dependency order) ───────────────────────
// Sensitive auth internals (Account.password hashes) are included because this
// is an admin-only database backup, not a data export. Passwords are hashed
// and not recoverable from the backup without brute-force.
const BACKUP_TABLES = [
  "department",
  "position",
  "user",
  "employee",
  "employment_history",
  "contract",
  "cooperative",
  "attendance",
  "document",
  "leave_request",
  "leave_entitlement",
  "report",
  "audit_log",
  "org_settings",
  "backup_log",
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function dumpAllTables(): Promise<{ json: string; sizeBytes: number }> {
  // Use the raw pg pool so we can run COPY … TO STDOUT equivalent via SELECT *
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const snapshot: Record<string, unknown[]> = {};

  try {
    for (const table of BACKUP_TABLES) {
      try {
        const result = await client.query(`SELECT * FROM "${table}"`);
        snapshot[table] = result.rows;
      } catch {
        // Table may not exist in older deployments — skip gracefully
        snapshot[table] = [];
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  const json = JSON.stringify(
    {
      version: 1,
      createdAt: new Date().toISOString(),
      tables: snapshot,
    },
    null,
    2
  );

  return { json, sizeBytes: Buffer.byteLength(json, "utf8") };
}

// ── Server action ────────────────────────────────────────────────────────────

export async function createBackup(
  _prevState: unknown,
  _formData: FormData
): Promise<ActionResult<{ id: string; sizeBytes: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_SETTINGS", async () => {
    // Insert a PENDING record first so the UI can show it started
    const logId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO backup_log (id, status, "createdById", "createdAt")
      VALUES (${logId}, 'IN_PROGRESS', ${session!.user.id ?? null}, NOW())
    `;

    try {
      // Dump all tables to JSON
      const { json, sizeBytes } = await dumpAllTables();

      // Compress with gzip
      const compressed = await gzip(Buffer.from(json, "utf8"));

      // Build a File object to pass to Cloudinary
      const fileName = `siko-mendo-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json.gz`;
      const file = new File([compressed], fileName, { type: "application/gzip" });

      // Upload as authenticated (private) raw asset
      const asset = await uploadToCloudinary(file, "siko-mendo/backups", {
        resourceType: "auto",
        access: "authenticated",
      });

      // Mark as COMPLETE
      await prisma.$executeRaw`
        UPDATE backup_log
        SET status = 'COMPLETE',
            "sizeBytes" = ${sizeBytes},
            "fileKey"   = ${asset.publicId},
            "fileUrl"   = ${asset.url}
        WHERE id = ${logId}
      `;

      await prisma.auditLog.create({
        data: {
          action: "CREATE",
          entity: "Backup",
          entityId: logId,
          changes: { sizeBytes, fileName },
          userId: session!.user.id,
        },
      });

      revalidatePath("/settings/backup");
      return { id: logId, sizeBytes };
    } catch (err) {
      // Mark as FAILED
      const msg = err instanceof Error ? err.message : "Unknown error";
      await prisma.$executeRaw`
        UPDATE backup_log SET status = 'FAILED', notes = ${msg} WHERE id = ${logId}
      `;
      await prisma.auditLog.create({
        data: {
          action: "BACKUP_FAILED",
          entity: "Backup",
          entityId: logId,
          changes: { error: msg },
          userId: session!.user.id,
        },
      });
      revalidatePath("/settings/backup");
      throw new Error(`Backup failed: ${msg}`);
    }
  });
}

export async function deleteBackupRecord(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_SETTINGS", async () => {
    // Fetch the record
    const rows = await prisma.$queryRaw<
      Array<{ fileKey: string | null }>
    >`SELECT "fileKey" FROM backup_log WHERE id = ${id} LIMIT 1`;

    if (!rows.length) throw new Error("Backup record not found.");

    const { fileKey } = rows[0];

    // Delete from Cloudinary if a file was uploaded
    if (fileKey) {
      await deleteFromCloudinary(fileKey, "raw");
    }

    await prisma.$executeRaw`DELETE FROM backup_log WHERE id = ${id}`;

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Backup",
        entityId: id,
        changes: {},
        userId: session!.user.id,
      },
    });

    revalidatePath("/settings/backup");
    return { id };
  });
}
