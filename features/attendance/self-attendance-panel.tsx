"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  LogIn,
  LogOut,
  CalendarCheck,
  Clock,
  CalendarX,
  TrendingUp,
  CalendarDays,
  Sun,
  Sunset,
  CalendarOff,
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

type SessionRecord = {
  id: string;
  session: string;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
  notes: string | null;
} | null;

type HistoryItem = {
  id: string;
  date: Date;
  session: string;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
  notes: string | null;
};

type AttendanceStats = Awaited<ReturnType<typeof getMyAttendanceStats>>;

// ── Status tone map ────────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "brand"> = {
  PRESENT:  "success",
  LATE:     "warning",
  HALF_DAY: "warning",
  EXCUSED:  "neutral",
  ON_LEAVE: "brand",
  ABSENT:   "danger",
  HOLIDAY:  "neutral",
};

function fmtTime(date: Date | null | undefined): string {
  if (!date) return "—";
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(11, 16);
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  sessionLabel,
  sessionKey,
  record,
  onLeaveToday,
  checkInAction,
  checkInPending,
  checkInError,
  checkOutAction,
  checkOutPending,
  checkOutError,
  icon,
}: {
  sessionLabel: string;
  sessionKey: "MORNING" | "AFTERNOON";
  record: SessionRecord;
  onLeaveToday: boolean;
  checkInAction: () => void;
  checkInPending: boolean;
  checkInError: string | null;
  checkOutAction: () => void;
  checkOutPending: boolean;
  checkOutError: string | null;
  icon: React.ReactNode;
}) {
  const tC = useTranslations("common");
  const t  = useTranslations("attendance");

  const hasCheckedIn  = !!record?.checkIn;
  const hasCheckedOut = !!record?.checkOut;
  // ON_LEAVE is true when the DB row says so OR when the page confirmed today is leave
  const isOnLeave     = record?.status === "ON_LEAVE" || onLeaveToday;
  const isHoliday     = record?.status === "HOLIDAY";

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-brand-700/60" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-display text-sm font-semibold text-ink-900">{sessionLabel}</h4>
          </div>
          {/* Show ON_LEAVE badge even when no DB row exists yet */}
          {isOnLeave && !record ? (
            <Badge tone="brand">{t("statuses.ON_LEAVE")}</Badge>
          ) : record ? (
            <Badge tone={STATUS_TONE[record.status] ?? "neutral"}>
              {t(`statuses.${record.status as "PRESENT" | "LATE" | "HALF_DAY" | "EXCUSED" | "ON_LEAVE" | "ABSENT" | "HOLIDAY"}`)}
            </Badge>
          ) : (
            <Badge tone="neutral">{tC("none")}</Badge>
          )}
        </div>

        {(hasCheckedIn || hasCheckedOut) && (
          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-900/45">{t("checkIn")}</p>
              <p className="mt-0.5 font-medium text-ink-900">{fmtTime(record?.checkIn)}</p>
            </div>
            {hasCheckedOut && (
              <div>
                <p className="text-xs font-medium text-ink-900/45">{t("checkOut")}</p>
                <p className="mt-0.5 font-medium text-ink-900">{fmtTime(record?.checkOut)}</p>
              </div>
            )}
          </div>
        )}

        {/* Leave notice — shown instead of action buttons */}
        {isOnLeave && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5">
            <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <p className="text-xs text-brand-700">
              You are on approved leave today. No check-in is required.
            </p>
          </div>
        )}

        {!isOnLeave && !isHoliday && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!hasCheckedIn && (
              <form action={checkInAction}>
                <input type="hidden" name="_session" value={sessionKey} />
                <Button type="submit" disabled={checkInPending} size="sm">
                  <LogIn className="h-3.5 w-3.5" />
                  {checkInPending ? tC("loading") : t("checkIn")}
                </Button>
              </form>
            )}

            {hasCheckedIn && !hasCheckedOut && (
              <form action={checkOutAction}>
                <Button type="submit" variant="secondary" disabled={checkOutPending} size="sm">
                  <LogOut className="h-3.5 w-3.5" />
                  {checkOutPending ? tC("loading") : t("checkOut")}
                </Button>
              </form>
            )}

            {hasCheckedOut && (
              <p className="text-xs text-emerald-700">{t("statuses.PRESENT")}</p>
            )}

            {checkInError && (
              <p role="alert" className="w-full text-xs text-red-600">{checkInError}</p>
            )}
            {checkOutError && (
              <p role="alert" className="w-full text-xs text-red-600">{checkOutError}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Today sessions block ──────────────────────────────────────────────────────

function TodaySessions({
  todayStr,
  morningRecord,
  afternoonRecord,
  onLeaveToday,
}: {
  todayStr: string;
  morningRecord: SessionRecord;
  afternoonRecord: SessionRecord;
  onLeaveToday: boolean;
}) {
  const [checkInState,  checkInAction,  checkInPending]  = useActionState(selfCheckIn, null);
  const checkOutMorning   = selfCheckOut.bind(null, "MORNING");
  const checkOutAfternoon = selfCheckOut.bind(null, "AFTERNOON");
  const [checkOutMorningState,   checkOutMorningAction,   checkOutMorningPending]   = useActionState(checkOutMorning,   null);
  const [checkOutAfternoonState, checkOutAfternoonAction, checkOutAfternoonPending] = useActionState(checkOutAfternoon, null);
  const t = useTranslations("attendance");

  const [y, m, d] = todayStr.split("-").map(Number);
  const displayDate = new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  // The shared check-in action covers both sessions; show its error on whichever
  // card the user tried (or on both if ambiguous — better than showing none).
  const checkInError = checkInState && !checkInState.success
    ? checkInState.error.message
    : null;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-ink-900/60">{displayDate}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SessionCard
          sessionLabel={t("morningSession")}
          sessionKey="MORNING"
          record={morningRecord}
          onLeaveToday={onLeaveToday}
          checkInAction={checkInAction as () => void}
          checkInPending={checkInPending}
          checkInError={checkInError}
          checkOutAction={checkOutMorningAction as () => void}
          checkOutPending={checkOutMorningPending}
          checkOutError={checkOutMorningState && !checkOutMorningState.success ? checkOutMorningState.error.message : null}
          icon={<Sun className="h-4 w-4 text-gold-500" />}
        />
        <SessionCard
          sessionLabel={t("afternoonSession")}
          sessionKey="AFTERNOON"
          record={afternoonRecord}
          onLeaveToday={onLeaveToday}
          checkInAction={checkInAction as () => void}
          checkInPending={checkInPending}
          checkInError={checkInError}
          checkOutAction={checkOutAfternoonAction as () => void}
          checkOutPending={checkOutAfternoonPending}
          checkOutError={checkOutAfternoonState && !checkOutAfternoonState.success ? checkOutAfternoonState.error.message : null}
          icon={<Sunset className="h-4 w-4 text-brand-600" />}
        />
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function SelfAttendancePanel({
  todayStr,
  morningRecord,
  afternoonRecord,
  onLeaveToday,
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
  morningRecord: SessionRecord;
  afternoonRecord: SessionRecord;
  onLeaveToday: boolean;
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
  const t = useTranslations("attendance");
  const tC = useTranslations("common");

  if (!hasEmployee) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">{t("myAttendanceTitle")}</h2>
        </div>
        <Card>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <CalendarDays className="mb-3 h-8 w-8 text-ink-900/30" />
            <p className="font-display text-base font-semibold text-ink-900">{t("noAttendance")}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{t("myAttendanceTitle")}</h2>
        <p className="mt-1 text-sm text-ink-900/60">{t("description")}</p>
      </div>

      <TodaySessions
        todayStr={todayStr}
        morningRecord={morningRecord}
        afternoonRecord={afternoonRecord}
        onLeaveToday={onLeaveToday}
      />

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={t("title")} value={stats.totalWorkingDays} icon={<CalendarCheck className="h-5 w-5" />} />
          <StatCard label={t("statuses.LATE")} value={stats.lateArrivals} icon={<Clock className="h-5 w-5" />} />
          <StatCard label={t("statuses.ABSENT")} value={stats.absences} icon={<CalendarX className="h-5 w-5" />} />
          <StatCard
            label={t("title")}
            value={stats.attendanceRate !== null ? `${stats.attendanceRate}%` : tC("na")}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>
      )}

      <Card>
        <form action={basePath} method="get" className="flex flex-wrap items-end gap-3 border-b border-ink-900/8 px-6 py-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">{tC("from")}</label>
            <Input type="date" name="start" defaultValue={historyStartDate} className="w-44" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">{tC("to")}</label>
            <Input type="date" name="end" defaultValue={historyEndDate} className="w-44" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">{t("status")}</label>
            <Select name="status" defaultValue={historyStatus} className="w-40">
              <option value="">{tC("all")}</option>
              <option value="PRESENT">{t("statuses.PRESENT")}</option>
              <option value="LATE">{t("statuses.LATE")}</option>
              <option value="HALF_DAY">{t("statuses.HALF_DAY")}</option>
              <option value="EXCUSED">{t("statuses.EXCUSED")}</option>
              <option value="ON_LEAVE">{t("statuses.ON_LEAVE")}</option>
              <option value="ABSENT">{t("statuses.ABSENT")}</option>
              <option value="HOLIDAY">{t("statuses.HOLIDAY")}</option>
            </Select>
          </div>
          <button type="submit" className="text-sm font-medium text-brand-700 hover:underline">
            {tC("apply")}
          </button>
        </form>

        <Table>
          <THead>
            <TH>{tC("date")}</TH>
            <TH>{t("session")}</TH>
            <TH>{t("status")}</TH>
            <TH>{t("checkIn")}</TH>
            <TH>{t("checkOut")}</TH>
            <TH>{tC("notes")}</TH>
          </THead>
          <TBody>
            {historyItems.length === 0 && (
              <EmptyRow colSpan={6}>
                <CalendarDays className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                {t("noAttendance")}
              </EmptyRow>
            )}
            {historyItems.map((record) => (
              <TR key={record.id}>
                <TD>{formatDate(record.date)}</TD>
                <TD className="text-sm text-ink-900/60">
                  {record.session === "MORNING" ? t("morningSession") : t("afternoonSession")}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[record.status] ?? "neutral"}>
                    {t(`statuses.${record.status as "PRESENT" | "LATE" | "HALF_DAY" | "EXCUSED" | "ON_LEAVE" | "ABSENT" | "HOLIDAY"}`)}
                  </Badge>
                </TD>
                <TD>{fmtTime(record.checkIn)}</TD>
                <TD>{fmtTime(record.checkOut)}</TD>
                <TD>{record.notes ?? tC("na")}</TD>
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
