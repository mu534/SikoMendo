import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDailyRegister } from "@/features/attendance/queries";
import { AttendanceRow } from "@/features/attendance/attendance-row";
import { MarkAllPresentButton } from "@/features/attendance/mark-all-present-button";
import { parseStringParam } from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";

type EmployeeRow = Awaited<ReturnType<typeof getDailyRegister>>["employees"][number];

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_ATTENDANCE");
  const canManage = can(session.user.role, "MANAGE_ATTENDANCE");

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = parseStringParam(params.date) || today;

  const { employees, summary } = await getDailyRegister({ date });

  const unmarkedIds = employees
    .filter((e: EmployeeRow) => e.attendances.length === 0)
    .map((e: EmployeeRow) => e.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Attendance register</h2>
          <p className="mt-1 text-sm text-ink-900/60">
            {canManage
              ? "Mark and review daily attendance for all active employees."
              : "Daily attendance across Siko Mendo Union."}
          </p>
        </div>
        {canManage && unmarkedIds.length > 0 && (
          <MarkAllPresentButton date={date} employeeIds={unmarkedIds} />
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Present" value={summary.present} />
        <StatCard label="Late" value={summary.late} />
        <StatCard label="Half day" value={summary.halfDay} />
        <StatCard label="Excused" value={summary.excused} />
        <StatCard label="Absent" value={summary.absent} />
        <StatCard label="Unmarked" value={summary.unmarked} />
      </div>

      {/* Register */}
      <Card>
        {/* Date navigation */}
        <div className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
          <Link
            href={`/attendance?date=${shiftDate(date, -1)}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <form action="/attendance" method="get">
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Date</label>
            <Input type="date" name="date" defaultValue={date} className="w-44" />
          </form>

          <Link
            href={`/attendance?date=${shiftDate(date, 1)}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>

          <Link
            href={`/attendance?date=${today}`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Today
          </Link>
        </div>

        {/* Employee rows */}
        {employees.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No active employees to show"
            description="Add employees with Active status to start tracking attendance."
          />
        ) : (
          <div>
            {/* Column headers */}
            <div className="hidden border-b border-ink-900/8 px-6 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-900/50 sm:grid sm:grid-cols-[1.8fr_120px_100px_100px_1.2fr_auto]">
              <span>Employee</span>
              <span>Status</span>
              <span>Check In</span>
              <span>Check Out</span>
              <span>Remarks</span>
              <span />
            </div>
            {employees.map((employee: EmployeeRow) => (
              <AttendanceRow
                key={employee.id}
                employee={employee}
                date={date}
                readOnly={!canManage}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
