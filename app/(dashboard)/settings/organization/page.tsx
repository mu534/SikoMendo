"use server";

import { requirePermission } from "@/lib/session";
import { getOrgSettings } from "@/features/settings/queries";
import { OrgSettingsForm } from "@/features/settings/org-settings-form";
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default async function OrganizationSettingsPage() {
  await requirePermission("MANAGE_SETTINGS");
  const settings = await getOrgSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          Organisation Settings
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Organisation name, tagline, location, and logo. The logo appears in the sidebar and
          on generated reports.
        </p>
      </div>

      <Card className="max-w-2xl overflow-hidden">
        <div className="h-1 bg-brand-700" />
        <div className="p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Building2 className="h-4 w-4" />
            </div>
            <h3 className="font-display text-base font-semibold text-ink-900">
              Organisation Profile
            </h3>
          </div>
          <OrgSettingsForm settings={settings} />
        </div>
      </Card>
    </div>
  );
}
