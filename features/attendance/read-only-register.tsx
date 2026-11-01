"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("attendance");
  const tC = useTranslations("common");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">{heading}</h2>
        <p className="mt-1 text-sm text-ink-900/60">{description}</p>
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
          <Link href={`${basePath}?date=${shiftDate(date, -1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label={tC("previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <form action={basePath} method="get" className="flex flex-wrap items-end gap-3">
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

          <Link href={`${basePath}?date=${shiftDate(date, 1)}${status ? `&status=${status}` : ""}`}
            className="rounded-lg border border-ink-900/15 p-2 hover:bg-sand-100"
            aria-label={tC("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>

          {date !== today && (
            <Link href={`${basePath}?date=${today}${status ? `&status=${status}` : ""}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
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
            <div className="hidden border-b border-ink-900/8 px-6 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-900/50 sm:grid sm:grid-cols-[1.8fr_140px_100px_100px_1.2fr]">
              <span>{t("employee")}</span>
              <span>{t("status")}</span>
              <span>{t("checkIn")}</span>
              <span>{t("checkOut")}</span>
              <span>{tC("notes")}</span>
            </div>

            {employees.map((emp) => {
              const record = emp.attendances[0];
              const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ");

              return (
                <div key={emp.id} className="grid grid-cols-1 items-center gap-3 border-b border-ink-900/6 px-6 py-3 last:border-0 sm:grid-cols-[1.8fr_140px_100px_100px_1.2fr]">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName} imageUrl={emp.profileImageUrl ?? undefined} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-ink-900">{fullName}</p>
                      <p className="text-xs text-ink-900/50">{emp.employeeId}{emp.department ? ` · ${emp.department.name}` : ""}</p>
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
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-ink-900/40">
        {formatDate(new Date(`${date}T00:00:00.000Z`))}{date === today ? ` (${tC("date")})` : ""}
      </p>
    </div>
  );
}
