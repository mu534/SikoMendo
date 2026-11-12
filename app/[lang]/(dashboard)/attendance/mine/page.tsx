import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import {
  getTodayAttendanceBoth,
  getMyAttendanceHistory,
  getMyAttendanceStats,
} from "@/features/attendance/queries";
import { SelfAttendancePanel } from "@/features/attendance/self-attendance-panel";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam, parsePageParam } from "@/lib/utils";

export default async function MyAttendancePage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await routeParams;
  const session = await requireSession();
  await getTranslations("attendance"); // ensures locale is loaded server-side

  const params  = await searchParams;
  const today   = getOrgLocalDateString();

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const startDate = parseStringParam(params.start);
  const endDate   = parseStringParam(params.end);
  const status    = parseStringParam(params.status);
  const page      = parsePageParam(params.page);

  const [todayBoth, historyResult, stats] = employee
    ? await Promise.all([
        getTodayAttendanceBoth(employee.id, today),
        getMyAttendanceHistory({
          employeeId: employee.id,
          startDate:  startDate || undefined,
          endDate:    endDate   || undefined,
          status:     status    || undefined,
          page,
        }),
        getMyAttendanceStats(employee.id),
      ])
    : [{ morning: null, afternoon: null }, { items: [], total: 0, totalPages: 1 }, null];

  return (
    <SelfAttendancePanel
      todayStr={today}
      morningRecord={todayBoth.morning}
      afternoonRecord={todayBoth.afternoon}
      stats={stats}
      historyItems={historyResult.items}
      historyTotal={historyResult.total}
      historyTotalPages={historyResult.totalPages}
      historyPage={page}
      historyStartDate={startDate}
      historyEndDate={endDate}
      historyStatus={status}
      hasEmployee={!!employee}
      basePath={`/${lang}/attendance/mine`}
    />
  );
}
