"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/features/employees/photo-input";
import { updateOwnProfile, changeOwnPassword, updateOwnEmployeeInfo } from "./actions";

// ── Update profile form ────────────────────────────────────────────────────────

export function UpdateProfileForm({
  name,
  firstName,
  middleName,
  lastName,
}: {
  name: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateOwnProfile, null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state && (state as { success: boolean }).success) {
      // Reacting to a useActionState result changing — see the identical
      // pattern elsewhere in this file for why this is a legitimate effect
      // use, not a derived-state anti-pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

// ── Employee contact info form (self-service) ─────────────────────────────────

export function EmployeeContactForm({
  name,
  image,
  phone,
  email,
  address,
  emergencyContactName,
  emergencyContactPhone,
  emergencyContactRelationship,
  emergencyContactAddress,
}: {
  name: string;
  image?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactAddress?: string | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateOwnEmployeeInfo, null);
  // Track the displayed image locally so it updates immediately after save
  const [currentImage, setCurrentImage] = useState(image);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state && (state as { success: boolean }).success) {
      const typedState = state as { success: true; data: { image?: string | null } | null };
      // If a new photo was uploaded, update the local preview immediately
      if (typedState.data?.image) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentImage(typedState.data.image);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Contact information updated successfully.");
      const t = setTimeout(() => setToast(null), 3500);
      // Refresh the server layout so the header avatar picks up the new image
      router.refresh();
      return () => clearTimeout(t);
    }
  }, [state, router]);

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

      <PhotoInput name="photo" currentName={name} currentUrl={currentImage} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" name="phone" defaultValue={phone ?? ""} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={address ?? ""} />
      </FieldGroup>

      <div className="border-t border-ink-900/8 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-900/45">Emergency Contact</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input id="emergencyContactName" name="emergencyContactName" defaultValue={emergencyContactName ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
              name="emergencyContactRelationship"
              defaultValue={emergencyContactRelationship ?? ""}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={emergencyContactPhone ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactAddress">Address</Label>
            <Input id="emergencyContactAddress" name="emergencyContactAddress" defaultValue={emergencyContactAddress ?? ""} />
          </FieldGroup>
        </div>
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
      // Reacting to a useActionState result changing — see the identical
      // pattern above for why this is a legitimate effect use, not a
      // derived-state anti-pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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