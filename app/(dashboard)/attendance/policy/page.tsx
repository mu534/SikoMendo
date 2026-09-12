import { requirePermission } from "@/lib/session";
import { getAttendancePolicyRaw } from "@/features/attendance/policy-queries";
import { AttendancePolicyForm } from "@/features/attendance/policy-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Shield } from "lucide-react";

/**
 * Attendance Policy — Admin only (MANAGE_ATTENDANCE_POLICY required).
 * Configure work hours, grace period, and late/half-day thresholds.
 * Changes take effect for future check-ins only — historical records are not altered.
 */
export default async function AttendancePolicyPage() {
  await requirePermission("MANAGE_ATTENDANCE_POLICY");

  const policy = await getAttendancePolicyRaw();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Attendance Policy</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Configure how attendance status is determined. Changes apply to future check-ins only —
          historical records are never changed automatically.
        </p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader
            title="Work Schedule &amp; Rules"
            description="These rules are used to automatically determine whether a check-in is Present, Late, or Half Day."
            action={
              <div className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                <Shield className="h-3.5 w-3.5" />
                Admin &amp; Manager
              </div>
            }
          />
          <div className="p-6">
            <AttendancePolicyForm policy={policy} />
          </div>
        </Card>

        {/* Explanation card */}
        <Card className="mt-4 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-900/40">
            How the rules work
          </p>
          <ul className="mt-3 space-y-2 text-sm text-ink-900/70">
            <li>
              <strong className="text-ink-900">Before or within grace period</strong> →{" "}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Present
              </span>
            </li>
            <li>
              <strong className="text-ink-900">After grace period</strong> (if no half-day threshold) →{" "}
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-medium text-gold-600">
                Late
              </span>
            </li>
            <li>
              <strong className="text-ink-900">After grace period, before half-day threshold</strong> →{" "}
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-medium text-gold-600">
                Late
              </span>
            </li>
            <li>
              <strong className="text-ink-900">At or after half-day threshold</strong> →{" "}
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-medium text-gold-600">
                Half Day
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-900/45">
            Example with work start 08:00, grace period 15 min, half-day threshold 120 min:
            08:00–08:15 = Present · 08:16–10:00 = Late · 10:01+ = Half Day.
          </p>
        </Card>
      </div>
    </div>
  );
}
