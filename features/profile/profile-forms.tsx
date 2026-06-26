"use client";

import { useActionState, useEffect, useState } from "react";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateOwnProfile, changeOwnPassword } from "./actions";

// ── Update name form ──────────────────────────────────────────────────────────

export function UpdateProfileForm({ name }: { name: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(updateOwnProfile as any, null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state && (state as { success: boolean }).success) {
      setToast("Profile updated successfully.");
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const error =
    state && !(state as { success: boolean }).success
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <form action={formAction} className="space-y-4">
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

      <FieldGroup>
        <Label htmlFor="profile-name">Full name</Label>
        <Input id="profile-name" name="name" required defaultValue={name} />
      </FieldGroup>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

// ── Change password form ──────────────────────────────────────────────────────

export function ChangePasswordForm() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState(changeOwnPassword as any, null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state && (state as { success: boolean }).success) {
      setToast("Password changed successfully.");
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const error =
    state && !(state as { success: boolean }).success
      ? (state as { error: { message: string } }).error.message
      : null;

  return (
    <form action={formAction} className="space-y-4">
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

      <FieldGroup>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" />
        <FieldError>Must be at least 8 characters</FieldError>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
      </FieldGroup>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
