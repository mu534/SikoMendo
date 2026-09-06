import { requirePermission } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Shield, CheckCircle2 } from "lucide-react";

export default async function SecuritySettingsPage() {
  await requirePermission("MANAGE_SETTINGS");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Security</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Current authentication and access-control configuration.
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="font-display text-base font-semibold text-ink-900">
              Authentication
            </h3>
          </div>

          <dl className="space-y-3">
            <SecurityRow label="Authentication provider" value="Better Auth (username + password)" />
            <SecurityRow label="Password hashing" value="bcrypt (managed by Better Auth)" />
            <SecurityRow label="Session management" value="Server-side sessions with auto-expiry" />
            <SecurityRow label="Forced password change" value="Enabled for new accounts" />
            <SecurityRow label="Account suspension" value="Supported — blocks sign-in immediately" />
          </dl>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="font-display text-base font-semibold text-ink-900">
              Access Control
            </h3>
          </div>

          <dl className="space-y-3">
            <SecurityRow label="Role-based access control" value="4 roles: Admin, HR Officer, Manager, Employee" />
            <SecurityRow label="Server-side authorization" value="All mutations verified server-side" />
            <SecurityRow label="Audit logging" value="All significant actions recorded with actor + timestamp" />
            <SecurityRow label="Manager data scope" value="Managers see only their reporting hierarchy" />
          </dl>

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs font-medium text-emerald-800">
              All security controls are enforced server-side. Hiding UI elements is supplementary only.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <dt className="w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-ink-900/45">
        {label}
      </dt>
      <dd className="text-sm text-ink-900/80">{value}</dd>
    </div>
  );
}
