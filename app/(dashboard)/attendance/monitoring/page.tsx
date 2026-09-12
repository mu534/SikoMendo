import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDailyRegister } from "@/features/attendance/queries";
import { ReadOnlyRegister } from "@/features/attendance/read-only-register";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam } from "@/lib/utils";

/**
 * Attendance Monitoring — HR Officer and Manager (VIEW_ATTENDANCE required).
 * Organisation-wide read-only daily register.
 *
 * Admin has a richer management view at /attendance/management.
 * HR Officers and Managers both land here for read-only org-wide attendance.
 */
export default async function AttendanceMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_ATTENDANCE");

  // Admin uses the management page which has additional controls
  if (can(session.user.role, "MANAGE_ATTENDANCE")) {
    redirect("/attendance/management");
  }

  const params = await searchParams;
  const today  = getOrgLocalDateString();
  const date   = parseStringParam(params.date) || today;
  const status = parseStringParam(params.status);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/attendance/monitoring");

  const { employees, summary } = await getDailyRegister({ date, status });

  return (
    <ReadOnlyRegister
      heading="Attendance Monitoring"
      description="Organisation-wide daily attendance — read only. Use My Attendance to record your own."
      employees={employees}
      summary={summary}
      date={date}
      today={today}
      status={status}
      basePath="/attendance/monitoring"
    />
  );
}
