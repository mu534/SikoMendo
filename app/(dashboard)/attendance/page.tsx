import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, CalendarCheck, Clock, CalendarX, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
  getDailyRegister,
  getMyAttendanceHistory,
  getMyAttendanceStats,
} from "@/features/attendance/queries";
import { AttendanceRow } from "@/features/attendance/attendance-row";
import { MarkAllPresentButton } from "@/features/attendance/mark-all-present-button";
import { parseStringParam, parsePageParam, formatDate } from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

type EmployeeRow = Awaited<ReturnType<typeof getDailyRegister>>["employees"][number];

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  PRESENT: "success",
  LATE: "warning",
  HALF_DAY: "warning",
  EXCUSED: "neutral",
  ON_LEAVE: "brand",
  ABSENT: "danger",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  if (can(session.user.role, "VIEW_ATTENDANCE")) {
    return <AdminAttendanceRegister role={session.user.role} params={params} />;
  }

  return <MyAttendance userId={session.user.id} params={params} />;
}

// ── Manager / Admin: daily register for everyone ────────────────────────────

async function AdminAttendanceRegister({
  role,
  params,
}: {
  role: Role;
  params: Record<string, string | string[] | undefined>;
}) {
  const canManage = can(role, "MANAGE_ATTENDANCE");

  const today = new Date().toISOString().slice(0, 10);
  const date = parseStringParam(params.date) || today;
  const status = parseStringParam(params.status);

  const { employees, summary } = await getDailyRegister({ date, status });

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Present" value={summary.present} />
        <StatCard label="Late" value={summary.late} />
        <StatCard label="Half day" value={summary.halfDay} />
        <StatCard label="Excused" value={summary.excused} />
        <StatCard label="On leave" value={summary.onLeave} />
        <StatCard label="Absent" value={summary.absent} />
        <StatCard label="Unmarked" value={summary.unmarked} />
      </div>

      {/* Register */}
      <Card>
        {/* Date navigation */}
        <div className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
          <Link
            href={`/attendance?date=${shiftDate(date, -1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <form action="/attendance" method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">Date</label>
              <Input type="date" name="date" defaultValue={date} className="w-44" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">Status</label>
              <Select name="status" defaultValue={status} className="w-40">
                <option value="">All statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half day</option>
                <option value="EXCUSED">Excused</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="ABSENT">Absent</option>
                <option value="UNMARKED">Unmarked</option>
              </Select>
            </div>
          </form>

          <Link
            href={`/attendance?date=${shiftDate(date, 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>

          <Link
            href={`/attendance?date=${today}${status ? `&status=${status}` : ""}`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Today
          </Link>
        </div>

        {/* Employee rows */}
        {employees.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={status ? "No employees match this filter" : "No active employees to show"}
            description={
              status
                ? "Try a different status, or clear the filter to see everyone."
                : "Add employees with Active status to start tracking attendance."
            }
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

// ── Employee: My Attendance ──────────────────────────────────────────────────

async function MyAttendance({
  userId,
  params,
}: {
  userId: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const employee = await prisma.employee.findUnique({ where: { userId } });

  const startDate = parseStringParam(params.start);
  const endDate = parseStringParam(params.end);
  const status = parseStringParam(params.status);
  const page = parsePageParam(params.page);

  const [{ items, total, totalPages }, stats] = employee
    ? await Promise.all([
        getMyAttendanceHistory({ employeeId: employee.id, startDate, endDate, status, page }),
        getMyAttendanceStats(employee.id),
      ])
    : [{ items: [], total: 0, totalPages: 1 }, null];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">My Attendance</h2>
        <p className="mt-1 text-sm text-ink-900/60">View your attendance history and statistics.</p>
      </div>

      {!employee ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No employee record linked yet"
            description="Ask your HR Officer to link your account to your employee record to see attendance here."
          />
        </Card>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Working days" value={stats.totalWorkingDays} icon={<CalendarCheck className="h-5 w-5" />} />
              <StatCard label="Late arrivals" value={stats.lateArrivals} icon={<Clock className="h-5 w-5" />} />
              <StatCard label="Absences" value={stats.absences} icon={<CalendarX className="h-5 w-5" />} />
              <StatCard
                label="Attendance rate"
                value={stats.attendanceRate !== null ? `${stats.attendanceRate}%` : "—"}
                icon={<TrendingUp className="h-5 w-5" />}
              />
            </div>
          )}

          <Card>
            <form action="/attendance" method="get" className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">From</label>
                <Input type="date" name="start" defaultValue={startDate} className="w-44" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">To</label>
                <Input type="date" name="end" defaultValue={endDate} className="w-44" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-900">Status</label>
                <Select name="status" defaultValue={status} className="w-40">
                  <option value="">All statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half day</option>
                  <option value="EXCUSED">Excused</option>
                  <option value="ON_LEAVE">On leave</option>
                  <option value="ABSENT">Absent</option>
                </Select>
              </div>
              <button type="submit" className="text-sm font-medium text-brand-700 hover:underline">
                Apply
              </button>
            </form>

            <Table>
              <THead>
                <TH>Date</TH>
                <TH>Status</TH>
                <TH>Check In</TH>
                <TH>Check Out</TH>
                <TH>Notes</TH>
              </THead>
              <TBody>
                {items.length === 0 && (
                  <EmptyRow colSpan={5}>
                    <CalendarDays className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                    No attendance records match your filters.
                  </EmptyRow>
                )}
                {items.map((record) => (
                  <TR key={record.id}>
                    <TD>{formatDate(record.date)}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[record.status] ?? "neutral"}>{record.status.replace("_", " ")}</Badge>
                    </TD>
                    <TD>{record.checkIn ? new Date(record.checkIn).toISOString().slice(11, 16) : "—"}</TD>
                    <TD>{record.checkOut ? new Date(record.checkOut).toISOString().slice(11, 16) : "—"}</TD>
                    <TD>{record.notes ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <Pagination
              basePath="/attendance"
              params={{ start: startDate, end: endDate, status }}
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={15}
            />
          </Card>
        </>
      )}
    </div>
  );
}
