"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { forceChangePassword } from "./actions";

type ActionState = { success: true; data: null } | { success: false; error: { message: string } } | null;

export function ForcePasswordChangeForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(forceChangePassword, null);
  const typedState = state as ActionState;

  useEffect(() => {
    if (typedState?.success) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [typedState, router]);

  const errorMessage = typedState && typedState.success === false ? typedState.error.message : null;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="font-display mt-5 text-2xl font-semibold text-ink-900">Set a new password</h1>
        <p className="mt-1.5 text-sm text-ink-900/60">
          For your security, you must set a new password before continuing — enter the temporary
          password you were given, then choose a new one.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {errorMessage && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <FieldGroup>
          <Label htmlFor="currentPassword">Temporary Password</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="newPassword">New Password</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
          <p className="mt-1 text-xs text-ink-900/45">At least 8 characters, with a letter and a number.</p>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
        </FieldGroup>

        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? "Updating…" : "Set new password"}
        </Button>
      </form>
    </div>
  );
}
