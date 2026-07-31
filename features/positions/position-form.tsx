"use client";

import { useActionState, useEffect } from "react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createPosition, updatePosition } from "./actions";

export type PositionFormValues = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export function PositionForm({
  departmentId,
  position,
  onDone,
}: {
  departmentId: string;
  position?: PositionFormValues;
  onDone?: () => void;
}) {
  const action = position ? updatePosition.bind(null, position.id) : createPosition;
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
    <form action={formAction} className="space-y-4 rounded-lg border border-ink-900/8 bg-sand-50 p-4">
      <input type="hidden" name="departmentId" value={departmentId} />

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="position-name">Position Name</Label>
          <Input id="position-name" name="name" required defaultValue={position?.name} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="position-description">Description</Label>
          <Input id="position-description" name="description" defaultValue={position?.description ?? ""} placeholder="Optional" />
        </FieldGroup>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-900">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={position?.isActive ?? true}
          className="h-4 w-4 rounded border-ink-900/25"
        />
        Active
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : position ? "Save position" : "Add position"}
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
