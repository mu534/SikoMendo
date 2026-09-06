"use client";

import { useActionState, useEffect, useState } from "react";
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
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast({ type: "success", message: "Backup created successfully." });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast({ type: "error", message: state.error.message });
    }
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [state]);

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
