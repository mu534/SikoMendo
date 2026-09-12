"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { getDailyRegister } from "./queries";

type RegisterEmployee = Awaited<ReturnType<typeof getDailyRegister>>["employees"][number];
type Summary         = Awaited<ReturnType<typeof getDailyRegister>>["summary"];

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  PRESENT:  "success",
  LATE:     "warning",
  HALF_DAY: "warning",
  EXCUSED:  "neutral",
  ON_LEAVE: "brand",
  ABSENT:   "danger",
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

/**
 * Read-only daily attendance register.
 *
 * Used by HR Officer (org-wide view) and Manager (team-scoped view).
 * No edit controls, no Mark Present button — display only.
 *
 * The `heading` and `description` props let the page customise the header
 * without duplicating the component.
 */
export function ReadOnlyRegister({
  heading,
  description,
  employees,
  summary,
  date,
  today,
  status,
  basePath = "/attendance",
}: {
  heading: string;
  description: string;
  employees: RegisterEmployee[];
  summary: Summary;
  date: string;
  today: string;
  status: string;
  basePath?: string;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{heading}</h2>
        <p className="mt-1 text-sm text-ink-900/60">{description}</p>
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

      {/* Register card */}
      <Card>
        {/* Date navigation */}
        <div className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
          <Link
            href={`${basePath}?date=${shiftDate(date, -1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <form action={basePath} method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">
                Date
              </label>
              <Input type="date" name="date" defaultValue={date} className="w-44" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">
                Status
              </label>
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
            href={`${basePath}?date=${shiftDate(date, 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>

          {date !== today && (
            <Link
              href={`${basePath}?date=${today}${status ? `&status=${status}` : ""}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Today
            </Link>
          )}
        </div>

        {/* Employee list — read-only rows */}
        {employees.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={status ? "No employees match this filter" : "No employees to show"}
            description={
              status
                ? "Try a different status, or clear the filter."
                : "No active employees are in this view."
            }
          />
        ) : (
          <div>
            {/* Column headers */}
            <div className="hidden border-b border-ink-900/8 px-6 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-900/50 sm:grid sm:grid-cols-[1.8fr_140px_100px_100px_1.2fr]">
              <span>Employee</span>
              <span>Status</span>
              <span>Check In</span>
              <span>Check Out</span>
              <span>Remarks</span>
            </div>

            {employees.map((emp) => {
              const record = emp.attendances[0];
              const fullName = [emp.firstName, emp.middleName, emp.lastName]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={emp.id}
                  className="grid grid-cols-1 items-center gap-3 border-b border-ink-900/6 px-6 py-3 last:border-0 sm:grid-cols-[1.8fr_140px_100px_100px_1.2fr]"
                >
                  {/* Employee cell */}
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={fullName}
                      imageUrl={emp.profileImageUrl ?? undefined}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink-900">{fullName}</p>
                      <p className="text-xs text-ink-900/50">
                        {emp.employeeId}{emp.department ? ` · ${emp.department.name}` : ""}
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
                  <span className="text-sm text-ink-900/60">
                    {toTimeDisplay(record?.checkIn)}
                  </span>

                  {/* Check-out */}
                  <span className="text-sm text-ink-900/60">
                    {toTimeDisplay(record?.checkOut)}
                  </span>

                  {/* Notes */}
                  <span className="truncate text-sm text-ink-900/60">
                    {record?.notes || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Viewing date context */}
      <p className="text-center text-xs text-ink-900/40">
        Showing attendance for {formatDate(new Date(`${date}T00:00:00.000Z`))}
        {date === today ? " (today)" : ""}. This view is read-only.
      </p>
    </div>
  );
}
