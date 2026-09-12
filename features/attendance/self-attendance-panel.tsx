"use client";

import { useActionState } from "react";
import {
  LogIn,
  LogOut,
  CalendarCheck,
  Clock,
  CalendarX,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { selfCheckIn, selfCheckOut } from "./self-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import type { getMyAttendanceStats } from "./queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type TodayRecord = {
  id: string;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
  notes: string | null;
} | null;

type HistoryItem = {
  id: string;
  date: Date;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
  notes: string | null;
};

type AttendanceStats = Awaited<ReturnType<typeof getMyAttendanceStats>>;

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  PRESENT:  "success",
  LATE:     "warning",
  HALF_DAY: "warning",
  EXCUSED:  "neutral",
  ON_LEAVE: "brand",
  ABSENT:   "danger",
};

function fmtTime(date: Date | null | undefined): string {
  if (!date) return "—";
  // Display in UTC (the server stores UTC; for EAT display add 3 h)
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(11, 16);
}

// ── Today card ────────────────────────────────────────────────────────────────

function TodayCard({
  todayStr,
  todayRecord,
}: {
  todayStr: string;
  todayRecord: TodayRecord;
}) {
  const [checkInState,  checkInAction,  checkInPending]  = useActionState(selfCheckIn,  null);
  const [checkOutState, checkOutAction, checkOutPending] = useActionState(selfCheckOut, null);

  const hasCheckedIn  = !!todayRecord?.checkIn;
  const hasCheckedOut = !!todayRecord?.checkOut;
  const isOnLeave     = todayRecord?.status === "ON_LEAVE";

  // Parse display date
  const [y, m, d] = todayStr.split("-").map(Number);
  const displayDate = new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-brand-700" />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-ink-900">
              Today&apos;s Attendance
            </h3>
            <p className="mt-0.5 text-sm text-ink-900/55">{displayDate}</p>
          </div>

          {/* Status badge */}
          {isOnLeave ? (
            <Badge tone="brand">On Approved Leave</Badge>
          ) : hasCheckedOut ? (
            <Badge tone="success">Completed</Badge>
          ) : hasCheckedIn ? (
            <Badge tone="warning">Checked In</Badge>
          ) : (
            <Badge tone="neutral">Not Checked In</Badge>
          )}
        </div>

        {/* Times */}
        {(hasCheckedIn || hasCheckedOut) && (
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-900/45">Check-in</p>
              <p className="mt-0.5 font-medium text-ink-900">
                {fmtTime(todayRecord?.checkIn)}
              </p>
            </div>
            {hasCheckedOut && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">Check-out</p>
                <p className="mt-0.5 font-medium text-ink-900">
                  {fmtTime(todayRecord?.checkOut)}
                </p>
              </div>
            )}
          </div>
        )}

        {isOnLeave && (
          <p className="mt-4 text-sm text-ink-900/55">
            You are on approved leave today. Check-in is not available.
          </p>
        )}

        {/* Action buttons */}
        {!isOnLeave && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!hasCheckedIn && (
              <form action={checkInAction}>
                <Button
                  type="submit"
                  disabled={checkInPending}
                  size="md"
                >
                  <LogIn className="h-4 w-4" />
                  {checkInPending ? "Checking in…" : "Check In"}
                </Button>
              </form>
            )}

            {hasCheckedIn && !hasCheckedOut && (
              <form action={checkOutAction}>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={checkOutPending}
                  size="md"
                >
                  <LogOut className="h-4 w-4" />
                  {checkOutPending ? "Checking out…" : "Check Out"}
                </Button>
              </form>
            )}

            {hasCheckedOut && (
              <p className="text-sm text-emerald-700">
                ✓ Attendance recorded for today.
              </p>
            )}

            {/* Inline errors */}
            {checkInState && !checkInState.success && (
              <p role="alert" className="text-sm text-red-600">
                {checkInState.error.message}
              </p>
            )}
            {checkOutState && !checkOutState.success && (
              <p role="alert" className="text-sm text-red-600">
                {checkOutState.error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function SelfAttendancePanel({
  todayStr,
  todayRecord,
  stats,
  historyItems,
  historyTotal,
  historyTotalPages,
  historyPage,
  historyStartDate,
  historyEndDate,
  historyStatus,
  hasEmployee,
  basePath = "/attendance",
}: {
  todayStr: string;
  todayRecord: TodayRecord;
  stats: AttendanceStats | null;
  historyItems: HistoryItem[];
  historyTotal: number;
  historyTotalPages: number;
  historyPage: number;
  historyStartDate: string;
  historyEndDate: string;
  historyStatus: string;
  hasEmployee: boolean;
  basePath?: string;
}) {
  if (!hasEmployee) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">My Attendance</h2>
        </div>
        <Card>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <CalendarDays className="mb-3 h-8 w-8 text-ink-900/30" />
            <p className="font-display text-base font-semibold text-ink-900">
              No employee record linked
            </p>
            <p className="mt-1 max-w-sm text-sm text-ink-900/55">
              Ask your HR Officer to link your account to your employee record to
              use attendance.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">My Attendance</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Check in and out, and view your attendance history.
        </p>
      </div>

      {/* Today's check-in/out card */}
      <TodayCard todayStr={todayStr} todayRecord={todayRecord} />

      {/* Lifetime stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Working days"
            value={stats.totalWorkingDays}
            icon={<CalendarCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Late arrivals"
            value={stats.lateArrivals}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Absences"
            value={stats.absences}
            icon={<CalendarX className="h-5 w-5" />}
          />
          <StatCard
            label="Attendance rate"
            value={stats.attendanceRate !== null ? `${stats.attendanceRate}%` : "—"}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>
      )}

      {/* History table */}
      <Card>
        {/* Filter bar */}
        <form
          action={basePath}
          method="get"
          className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">From</label>
            <Input
              type="date"
              name="start"
              defaultValue={historyStartDate}
              className="w-44"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">To</label>
            <Input
              type="date"
              name="end"
              defaultValue={historyEndDate}
              className="w-44"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">Status</label>
            <Select name="status" defaultValue={historyStatus} className="w-40">
              <option value="">All statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half day</option>
              <option value="EXCUSED">Excused</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="ABSENT">Absent</option>
            </Select>
          </div>
          <button
            type="submit"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
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
            {historyItems.length === 0 && (
              <EmptyRow colSpan={5}>
                <CalendarDays className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No attendance records match your filters.
              </EmptyRow>
            )}
            {historyItems.map((record) => (
              <TR key={record.id}>
                <TD>{formatDate(record.date)}</TD>
                <TD>
                  <Badge tone={STATUS_TONE[record.status] ?? "neutral"}>
                    {record.status.replace(/_/g, " ")}
                  </Badge>
                </TD>
                <TD>{fmtTime(record.checkIn)}</TD>
                <TD>{fmtTime(record.checkOut)}</TD>
                <TD>{record.notes ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <Pagination
          basePath={basePath}
          params={{ start: historyStartDate, end: historyEndDate, status: historyStatus }}
          page={historyPage}
          totalPages={historyTotalPages}
          totalItems={historyTotal}
          pageSize={15}
        />
      </Card>
    </div>
  );
}
