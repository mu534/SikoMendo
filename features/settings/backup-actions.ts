"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
import { Pool } from "pg";

// ── Tables in dependency order ────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dumpAllTables(): Promise<{ json: string; sizeBytes: number }> {
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

  // Plain JSON — opens correctly in any text editor or browser
  const json = JSON.stringify(
    { version: 1, createdAt: new Date().toISOString(), tables: snapshot },
    null,
    2
  );

  return { json, sizeBytes: Buffer.byteLength(json, "utf8") };
}

// ── Server actions ────────────────────────────────────────────────────────────

export async function createBackup(
  _prevState: unknown,
  _formData: FormData
): Promise<ActionResult<{ id: string; sizeBytes: number }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_SETTINGS", async () => {
    const logId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO backup_log (id, status, "createdById", "createdAt")
      VALUES (${logId}, 'IN_PROGRESS', ${session!.user.id ?? null}, NOW())
    `;

    try {
      const { json, sizeBytes } = await dumpAllTables();

      const fileName = `siko-mendo-backup-${
        new Date().toISOString().slice(0, 19).replace(/:/g, "-")
      }.json`;

      // Upload as plain JSON — human-readable when downloaded
      const file = new File([json], fileName, { type: "application/json" });
      const asset = await uploadToCloudinary(file, "siko-mendo/backups", {
        resourceType: "auto",
        access: "authenticated",
      });

      await prisma.$executeRaw`
        UPDATE backup_log
        SET status      = 'COMPLETE',
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
    const rows = await prisma.$queryRaw<
      Array<{ fileKey: string | null }>
    >`SELECT "fileKey" FROM backup_log WHERE id = ${id} LIMIT 1`;

    if (!rows.length) throw new Error("Backup record not found.");

    const { fileKey } = rows[0];
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
