import { requirePermission } from "@/lib/session";
import { getSignedFileUrl } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
import { formatBytes, formatDateTime } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { CreateBackupButton } from "@/features/settings/create-backup-button";
import { deleteBackupRecord } from "@/features/settings/backup-actions";
import { DatabaseBackup, Download, Trash2, Info } from "lucide-react";

type BackupRow = {
  id: string;
  status: string;
  sizeBytes: bigint | null;
  fileKey: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: Date;
  createdById: string | null;
  creatorName: string | null;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  COMPLETE:    "success",
  IN_PROGRESS: "warning",
  FAILED:      "danger",
  PENDING:     "neutral",
};

export default async function BackupRestorePage() {
  await requirePermission("MANAGE_SETTINGS");

  // Fetch backup history via raw SQL (backup_log not yet in generated client)
  const rows = await prisma.$queryRaw<BackupRow[]>`
    SELECT
      b.id, b.status, b."sizeBytes", b."fileKey", b."fileUrl", b.notes,
      b."createdAt", b."createdById",
      u.name AS "creatorName"
    FROM backup_log b
    LEFT JOIN "user" u ON u.id = b."createdById"
    ORDER BY b."createdAt" DESC
    LIMIT 50
  `;

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Backup &amp; Restore
          </h2>
          <p className="mt-1 text-sm text-ink-900/60">
            Export a full database snapshot. Backups are stored as compressed JSON archives
            on Cloudinary (authenticated / private). Only administrators can create or
            access backups.
          </p>
        </div>
        <CreateBackupButton />
      </div>

      {/* ── Restore guidance ─────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div className="space-y-1 text-sm text-ink-900/70">
            <p className="font-medium text-ink-900">About restoring backups</p>
            <p>
              Backups are full JSON snapshots of every database table. To restore from a backup:
            </p>
            <ol className="ml-4 list-decimal space-y-0.5 text-xs">
              <li>Download the desired backup file below.</li>
              <li>Stop the application server to prevent writes during restore.</li>
              <li>
                Use the companion restore script:{" "}
                <code className="rounded bg-sand-100 px-1 py-0.5 font-mono text-[11px]">
                  npx tsx scripts/restore-backup.ts &lt;backup-file&gt;
                </code>
              </li>
              <li>Verify data integrity, then restart the application.</li>
            </ol>
            <p className="text-xs text-ink-900/50">
              One-click restore is intentionally not available to prevent accidental data
              overwrite on a live system. Always restore to a test environment first.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Backup history ───────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Backup History"
          description={rows.length === 0 ? "No backups created yet." : `${rows.length} backup${rows.length === 1 ? "" : "s"} on record.`}
        />

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TH>Created</TH>
              <TH>Status</TH>
              <TH>Size</TH>
              <TH>Created by</TH>
              <TH>Notes</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <EmptyRow colSpan={6}>
                  <DatabaseBackup className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                  <p>No backups yet. Use &ldquo;Create Backup&rdquo; above.</p>
                </EmptyRow>
              )}

              {rows.map((row) => {
                const downloadUrl =
                  row.status === "COMPLETE" && row.fileKey
                    ? getSignedFileUrl(row.fileKey, "raw")
                    : null;

                return (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-sm text-ink-900/70">
                      {formatDateTime(row.createdAt)}
                    </TD>

                    <TD>
                      <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
                        {row.status}
                      </Badge>
                    </TD>

                    <TD className="text-sm text-ink-900/70">
                      {row.sizeBytes
                        ? formatBytes(Number(row.sizeBytes))
                        : "—"}
                    </TD>

                    <TD className="text-sm text-ink-900/70">
                      {row.creatorName ?? <span className="italic text-ink-900/40">System</span>}
                    </TD>

                    <TD className="max-w-[200px] truncate text-xs text-ink-900/50">
                      {row.notes ?? "—"}
                    </TD>

                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        )}

                        <form
                          action={async () => {
                            "use server";
                            await deleteBackupRecord(row.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            confirmTitle="Delete backup record?"
                            confirmMessage="This will delete the backup file from Cloudinary and remove this record. This cannot be undone."
                            confirmLabel="Delete"
                            variant="ghost"
                            size="sm"
                            pendingLabel="Deleting…"
                            className="text-ink-900/40 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
