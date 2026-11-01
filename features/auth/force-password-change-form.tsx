"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert, LogOut } from "lucide-react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { forceChangePassword } from "./actions";
import { authClient } from "@/lib/auth-client";

type ActionState =
  | { success: true; data: null }
  | { success: false; error: { message: string } }
  | null;

export function ForcePasswordChangeForm() {
  const router = useRouter();
  const t = useTranslations("auth.forcePasswordChange");
  const tC = useTranslations("common");
  const [state, formAction, isPending] = useActionState(forceChangePassword, null);
  const typedState = state as ActionState;
  const [isSigningOut, startSignOut] = useTransition();

  useEffect(() => {
    if (typedState?.success) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [typedState, router]);

  const errorMessage =
    typedState && typedState.success === false ? typedState.error.message : null;

  function handleSignOut() {
    startSignOut(async () => {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    });
  }

  const busy = isPending || isSigningOut;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="font-display mt-5 text-2xl font-semibold text-ink-900">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-sm text-ink-900/60">{t("subtitle")}</p>
      </div>

      <form action={formAction} className="space-y-5">
        {errorMessage && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <FieldGroup>
          <Label htmlFor="currentPassword">{t("currentPasswordLabel")}</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required disabled={busy} />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} disabled={busy} />
          <p className="mt-1 text-xs text-ink-900/45">{t("helpText")}</p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} disabled={busy} />
        </FieldGroup>

        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </form>

      <div className="border-t border-ink-900/8 pt-5">
        <p className="mb-3 text-sm text-ink-900/55">{t("helpText")}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={handleSignOut}
          className="gap-2 text-ink-900/60 hover:text-ink-900"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isSigningOut ? tC("signingOut") : tC("signOut")}
        </Button>
      </div>
    </div>
  );
}
