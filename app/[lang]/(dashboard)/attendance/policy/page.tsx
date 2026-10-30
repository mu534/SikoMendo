import { requirePermission } from "@/lib/session";
import { getAttendancePolicyRaw } from "@/features/attendance/policy-queries";
import { listShifts, listActiveShifts } from "@/features/attendance/shift-queries";
import { PolicyPageClient } from "@/features/attendance/policy-page-client";

/**
 * Attendance Policy — Admin and General Manager (MANAGE_ATTENDANCE_POLICY).
 *
 * Layout:
 *   Left ~60%  — Work Shifts management + Attendance Rules form
 *   Right ~40% — Read-only overview + live policy preview
 *
 * Policy changes apply to future check-ins only.
 * Historical attendance records are never modified.
 */
export default async function AttendancePolicyPage() {
  await requirePermission("MANAGE_ATTENDANCE_POLICY");

  const [policy, allShifts, activeShifts] = await Promise.all([
    getAttendancePolicyRaw(),
    listShifts(),
    listActiveShifts(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">
          Attendance Policy
        </h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Configure work shifts and attendance rules. Changes apply to future check-ins
          only — historical records are never changed automatically.
        </p>
      </div>

      {/* Two-column layout (client component owns all reactive state) */}
      <PolicyPageClient
        policy={policy}
        allShifts={allShifts}
        activeShifts={activeShifts}
      />
    </div>
  );
}
