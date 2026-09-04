"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, ShieldAlert, ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  resetUserPassword,
  forcePasswordChangeForUser,
  suspendUserAccount,
  reactivateUserAccount,
} from "./actions";

export function AccountSecurityPanel({
  userId,
  isSuspended,
  mustChangePassword,
}: {
  userId: string;
  isSuspended: boolean;
  mustChangePassword: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleReset() {
    if (
      !confirm(
        "Generate a new temporary password for this user? Their current password will stop working immediately."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await resetUserPassword(userId);
      if (result.success) {
        setNewPassword(result.data.password);
      } else {
        setError(result.error.message);
      }
    });
  }

  function handleForceChange() {
    if (!confirm("Force this user to set a new password on their next sign-in?")) return;
    setError(null);
    startTransition(async () => {
      const result = await forcePasswordChangeForUser(userId);
      if (!result.success) setError(result.error.message);
    });
  }

  function handleSuspend() {
    if (
      !confirm(
        "Suspend this account? The user will not be able to sign in until reactivated."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await suspendUserAccount(userId);
      if (!result.success) setError(result.error.message);
    });
  }

  function handleReactivate() {
    if (!confirm("Reactivate this account? The user will be able to sign in again."))
      return;
    setError(null);
    startTransition(async () => {
      const result = await reactivateUserAccount(userId);
      if (!result.success) setError(result.error.message);
    });
  }

  function handleCopy() {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="divide-y divide-ink-900/8 overflow-hidden">
      {/* ── Account status section ─────────────────────────────── */}
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            {isSuspended ? (
              <ShieldOff className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
          </div>
          <h3 className="font-display text-base font-semibold text-ink-900">
            Account Status
          </h3>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {isSuspended ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-900/60">
              This account is <span className="font-medium text-ink-900">suspended</span>. The
              user cannot sign in. Their employee record and historical HR data are unaffected.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={handleReactivate}
            >
              <ShieldCheck className="h-4 w-4" />
              {isPending ? "Reactivating…" : "Reactivate account"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-900/60">
              This account is <span className="font-medium text-ink-900">active</span>. Suspending
              it will prevent sign-in without affecting employee records or HR history.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleSuspend}
            >
              <ShieldOff className="h-4 w-4" />
              {isPending ? "Suspending…" : "Suspend account"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Password section ────────────────────────────────────── */}
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <KeyRound className="h-4 w-4" />
          </div>
          <h3 className="font-display text-base font-semibold text-ink-900">
            Password
          </h3>
        </div>

        {mustChangePassword && !newPassword && (
          <p className="mb-4 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs text-ink-900/70">
            This user must set a new password on their next sign-in.
          </p>
        )}

        {newPassword ? (
          <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
              <p className="text-xs text-ink-900/70">
                Shown once — share it with the user securely. They will be asked to set their
                own password on next sign-in.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">
                New temporary password
              </p>
              <p className="font-mono text-base text-ink-900">{newPassword}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleReset}
            >
              Reset password
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending || mustChangePassword}
              onClick={handleForceChange}
            >
              Force password change
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
