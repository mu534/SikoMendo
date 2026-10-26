"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
          Set a new password
        </h1>
        <p className="mt-1.5 text-sm text-ink-900/60">
          For your security, you must set a new password before continuing — enter the
          temporary password you were given, then choose a new one.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <FieldGroup>
          <Label htmlFor="currentPassword">Temporary Password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={busy}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
          />
          <p className="mt-1 text-xs text-ink-900/45">
            At least 8 characters, with a letter and a number.
          </p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
          />
        </FieldGroup>

        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {isPending ? "Updating…" : "Set new password"}
        </Button>
      </form>

      {/* ── Escape hatch ───────────────────────────────────────────────────────
          If the employee forgot their temporary password they have no way to
          proceed. Signing out lets them ask an administrator to reset the
          password, then they can sign in again with the new temp credentials.  */}
      <div className="border-t border-ink-900/8 pt-5">
        <p className="mb-3 text-sm text-ink-900/55">
          Forgot your temporary password? Sign out and ask your administrator to
          reset it for you.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={handleSignOut}
          className="gap-2 text-ink-900/60 hover:text-ink-900"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}
