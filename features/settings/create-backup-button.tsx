"use client";

import { useActionState } from "react";
import { DatabaseBackup } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBackup } from "./backup-actions";
import type { ActionResult } from "@/lib/action-utils";

type BackupResult = ActionResult<{ id: string; sizeBytes: number }>;

export function CreateBackupButton() {
  const [state, formAction, isPending] = useActionState<BackupResult | null, FormData>(
    createBackup,
    null
  );

  // Derive feedback directly from state — no separate useState or useEffect.
  // Message clears automatically when the user submits again (state → null).
  const toast = state
    ? state.success
      ? { type: "success" as const, message: "Backup created successfully." }
      : { type: "error" as const, message: state.error.message }
    : null;

  return (
    <div className="space-y-2">
      {toast && (
        <p
          className={
            toast.type === "success"
              ? "text-sm font-medium text-emerald-700"
              : "text-sm font-medium text-red-700"
          }
        >
          {toast.message}
        </p>
      )}
      <form action={formAction}>
        <Button type="submit" disabled={isPending}>
          <DatabaseBackup className="h-4 w-4" />
          {isPending ? "Creating backup…" : "Create Backup"}
        </Button>
      </form>
    </div>
  );
}
