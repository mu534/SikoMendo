"use client";

import { useActionState, useEffect, useState } from "react";
import { Input, Label, Select, Textarea, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createContract } from "./actions";
import { CONTRACT_TYPES } from "./schemas";

const TYPE_LABELS: Record<string, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  PROBATION: "Probation",
  INTERNSHIP: "Internship",
};

export function ContractForm({ employeeId, onDone }: { employeeId: string; onDone?: () => void }) {
  const action = createContract.bind(null, employeeId);
  const [state, formAction, isPending] = useActionState(action, null);

  const succeeded = state !== null && (state as { success: boolean }).success === true;
  useEffect(() => {
    if (succeeded) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-5">
      <p className="text-sm font-medium text-ink-900">New Contract</p>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <FieldGroup>
        <Label htmlFor="contractType">Contract Type</Label>
        <Select id="contractType" name="contractType" required defaultValue="">
          <option value="" disabled>
            Select a type…
          </option>
          {CONTRACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" placeholder="Optional — leave blank if open-ended" />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" name="remarks" rows={2} placeholder="Optional" />
      </FieldGroup>

      <p className="text-xs text-ink-900/50">
        If this employee already has an active contract, it will automatically be marked as renewed.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save Contract"}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
