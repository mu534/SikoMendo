import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getDailyRegister } from "@/features/attendance/queries";
import { ReadOnlyRegister } from "@/features/attendance/read-only-register";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam } from "@/lib/utils";

/**
 * Attendance Monitoring for Manager (VIEW_ATTENDANCE required).
 *
 * Managers can view organisation-wide attendance (read-only).
 * They cannot check in or modify another employee's attendance here.
 * Own attendance is managed via /attendance/mine.
 */
export default async function TeamAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_ATTENDANCE");

  // Only MANAGER reaches this page via the nav — other roles have their own routes.
  if (session.user.role !== "MANAGER") {
    redirect("/attendance/monitoring");
  }

  const params = await searchParams;
  const today  = getOrgLocalDateString();
  const date   = parseStringParam(params.date) || today;
  const status = parseStringParam(params.status);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/attendance/team");

  // Manager sees org-wide attendance — read-only, no edit controls
  const { employees, summary } = await getDailyRegister({ date, status });

  return (
    <ReadOnlyRegister
      heading="Attendance Register"
      description="Organisation-wide daily attendance — read only. Use My Attendance to record your own."
      employees={employees}
      summary={summary}
      date={date}
      today={today}
      status={status}
      basePath="/attendance/team"
    />
  );
}
