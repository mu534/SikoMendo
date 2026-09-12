import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import {
  getDailyRegister,
} from "@/features/attendance/queries";
import { AttendanceManagementPanel } from "@/features/attendance/admin-management-panel";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam } from "@/lib/utils";

/**
 * Attendance Management — ADMIN only.
 * Admin can check in/out employees and mark/update attendance.
 * Status is determined by the active attendance policy — not manually chosen.
 */
export default async function AttendanceManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("MANAGE_ATTENDANCE");

  const params = await searchParams;
  const today  = getOrgLocalDateString();
  const date   = parseStringParam(params.date) || today;
  const status = parseStringParam(params.status);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(`/attendance/management`);

  const { employees, summary } = await getDailyRegister({ date, status });

  return (
    <AttendanceManagementPanel
      employees={employees}
      summary={summary}
      date={date}
      today={today}
      status={status}
    />
  );
}
