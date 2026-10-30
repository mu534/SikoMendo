import { requireSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import {
  getTodayAttendance,
  getMyAttendanceHistory,
  getMyAttendanceStats,
} from "@/features/attendance/queries";
import { SelfAttendancePanel } from "@/features/attendance/self-attendance-panel";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam, parsePageParam } from "@/lib/utils";

/**
 * My Attendance — available to all authenticated roles.
 * Employee is resolved from the session; never from URL params.
 */
export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params  = await searchParams;
  const today   = getOrgLocalDateString();

  // Derive employee from session — NEVER from any query param or form field
  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const startDate = parseStringParam(params.start);
  const endDate   = parseStringParam(params.end);
  const status    = parseStringParam(params.status);
  const page      = parsePageParam(params.page);

  const [todayRecord, historyResult, stats] = employee
    ? await Promise.all([
        getTodayAttendance(employee.id, today),
        getMyAttendanceHistory({
          employeeId: employee.id,
          startDate:  startDate || undefined,
          endDate:    endDate   || undefined,
          status:     status    || undefined,
          page,
        }),
        getMyAttendanceStats(employee.id),
      ])
    : [null, { items: [], total: 0, totalPages: 1 }, null];

  return (
    <SelfAttendancePanel
      todayStr={today}
      todayRecord={todayRecord}
      stats={stats}
      historyItems={historyResult.items}
      historyTotal={historyResult.total}
      historyTotalPages={historyResult.totalPages}
      historyPage={page}
      historyStartDate={startDate}
      historyEndDate={endDate}
      historyStatus={status}
      hasEmployee={!!employee}
      basePath="/attendance/mine"
    />
  );
}
