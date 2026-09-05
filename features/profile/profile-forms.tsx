"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Input, Label, FieldGroup, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/features/employees/photo-input";
import {
  updateOwnProfile,
  changeOwnPassword,
  updateOwnEmployeeInfo,
} from "./actions";
import type { ActionResult } from "@/lib/action-utils";

// ── Shared feedback components ────────────────────────────────────────────────

function SuccessAlert({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      {message}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
    >
      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      {message}
    </div>
  );
}

// ── Update profile form ───────────────────────────────────────────────────────

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
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ name: string; image: string | null }> | null,
    FormData
  >(updateOwnProfile, null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Profile updated successfully.");
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const error = state && !state.success ? state.error.message : null;

  // Best-effort split of the existing combined name — firstName/middleName/lastName
  // take priority once saved via this form.
  const [fallbackFirst, ...fallbackRest] = name.trim().split(/\s+/);
  const fallbackLast = fallbackRest.pop() ?? "";
  const fallbackMiddle = fallbackRest.join(" ");

  return (
    <form action={formAction} className="space-y-5">
      {toast && <SuccessAlert message={toast} />}
      {error && <ErrorAlert message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldGroup>
          <Label htmlFor="firstName">First name (given) <span className="text-red-500">*</span></Label>
          <Input
            id="firstName"
            name="firstName"
            required
            autoComplete="given-name"
            defaultValue={firstName ?? fallbackFirst ?? ""}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="middleName">Father's name <span className="text-red-500">*</span></Label>
          <Input
            id="middleName"
            name="middleName"
            required
            autoComplete="additional-name"
            defaultValue={middleName ?? fallbackMiddle}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="lastName">Grandfather's name <span className="text-red-500">*</span></Label>
          <Input
            id="lastName"
            name="lastName"
            required
            autoComplete="family-name"
            defaultValue={lastName ?? fallbackLast}
          />
        </FieldGroup>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {isPending && (
          <span className="text-xs text-ink-900/40">Updating your name…</span>
        )}
      </div>
    </form>
  );
}

// ── Employee contact info form ────────────────────────────────────────────────

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
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ image: string | null }> | null,
    FormData
  >(updateOwnEmployeeInfo, null);

  // Track the image URL locally so the preview updates immediately after save
  const [currentImage, setCurrentImage] = useState(image);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state?.success) {
      // Update the local photo preview if a new one was returned
      if (state.data.image) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentImage(state.data.image);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Contact information saved.");
      const t = setTimeout(() => setToast(null), 4000);
      // Refresh the layout so the header avatar picks up the new user.image
      router.refresh();
      return () => clearTimeout(t);
    }
  }, [state, router]);

  const error = state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-5">
      {toast && <SuccessAlert message={toast} />}
      {error && <ErrorAlert message={error} />}

      {/* Profile photo */}
      <PhotoInput name="photo" currentName={name} currentUrl={currentImage} />

      {/* Contact details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={phone ?? ""}
            placeholder="+251 9xx xxx xxxx"
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={email ?? ""}
            placeholder="you@example.com"
          />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          autoComplete="street-address"
          defaultValue={address ?? ""}
          placeholder="City, Zone / Woreda"
        />
      </FieldGroup>

      {/* Emergency contact subsection */}
      <div className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
          Emergency Contact
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="emergencyContactName">Full name</Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              autoComplete="name"
              defaultValue={emergencyContactName ?? ""}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
              name="emergencyContactRelationship"
              defaultValue={emergencyContactRelationship ?? ""}
              placeholder="e.g. Spouse, Parent"
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              autoComplete="tel"
              defaultValue={emergencyContactPhone ?? ""}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactAddress">Address</Label>
            <Input
              id="emergencyContactAddress"
              name="emergencyContactAddress"
              defaultValue={emergencyContactAddress ?? ""}
            />
          </FieldGroup>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {isPending && (
          <span className="text-xs text-ink-900/40">Uploading and saving…</span>
        )}
      </div>
    </form>
  );
}

// ── Change password form ──────────────────────────────────────────────────────

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(changeOwnPassword, null);

  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast("Password changed successfully.");
      const t = setTimeout(() => setToast(null), 4000);
      // Reset the form so the fields clear after a successful change
      formRef.current?.reset();
      return () => clearTimeout(t);
    }
  }, [state]);

  const error = state && !state.success ? state.error.message : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {toast && <SuccessAlert message={toast} />}
      {error && <ErrorAlert message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup className="sm:col-span-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
          <FieldError>At least 8 characters</FieldError>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
        </FieldGroup>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? "Changing…" : "Change password"}
        </Button>
        {isPending && (
          <span className="text-xs text-ink-900/40">Verifying…</span>
        )}
      </div>
    </form>
  );
}
