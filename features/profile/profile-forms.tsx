"use client";

import { useActionState, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
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
    <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      {message}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      {message}
    </div>
  );
}

function RouterRefresher() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
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
  const t = useTranslations("profile");
  const tC = useTranslations("common");

  const didSucceed = state?.success === true;
  const error = state && !state.success ? state.error.message : null;

  const [fallbackFirst, ...fallbackRest] = name.trim().split(/\s+/);
  const fallbackLast = fallbackRest.pop() ?? "";
  const fallbackMiddle = fallbackRest.join(" ");

  return (
    <form action={formAction} className="space-y-5">
      {didSucceed && <SuccessAlert message={t("saveProfile")} />}
      {error && <ErrorAlert message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldGroup>
          <Label htmlFor="firstName">{t("personalInfo")} <span className="text-red-500">*</span></Label>
          <Input id="firstName" name="firstName" required autoComplete="given-name" defaultValue={firstName ?? fallbackFirst ?? ""} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="middleName">{t("personalInfo")} <span className="text-red-500">*</span></Label>
          <Input id="middleName" name="middleName" required autoComplete="additional-name" defaultValue={middleName ?? fallbackMiddle} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="lastName">{t("personalInfo")} <span className="text-red-500">*</span></Label>
          <Input id="lastName" name="lastName" required autoComplete="family-name" defaultValue={lastName ?? fallbackLast} />
        </FieldGroup>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? t("saving") : t("saveProfile")}
        </Button>
        {isPending && <span className="text-xs text-ink-900/40">{tC("loading")}</span>}
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
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ image: string | null }> | null,
    FormData
  >(updateOwnEmployeeInfo, null);
  const t = useTranslations("profile");
  const tC = useTranslations("common");

  const currentImage = (state?.success && state.data.image) ? state.data.image : image;
  const didSucceed = state?.success === true;
  const error = state && !state.success ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-5">
      {didSucceed && <RouterRefresher />}
      {didSucceed && <SuccessAlert message={t("contactInfo")} />}
      {error && <ErrorAlert message={error} />}

      <PhotoInput name="photo" currentName={name} currentUrl={currentImage} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="phone">{tC("name")}</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={phone ?? ""} placeholder="+251 9xx xxx xxxx" />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="email">{tC("name")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={email ?? ""} placeholder="you@example.com" />
        </FieldGroup>
      </div>

      <FieldGroup>
        <Label htmlFor="address">{tC("name")}</Label>
        <Input id="address" name="address" autoComplete="street-address" defaultValue={address ?? ""} />
      </FieldGroup>

      <div className="space-y-4 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
          {t("contactInfo")}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="emergencyContactName">{tC("name")}</Label>
            <Input id="emergencyContactName" name="emergencyContactName" autoComplete="name" defaultValue={emergencyContactName ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactRelationship">{tC("type")}</Label>
            <Input id="emergencyContactRelationship" name="emergencyContactRelationship" defaultValue={emergencyContactRelationship ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactPhone">{tC("name")}</Label>
            <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" autoComplete="tel" defaultValue={emergencyContactPhone ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="emergencyContactAddress">{tC("name")}</Label>
            <Input id="emergencyContactAddress" name="emergencyContactAddress" defaultValue={emergencyContactAddress ?? ""} />
          </FieldGroup>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? t("saving") : t("saveProfile")}
        </Button>
        {isPending && <span className="text-xs text-ink-900/40">{tC("loading")}</span>}
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
  const t = useTranslations("profile");
  const tC = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);

  const didSucceed = state?.success === true;
  const error = state && !state.success ? state.error.message : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {didSucceed && <SuccessAlert message={t("changePassword")} />}
      {error && <ErrorAlert message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup className="sm:col-span-2">
          <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
          <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" key={didSucceed ? "reset" : "active"} />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="newPassword">{t("newPassword")}</Label>
          <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" minLength={8} key={didSucceed ? "reset" : "active"} />
          <FieldError>{tC("optional")}</FieldError>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" minLength={8} key={didSucceed ? "reset" : "active"} />
        </FieldGroup>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isPending} size="md">
          {isPending ? t("changingPassword") : t("changePasswordBtn")}
        </Button>
        {isPending && <span className="text-xs text-ink-900/40">{tC("loading")}</span>}
      </div>
    </form>
  );
}
