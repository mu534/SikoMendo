"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, LogIn, LogOut, CalendarDays, CheckCheck, Edit } from "lucide-react";
import { adminCheckIn, adminCheckOut, correctAbsenceRecord } from "./admin-actions";
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

// ── Correct absence inline form ────────────────────────────────────────────

function CorrectAbsenceForm({
  attendanceId,
  date,
}: {
  attendanceId: string;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(correctAbsenceRecord, null);
  const t = useTranslations("attendance");
  const tC = useTranslations("common");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
      >
        <Edit className="h-3 w-3" />
        {tC("edit")}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-ink-900/15 bg-sand-50 p-2.5 space-y-2">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="attendanceId" value={attendanceId} />
        <input type="hidden" name="date" value={date} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-ink-900/70 mb-0.5">
              {t("checkIn")} <span className="text-red-500">*</span>
            </label>
            <Input type="time" name="checkInTime" required className="w-full text-xs" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-900/70 mb-0.5">
              {t("checkOut")}
            </label>
            <Input type="time" name="checkOutTime" className="w-full text-xs" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-900/70 mb-0.5">
            {tC("notes")} <span className="text-red-500">*</span>
          </label>
          <textarea
            name="correctionNote"
            required
            minLength={5}
            placeholder={tC("notes")}
            rows={2}
            className="w-full rounded-md border border-ink-900/15 bg-white px-2 py-1.5 text-xs text-ink-900 placeholder:text-ink-900/35 focus:outline-none focus:ring-2 focus:ring-brand-700/30 resize-none"
          />
        </div>

        {state && !state.success && (
          <p className="text-xs text-red-600">{state.error.message}</p>
        )}
        {state?.success && (
          <p className="text-xs text-emerald-600">{tC("save")}</p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? tC("saving") : tC("save")}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-ink-900/40 hover:text-ink-900"
          >
            {tC("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
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
  const t = useTranslations("attendance");
  const tC = useTranslations("common");

  const [checkInState,  checkInAction,  checkInPending]  = useActionState(adminCheckIn, null);
  const [checkOutState, checkOutAction, checkOutPending] = useActionState(adminCheckOut, null);

  if (isOnLeave) {
    return <span className="text-xs text-ink-900/40">{t("statuses.ON_LEAVE")}</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {!hasCheckedIn && (
        <>
          {showForm === "checkIn" ? (
            <form action={checkInAction} className="flex items-center gap-2">
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="date" value={date} />
              <Input type="time" name="checkInTime" placeholder={t("checkIn")} className="w-28 text-xs" />
              <Button type="submit" size="sm" disabled={checkInPending}>
                {checkInPending ? tC("loading") : t("checkIn")}
              </Button>
              <button type="button" onClick={() => setShowForm(null)} className="text-xs text-ink-900/40 hover:text-ink-900">
                {tC("cancel")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm("checkIn")}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <LogIn className="h-3 w-3" />
              {t("checkIn")}
            </button>
          )}
          {checkInState && !checkInState.success && (
            <p className="text-xs text-red-600">{checkInState.error.message}</p>
          )}
        </>
      )}

      {hasCheckedIn && !hasCheckedOut && (
        <>
          {showForm === "checkOut" ? (
            <form action={checkOutAction} className="flex items-center gap-2">
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="date" value={date} />
              <Input type="time" name="checkOutTime" placeholder={t("checkOut")} className="w-28 text-xs" />
              <Button type="submit" size="sm" variant="secondary" disabled={checkOutPending}>
                {checkOutPending ? tC("loading") : t("checkOut")}
              </Button>
              <button type="button" onClick={() => setShowForm(null)} className="text-xs text-ink-900/40 hover:text-ink-900">
                {tC("cancel")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm("checkOut")}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-900/55 hover:text-ink-900"
            >
              <LogOut className="h-3 w-3" />
              {t("checkOut")}
            </button>
          )}
          {checkOutState && !checkOutState.success && (
            <p className="text-xs text-red-600">{checkOutState.error.message}</p>
          )}
        </>
      )}

      {hasCheckedOut && (
        <span className="text-xs text-emerald-600">{t("statuses.PRESENT")}</span>
      )}

      {record?.status === "ABSENT" && record?.autoRecorded && !record?.correctionNote && (
        <CorrectAbsenceForm attendanceId={record.id} date={date} />
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
  const t = useTranslations("attendance");
  const tC = useTranslations("common");

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" size="sm" disabled={isPending || employeeIds.length === 0}>
        <CheckCheck className="h-4 w-4" />
        {isPending ? t("markingAllPresent") : `${t("markAllPresent")} (${employeeIds.length})`}
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
  const t = useTranslations("attendance");
  const tC = useTranslations("common");

  const unmarkedIds = employees.filter((e) => e.attendances.length === 0).map((e) => e.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">{t("managementTitle")}</h2>
          <p className="mt-1 text-sm text-ink-900/60">{t("description")}</p>
        </div>
        {unmarkedIds.length > 0 && (
          <BulkMarkPresentButton date={date} employeeIds={unmarkedIds} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label={t("statuses.PRESENT")}  value={summary.present}  />
        <StatCard label={t("statuses.LATE")}     value={summary.late}     />
        <StatCard label={t("statuses.HALF_DAY")} value={summary.halfDay}  />
        <StatCard label={t("statuses.EXCUSED")}  value={summary.excused}  />
        <StatCard label={t("statuses.ON_LEAVE")} value={summary.onLeave}  />
        <StatCard label={t("statuses.ABSENT")}   value={summary.absent}   />
        <StatCard label={tC("none")}             value={summary.unmarked} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
          <Link
            href={`/attendance/management?date=${shiftDate(date, -1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label={tC("previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <form action="/attendance/management" method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">{tC("date")}</label>
              <Input type="date" name="date" defaultValue={date} className="w-44" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-900">{t("status")}</label>
              <Select name="status" defaultValue={status} className="w-40">
                <option value="">{tC("all")}</option>
                <option value="PRESENT">{t("statuses.PRESENT")}</option>
                <option value="LATE">{t("statuses.LATE")}</option>
                <option value="HALF_DAY">{t("statuses.HALF_DAY")}</option>
                <option value="EXCUSED">{t("statuses.EXCUSED")}</option>
                <option value="ON_LEAVE">{t("statuses.ON_LEAVE")}</option>
                <option value="ABSENT">{t("statuses.ABSENT")}</option>
              </Select>
            </div>
          </form>

          <Link
            href={`/attendance/management?date=${shiftDate(date, 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label={tC("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>

          {date !== today && (
            <Link href={`/attendance/management?date=${today}`} className="text-sm font-medium text-brand-700 hover:underline">
              {tC("date")}
            </Link>
          )}
        </div>

        {employees.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={t("noAttendance")}
            description={t("description")}
          />
        ) : (
          <div>
            <div className="hidden border-b border-ink-900/8 px-6 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-900/50 sm:grid sm:grid-cols-[1.8fr_130px_90px_90px_1fr_80px_160px]">
              <span>{t("employee")}</span>
              <span>{t("status")}</span>
              <span>{t("checkIn")}</span>
              <span>{t("checkOut")}</span>
              <span>{tC("notes")}</span>
              <span>{t("recordedBy")}</span>
              <span>{tC("actions")}</span>
            </div>

            {employees.map((emp) => {
              const record   = emp.attendances[0];
              const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ");

              return (
                <div
                  key={emp.id}
                  className="grid grid-cols-1 items-start gap-3 border-b border-ink-900/6 px-6 py-3 last:border-0 sm:grid-cols-[1.8fr_130px_90px_90px_1fr_80px_160px]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName} imageUrl={emp.profileImageUrl ?? undefined} size="sm" version={emp.updatedAt} />
                    <div>
                      <p className="text-sm font-medium text-ink-900">{fullName}</p>
                      <p className="text-xs text-ink-900/50">
                        {emp.employeeId}{emp.department ? ` · ${emp.department.name}` : ""}
                      </p>
                    </div>
                  </div>

                  <div>
                    {record ? (
                      <Badge tone={STATUS_TONE[record.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {t(`statuses.${record.status as "PRESENT" | "LATE" | "HALF_DAY" | "EXCUSED" | "ON_LEAVE" | "ABSENT"}`)}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{tC("none")}</Badge>
                    )}
                  </div>

                  <span className="text-sm text-ink-900/60">{toTimeDisplay(record?.checkIn)}</span>
                  <span className="text-sm text-ink-900/60">{toTimeDisplay(record?.checkOut)}</span>
                  <span className="truncate text-sm text-ink-900/60">{record?.notes || tC("na")}</span>

                  <div>
                    {record?.autoRecorded && !record?.correctionNote ? (
                      <Badge tone="warning">{tC("update")}</Badge>
                    ) : record?.correctionNote ? (
                      <Badge tone="success">{tC("edit")}</Badge>
                    ) : null}
                  </div>

                  <AttendanceActionCell employee={emp} date={date} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-ink-900/40">
        {formatDate(new Date(`${date}T00:00:00.000Z`))}
        {date === today ? ` (${tC("date")})` : ""}
      </p>
    </div>
  );
}
