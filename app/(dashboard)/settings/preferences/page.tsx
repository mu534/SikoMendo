import { requirePermission } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { SlidersHorizontal, ExternalLink } from "lucide-react";
import Link from "next/link";

export default async function SystemPreferencesPage() {
  await requirePermission("MANAGE_SETTINGS");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">System Preferences</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Module-specific configuration is managed within each module.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
        {/* Leave Policy */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-ink-900">Leave Policy</p>
              <p className="mt-0.5 text-xs text-ink-900/55">
                Configure annual leave entitlements by type.
              </p>
              <Link
                href="/leave/policy"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Manage Leave Policy <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>

        {/* Departments */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-ink-900">Departments & Positions</p>
              <p className="mt-0.5 text-xs text-ink-900/55">
                Manage the organisation's department and position structure.
              </p>
              <Link
                href="/departments"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Manage Departments <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>

        {/* User Accounts */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-ink-900">User Accounts</p>
              <p className="mt-0.5 text-xs text-ink-900/55">
                Create and manage system accounts, roles, and access control.
              </p>
              <Link
                href="/users"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Manage Users <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
