import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { getLeaveEntitlements } from "@/features/leave/queries";
import { LeavePolicyForm } from "@/features/leave/leave-policy-form";
import { Card } from "@/components/ui/card";

export default async function LeavePolicyPage() {
  await requirePermission("MANAGE_LEAVE_POLICY");
  const entitlements = await getLeaveEntitlements();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leave" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to leave requests
        </Link>
        <h2 className="font-display text-xl font-semibold text-ink-900">Leave Policy</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Set how many days per calendar year each leave type allows, org-wide. Employees requesting
          more than their remaining balance for a type will be blocked at submission.
        </p>
      </div>

      <Card className="max-w-2xl p-6">
        <LeavePolicyForm entitlements={entitlements} />
      </Card>
    </div>
  );
}
