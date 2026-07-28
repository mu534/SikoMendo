"use client";

import { useActionState, useEffect, useState } from "react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateLeaveEntitlements } from "./actions";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, type LeaveTypeValue } from "./schemas";

export function LeavePolicyForm({ entitlements }: { entitlements: Record<LeaveTypeValue, number | null> }) {
  const [state, formAction, isPending] = useActionState(updateLeaveEntitlements, null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state && (state as { success: boolean }).success) {
      setToast("Leave policy updated.");
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const error =
    state && !(state as { success: boolean }).success
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <form action={formAction} className="space-y-5">
      {toast && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800">
          {toast}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LEAVE_TYPES.map((type) => (
          <FieldGroup key={type}>
            <Label htmlFor={`days_${type}`}>{LEAVE_TYPE_LABELS[type]}</Label>
            <Input
              id={`days_${type}`}
              name={`days_${type}`}
              type="number"
              min={0}
              step={1}
              placeholder="Unlimited"
              defaultValue={entitlements[type] ?? ""}
            />
          </FieldGroup>
        ))}
      </div>
      <p className="text-xs text-ink-900/50">
        Leave a field blank for unlimited (no yearly cap enforced for that leave type).
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save policy"}
      </Button>
    </form>
  );
}
