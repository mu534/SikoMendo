"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";
import { executeRestore, executeRestoreFromUpload } from "@/features/backups/actions";

interface RestoreDialogProps {
  backupId: string;
  filename: string;
  source: "cloudinary" | "upload";
  onClose: () => void;
  onRestored: () => void;
}

export default function RestoreDialog({
  backupId,
  filename,
  source,
  onClose,
  onRestored,
}: RestoreDialogProps) {
  const t = useTranslations("backupRestore");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result =
        source === "cloudinary"
          ? await executeRestore(backupId, true)
          : await executeRestoreFromUpload(backupId, true);

      if (result.success) {
        onRestored();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-900/8 px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-ink-900">{t("confirmRestore")}</h3>
          </div>
          <button onClick={onClose} disabled={isPending} className="text-ink-900/40 hover:text-ink-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-amber-700 rounded-lg bg-amber-50 px-4 py-3">
            {t("restoreWarning")}
          </p>
          <p className="text-sm text-ink-900/70">
            File: <span className="font-mono text-xs text-ink-900">{filename}</span>
          </p>

          {error && (
            <p className="text-sm text-red-700 rounded-lg bg-red-50 px-4 py-3">{error}</p>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 h-4 w-4 rounded border-ink-900/20 text-brand-700"
            />
            <span className="text-sm text-ink-900">{t("confirm")}</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-ink-900/8 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-60"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleRestore}
            disabled={!confirmed || isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {isPending ? t("restoring") : t("restore")}
          </button>
        </div>
      </div>
    </div>
  );
}
