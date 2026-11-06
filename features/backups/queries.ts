/**
 * features/backups/queries.ts
 *
 * Read-only queries for the BackupRecord model.
 */
import "server-only";
import prisma from "@/lib/prisma";

export async function listBackups() {
  return prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { name: true, username: true },
      },
    },
  });
}

export async function getBackupDetails(id: string) {
  return prisma.backupRecord.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { name: true, username: true },
      },
    },
  });
}
