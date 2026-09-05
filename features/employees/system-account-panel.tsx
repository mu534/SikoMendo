"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  KeyRound,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Label, FieldGroup } from "@/components/ui/field";
import { ROLES, roleLabel } from "@/lib/permissions";
import {
  createEmployeeLoginAccount,
  suspendUserAccount,
  reactivateUserAccount,
  resetUserPassword,
} from "@/features/users/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type LinkedUser = {
  id: string;
  username: string | null;
  role: string;
  banned: boolean;
  mustChangePassword: boolean;
};

type Props = {
  employeeId: string;       // internal cuid (prisma Employee.id)
  employeeCode: string;     // business-facing ID e.g. EMP-0001
  linkedUser: LinkedUser | null;
  canManage: boolean;       // MANAGE_USERS permission
};

// ── No-account state ──────────────────────────────────────────────────────────

function CreateAccountForm({
  employeeId,
  employeeCode,
}: {
  employeeId: string;
  employeeCode: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createEmployeeLoginAccount, null);
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  useEffect(() => {
    if (state?.success) {
      setCredentials({ username: state.data.username, password: state.data.password });
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  const error = state && !state.success ? state.error.message : null;

  async function copyToClipboard(value: string, field: "username" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied((c) => (c === field ? null : c)), 1800);
    } catch {
      // clipboard not available — value is visible in UI
    }
  }

  // After creation show the one-time credentials view
  if (credentials) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <p className="text-xs text-ink-900/70">
            Account created. Share these credentials securely — the password is shown
            once and will never be displayed again. The user must change it on first sign-in.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Username</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-sm font-medium text-ink-900">{credentials.username}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(credentials.username, "username")}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied === "username" ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">
              Temporary password
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-sm font-medium text-ink-900">{credentials.password}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(credentials.password, "password")}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied === "password" ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="employeeId" value={employeeId} />

      <div className="rounded-xl border border-ink-900/8 bg-sand-50 p-4">
        <p className="text-xs text-ink-900/60">
          Username will be set to the Employee ID:{" "}
          <span className="font-mono font-medium text-ink-900">{employeeCode}</span>
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <FieldGroup>
        <Label htmlFor="emp-role">Role</Label>
        <Select id="emp-role" name="role" defaultValue="EMPLOYEE">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Creating…" : "Create login account"}
      </Button>
    </form>
  );
}

// ── Linked-account state ──────────────────────────────────────────────────────

function LinkedAccountPanel({
  user,
  canManage,
}: {
  user: LinkedUser;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSuspend() {
    if (!confirm("Suspend this account? The employee will not be able to sign in.")) return;
    setError(null);
    startTransition(async () => {
      const result = await suspendUserAccount(user.id);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    });
  }

  function handleReactivate() {
    if (!confirm("Reactivate this account?")) return;
    setError(null);
    startTransition(async () => {
      const result = await reactivateUserAccount(user.id);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    });
  }

  function handleResetPassword() {
    if (!confirm("Generate a new temporary password? The current password will stop working immediately.")) return;
    setError(null);
    startTransition(async () => {
      const result = await resetUserPassword(user.id);
      if (result.success) {
        setNewPassword(result.data.password);
      } else {
        setError(result.error.message);
      }
    });
  }

  async function copyPassword() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Account facts */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Username</dt>
          <dd className="mt-1 font-mono text-sm font-medium text-ink-900">
            {user.username ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Role</dt>
          <dd className="mt-1">
            <Badge tone="brand">{roleLabel(user.role)}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-900/45">Status</dt>
          <dd className="mt-1 flex items-center gap-1.5">
            {user.banned
              ? <><ShieldOff className="h-3.5 w-3.5 text-gold-600" /><Badge tone="warning">Suspended</Badge></>
              : <><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /><Badge tone="success">Active</Badge></>}
          </dd>
        </div>
      </dl>

      {user.mustChangePassword && (
        <p className="rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs text-ink-900/70">
          This user must set a new password on their next sign-in.
        </p>
      )}

      {/* New password reveal */}
      {newPassword && (
        <div className="space-y-2 rounded-xl border border-ink-900/8 bg-sand-50 p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <p className="text-xs text-ink-900/70">
              Shown once — share securely. The user will be prompted to set a new password.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-900/45">
              New temporary password
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-sm text-ink-900">{newPassword}</p>
              <Button type="button" variant="ghost" size="sm" onClick={copyPassword}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/users/${user.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Manage account
          </a>

          {!newPassword && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleResetPassword}
            >
              <KeyRound className="h-4 w-4" />
              Reset password
            </Button>
          )}

          {user.banned ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={handleReactivate}
            >
              <ShieldCheck className="h-4 w-4" />
              Reactivate
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleSuspend}
            >
              <ShieldOff className="h-4 w-4" />
              Suspend
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function SystemAccountPanel({ employeeId, employeeCode, linkedUser, canManage }: Props) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between border-b border-ink-900/8 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="font-display text-base font-semibold text-ink-900">System Account</h3>
        </div>
        {!linkedUser && (
          <span className="text-xs text-ink-900/45 italic">No account linked</span>
        )}
      </div>

      {linkedUser ? (
        <LinkedAccountPanel user={linkedUser} canManage={canManage} />
      ) : canManage ? (
        <CreateAccountForm employeeId={employeeId} employeeCode={employeeCode} />
      ) : (
        <p className="text-sm text-ink-900/55 italic">
          No login account has been linked to this employee.
        </p>
      )}
    </Card>
  );
}
