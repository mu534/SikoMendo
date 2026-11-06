"use client";

import { useTransition, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DatabaseBackup,
  Download,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime, formatBytes } from "@/lib/utils";
import { createBackup, executeRestore, executeRestoreFromUpload } from "@/features/backups/actions";
import type { listBackups } from "@/features/backups/queries";

type BackupRow = Awaited<ReturnType<typeof listBackups>>[number];

// ─── Status badges ────────────────────────────────────────────────────────────

function UploadStatusBadge({ status }: { status: string }) {
  if (status === "UPLOADED") return <Badge tone="success">Uploaded</Badge>;
  if (status === "FAILED")   return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}

function BackupStatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED")  return <Badge tone="success">Completed</Badge>;
  if (status === "FAILED")     return <Badge tone="danger">Failed</Badge>;
  if (status === "RESTORED")   return <Badge tone="brand">Restored</Badge>;
  if (status === "SUPERSEDED") return <Badge tone="neutral">Superseded</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

function SourceBadge({ source }: { source: string }) {
  if (source === "SAFETY") return <Badge tone="warning">Safety</Badge>;
  if (source === "UPLOAD") return <Badge tone="neutral">Upload</Badge>;
  return <Badge tone="neutral">Manual</Badge>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BackupRestoreManager({ backups }: { backups: BackupRow[] }) {
  const t = useTranslations("backupRestore");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Restore confirmation dialog
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Upload-restore state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [uploadDetails, setUploadDetails] = useState<Record<string, unknown> | null>(null);
  const [confirmUploadRestore, setConfirmUploadRestore] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function clearMessages() {
    setError(null);
    setSuccessMsg(null);
  }

  // ── Create backup ──────────────────────────────────────────────────────────
  function handleCreate() {
    clearMessages();
    startTransition(async () => {
      const result = await createBackup({ source: "MANUAL" });
      if (result.success) {
        setSuccessMsg(`${t("createAndDownload")}: ${result.data.filename} (${formatBytes(result.data.sizeBytes)})`);
        // Trigger download
        window.location.href = `/api/backups/${result.data.id}`;
      } else {
        setError(result.error.message);
      }
    });
  }

  // ── Restore from Cloudinary ────────────────────────────────────────────────
  function handleRestoreClick(id: string) {
    clearMessages();
    setConfirmRestoreId(id);
  }

  function handleRestoreConfirm() {
    if (!confirmRestoreId) return;
    const id = confirmRestoreId;
    setConfirmRestoreId(null);
    startTransition(async () => {
      const result = await executeRestore(id, true);
      if (result.success) {
        setSuccessMsg(t("restoreSuccess"));
      } else {
        setError(result.error.message);
      }
    });
  }

  // ── Upload restore ─────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    clearMessages();
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/backups/restore-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed.");
        return;
      }
      setUploadToken(json.token);
      setUploadDetails(json.details);
      setConfirmUploadRestore(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleUploadRestoreConfirm() {
    if (!uploadToken) return;
    const token = uploadToken;
    setConfirmUploadRestore(false);
    setUploadToken(null);
    startTransition(async () => {
      const result = await executeRestoreFromUpload(token, true);
      if (result.success) {
        setSuccessMsg(t("restoreSuccess"));
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-5">

      {/* Status messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* Create + upload actions */}
      <Card>
        <CardHeader
          title={t("title")}
          description={t("description")}
        />
        <div className="flex flex-wrap gap-3 px-6 py-4">
          <Button
            variant="primary"
            size="md"
            onClick={handleCreate}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DatabaseBackup className="h-4 w-4" />
            )}
            {isPending ? t("creating") : t("createAndDownload")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".enc"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="h-4 w-4" />
            {t("uploadRestore")}
          </Button>
        </div>
        {uploadError && (
          <div className="flex items-center gap-2 border-t border-ink-900/8 px-6 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        )}
        <p className="border-t border-ink-900/8 px-6 py-3 text-xs text-ink-900/50">
          {t("uploadRestoreHint")}
        </p>
      </Card>

      {/* Backup history */}
      <Card>
        <CardHeader
          title={t("title")}
          description={`${backups.length} ${backups.length === 1 ? "backup" : "backups"}`}
        />

        {backups.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <DatabaseBackup className="mx-auto h-8 w-8 text-ink-900/20" />
            <p className="mt-2 text-sm text-ink-900/50">{t("noBackups")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-left text-xs font-medium uppercase tracking-wide text-ink-900/40">
                  <th className="px-6 py-3">{t("title")}</th>
                  <th className="px-6 py-3">{t("createdBy")}</th>
                  <th className="px-6 py-3">{t("fileSize")}</th>
                  <th className="px-6 py-3">{t("cloudStatus")}</th>
                  <th className="px-6 py-3">{t("backupStatus")}</th>
                  <th className="px-6 py-3">{t("source")}</th>
                  <th className="px-6 py-3 text-right">{t("title")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/6">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-sand-50/50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-ink-900">{b.filename}</div>
                      <div className="text-xs text-ink-900/45">{formatDateTime(b.createdAt)}</div>
                    </td>
                    <td className="px-6 py-3 text-ink-900/60">
                      {b.createdBy?.name ?? b.createdBy?.username ?? "—"}
                    </td>
                    <td className="px-6 py-3 tabular-nums text-ink-900/60">
                      {b.fileSize > 0 ? formatBytes(b.fileSize) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <UploadStatusBadge status={b.cloudinaryUploadStatus} />
                    </td>
                    <td className="px-6 py-3">
                      <BackupStatusBadge status={b.backupStatus} />
                    </td>
                    <td className="px-6 py-3">
                      <SourceBadge source={b.source} />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        {b.cloudinaryUploadStatus === "UPLOADED" && b.backupStatus !== "FAILED" && (
                          <a href={`/api/backups/${b.id}`} download>
                            <Button variant="ghost" size="sm">
                              <Download className="h-3.5 w-3.5" />
                              {t("download")}
                            </Button>
                          </a>
                        )}
                        {b.cloudinaryUploadStatus === "UPLOADED" && b.backupStatus !== "FAILED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreClick(b.id)}
                            disabled={isPending}
                          >
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            {t("restore")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Restore confirm dialog */}
      {confirmRestoreId && (
        <ConfirmDialog
          title={t("confirmRestore")}
          message={t("restoreWarning")}
          confirmLabel={t("confirm")}
          cancelLabel={t("cancel")}
          variant="danger"
          onConfirm={handleRestoreConfirm}
          onCancel={() => setConfirmRestoreId(null)}
        />
      )}

      {/* Upload-restore confirm dialog */}
      {confirmUploadRestore && uploadDetails && (
        <ConfirmDialog
          title={t("confirmRestore")}
          message={`${t("restoreWarning")} (${uploadDetails.filename as string}, v${uploadDetails.formatVersion as number})`}
          confirmLabel={t("confirm")}
          cancelLabel={t("cancel")}
          variant="danger"
          onConfirm={handleUploadRestoreConfirm}
          onCancel={() => {
            setConfirmUploadRestore(false);
            setUploadToken(null);
            setUploadDetails(null);
          }}
        />
      )}
    </div>
  );
}
