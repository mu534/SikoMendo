import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getDailyRegister } from "@/features/attendance/queries";
import { ReadOnlyRegister } from "@/features/attendance/read-only-register";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam } from "@/lib/utils";

/**
 * Attendance Monitoring — HR Officer and Manager (VIEW_ATTENDANCE_MONITOR required).
 * Organisation-wide read-only daily register.
 *
 * Admin does NOT have VIEW_ATTENDANCE_MONITOR — they use /attendance/management instead.
 * HR Officers and Managers both see the full org-wide register here (read-only).
 */
export default async function AttendanceMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // requirePermission redirects Admin (no VIEW_ATTENDANCE_MONITOR) to /dashboard
  await requirePermission("VIEW_ATTENDANCE_MONITOR");

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
