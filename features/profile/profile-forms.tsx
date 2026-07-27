"use client";

import { useActionState, useEffect, useState } from "react";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/features/employees/photo-input";
import { updateOwnProfile, changeOwnPassword } from "./actions";

// ── Update profile form ────────────────────────────────────────────────────────

export function UpdateProfileForm({
  name,
  firstName,
  middleName,
  lastName,
  image,
}: {
  name: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  image?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateOwnProfile, null);

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

  // Best-effort split of the existing combined name, used only as a starting
  // point the first time — firstName/middleName/lastName take priority once saved.
  const [fallbackFirst, ...fallbackRest] = name.trim().split(/\s+/);
  const fallbackLast = fallbackRest.pop() ?? "";
  const fallbackMiddle = fallbackRest.join(" ");

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

      <PhotoInput name="photo" currentName={name} currentUrl={image} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldGroup>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required defaultValue={firstName ?? fallbackFirst ?? ""} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="middleName">Middle name</Label>
          <Input id="middleName" name="middleName" defaultValue={middleName ?? fallbackMiddle} placeholder="Optional" />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required defaultValue={lastName ?? fallbackLast} />
        </FieldGroup>
      </div>

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