import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { getAttendancePolicyRaw } from "@/features/attendance/policy-queries";
import { PolicyPageClient } from "@/features/attendance/policy-page-client";

/**
 * Attendance Policy — Admin and HR Officer (MANAGE_ATTENDANCE_POLICY).
 *
 * Configures morning and afternoon session times, deadlines, and grace periods.
 * Work Shifts have been removed — sessions now apply globally to all employees.
 *
 * Policy changes apply to future check-ins only.
 * Historical attendance records are never modified.
 */
export default async function AttendancePolicyPage() {
  await requirePermission("MANAGE_ATTENDANCE_POLICY");

  const t = await getTranslations("attendance");

  const policy = await getAttendancePolicyRaw();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {t("policyTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Configure attendance rules for morning and afternoon sessions. Changes apply to
          future check-ins only — historical records are never changed automatically.
        </p>
      </div>

      <PolicyPageClient policy={policy} />
    </div>
  );
}
