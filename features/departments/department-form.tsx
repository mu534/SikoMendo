"use client";

import { useActionState } from "react";
import { Label, Textarea, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type DepartmentFormValues = {
  description?: string | null;
  isActive: boolean;
};

/**
 * Edit-only — department names are fixed at seed time and never editable
 * through the app, so this form only covers description and active status.
 */
export function DepartmentForm({
  action,
  department,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<unknown>;
  department: DepartmentFormValues;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  const errorMessage =
    state && (state as { success: boolean }).success === false
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <form action={formAction} className="space-y-5">
      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <FieldGroup>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={department.description ?? ""} placeholder="Optional" />
      </FieldGroup>

      <label className="flex items-center gap-2 text-sm text-ink-900">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={department.isActive}
          className="h-4 w-4 rounded border-ink-900/25"
        />
        Active
      </label>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
