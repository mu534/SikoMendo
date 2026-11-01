"use client";

import { useActionState } from "react";
import { DatabaseBackup } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createBackup } from "./backup-actions";
import type { ActionResult } from "@/lib/action-utils";

type BackupResult = ActionResult<{ id: string; sizeBytes: number }>;

export function CreateBackupButton() {
  const [state, formAction, isPending] = useActionState<BackupResult | null, FormData>(
    createBackup,
    null
  );
  const t = useTranslations("settings");

  const toast = state
    ? state.success
      ? { type: "success" as const, message: t("backup.createBackup") }
      : { type: "error" as const, message: state.error.message }
    : null;

  return (
    <div className="space-y-2">
      {toast && (
        <p className={toast.type === "success" ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-700"}>
          {toast.message}
        </p>
      )}
      <form action={formAction}>
        <Button type="submit" disabled={isPending}>
          <DatabaseBackup className="h-4 w-4" />
          {isPending ? t("backup.creatingBackup") : t("backup.createBackup")}
        </Button>
      </form>
    </div>
  );
}
