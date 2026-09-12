"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LogIn, LogOut, CalendarDays, CheckCheck } from "lucide-react";
import { adminCheckIn, adminCheckOut } from "./admin-actions";
import { markUnmarkedPresent } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { getDailyRegister } from "./queries";

type RegisterEmployee = Awaited<ReturnType<typeof getDailyRegister>>["employees"][number];
type Summary         = Awaited<ReturnType<typeof getDailyRegister>>["summary"];

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  PRESENT: "success", LATE: "warning", HALF_DAY: "warning",
  EXCUSED: "neutral", ON_LEAVE: "brand", ABSENT: "danger",
};

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toTimeDisplay(date: Date | null | undefined): string {
  if (!date) return "—";
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(11, 16);
}

// ── Per-row action cell ────────────────────────────────────────────────────

function AttendanceActionCell({
  employee,
  date,
}: {
  employee: RegisterEmployee;
  date: string;
}) {
  const record = employee.attendances[0];
  const hasCheckedIn  = !!record?.checkIn;
  const hasCheckedOut = !!record?.checkOut;
  const isOnLeave     = record?.status === "ON_LEAVE";
  const [showForm, setShowForm] = useState<"checkIn" | "checkOut" | null>(null);

  const [checkInState,  checkInAction,  checkInPending]  = useActionState(adminCheckIn, null);
  const [checkOutState, checkOutAction, checkOutPending] = useActionState(adminCheckOut, null);

  if (isOnLeave) {
    return <span className="text-xs text-ink-900/40">On leave</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Check-in */}
      {!hasCheckedIn && (
        <>
          {showForm === "checkIn" ? (
            <form action={checkInAction} className="flex items-center gap-2">
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="date" value={date} />
              <Input
                type="time"
                name="checkInTime"
                placeholder="Override time"
                className="w-28 text-xs"
              />
              <Button type="submit" size="sm" disabled={checkInPending}>
                {checkInPending ? "…" : "Check In"}
              </Button>
              <button
                type="button"
                onClick={() => setShowForm(null)}
                className="text-xs text-ink-900/40 hover:text-ink-900"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm("checkIn")}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <LogIn className="h-3 w-3" />
              Check In
            </button>
          )}
          {checkInState && !checkInState.success && (
            <p className="text-xs text-red-600">{checkInState.error.message}</p>
          )}
          {checkInState?.success && (
            <p className="text-xs text-emerald-600">
              Checked in — status determined by policy.
            </p>
          )}
        </>
      )}

      {/* Check-out */}
      {hasCheckedIn && !hasCheckedOut && (
        <>
          {showForm === "checkOut" ? (
            <form action={checkOutAction} className="flex items-center gap-2">
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="date" value={date} />
              <Input
                type="time"
                name="checkOutTime"
                placeholder="Override time"
                className="w-28 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={checkOutPending}>
                {checkOutPending ? "…" : "Check Out"}
              </Button>
              <button
                type="button"
                onClick={() => setShowForm(null)}
                className="text-xs text-ink-900/40 hover:text-ink-900"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm("checkOut")}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-900/55 hover:text-ink-900"
            >
              <LogOut className="h-3 w-3" />
              Check Out
            </button>
          )}
          {checkOutState && !checkOutState.success && (
            <p className="text-xs text-red-600">{checkOutState.error.message}</p>
          )}
        </>
      )}

      {hasCheckedOut && (
        <span className="text-xs text-emerald-600">Complete</span>
      )}
    </div>
  );
}

// ── Bulk mark present button ────────────────────────────────────────────────

function BulkMarkPresentButton({
  date,
  employeeIds,
}: {
  date: string;
  employeeIds: string[];
}) {
  const action = markUnmarkedPresent.bind(null, date, employeeIds);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending || employeeIds.length === 0}
      >
        <CheckCheck className="h-4 w-4" />
        {isPending ? "Marking…" : `Mark ${employeeIds.length} as Present`}
      </Button>
      {state && !state.success && (
        <p className="mt-1 text-xs text-red-600">{state.error.message}</p>
      )}
    </form>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function AttendanceManagementPanel({
  employees,
  summary,
  date,
  today,
  status,
}: {
  employees: RegisterEmployee[];
  summary: Summary;
  date: string;
  today: string;
  status: string;
}) {
  const unmarkedIds = employees
    .filter((e) => e.attendances.length === 0)
    .map((e) => e.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Attendance Management
          </h2>
          <p className="mt-1 text-sm text-ink-900/60">
            Record and manage daily attendance for all active employees.
            Attendance status is determined by the{" "}
            <Link href="/attendance/policy" className="text-brand-700 hover:underline">
              active policy
            </Link>
            .
          </p>
        </div>
        {unmarkedIds.length > 0 && (
          <BulkMarkPresentButton date={date} employeeIds={unmarkedIds} />
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Present"  value={summary.present}  />
        <StatCard label="Late"     value={summary.late}     />
        <StatCard label="Half day" value={summary.halfDay}  />
        <StatCard label="Excused"  value={summary.excused}  />
        <StatCard label="On leave" value={summary.onLeave}  />
        <StatCard label="Absent"   value={summary.absent}   />
        <StatCard label="Unmarked" value={summary.unmarked} />
      </div>

      <Card>
        {/* Date navigation */}
        <div className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
          <Link
            href={`/attendance/management?date=${shiftDate(date, -1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <form action="/attendance/management" method="get" className="flex flex-wrap items-end gap-3">
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
            href={`/attendance/management?date=${shiftDate(date, 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>

          {date !== today && (
            <Link
              href={`/attendance/management?date=${today}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Today
            </Link>
          )}
        </div>

        {/* Employee list */}
        {employees.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={status ? "No employees match this filter" : "No active employees to show"}
            description={
              status
                ? "Try a different status, or clear the filter."
                : "Add employees with Active status to start tracking attendance."
            }
          />
        ) : (
          <div>
            {/* Column headers */}
            <div className="hidden border-b border-ink-900/8 px-6 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-900/50 sm:grid sm:grid-cols-[1.8fr_130px_90px_90px_1fr_160px]">
              <span>Employee</span>
              <span>Status</span>
              <span>Check In</span>
              <span>Check Out</span>
              <span>Notes</span>
              <span>Actions</span>
            </div>

            {employees.map((emp) => {
              const record   = emp.attendances[0];
              const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ");

              return (
                <div
                  key={emp.id}
                  className="grid grid-cols-1 items-start gap-3 border-b border-ink-900/6 px-6 py-3 last:border-0 sm:grid-cols-[1.8fr_130px_90px_90px_1fr_160px]"
                >
                  {/* Employee */}
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={fullName}
                      imageUrl={emp.profileImageUrl ?? undefined}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink-900">{fullName}</p>
                      <p className="text-xs text-ink-900/50">
                        {emp.employeeId}
                        {emp.department ? ` · ${emp.department.name}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    {record ? (
                      <Badge tone={STATUS_TONE[record.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {record.status.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Not marked</Badge>
                    )}
                  </div>

                  {/* Check-in */}
                  <span className="text-sm text-ink-900/60">{toTimeDisplay(record?.checkIn)}</span>

                  {/* Check-out */}
                  <span className="text-sm text-ink-900/60">{toTimeDisplay(record?.checkOut)}</span>

                  {/* Notes */}
                  <span className="truncate text-sm text-ink-900/60">{record?.notes || "—"}</span>

                  {/* Actions */}
                  <AttendanceActionCell employee={emp} date={date} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-ink-900/40">
        Viewing {formatDate(new Date(`${date}T00:00:00.000Z`))}{date === today ? " (today)" : ""}.
        Status is automatically calculated by the attendance policy.
      </p>
    </div>
  );
}
