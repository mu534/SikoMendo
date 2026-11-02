import Link from "next/link";
import { Clock, CheckCircle2, AlertCircle, XCircle, Coffee } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "./section-header";

type AttendanceRecord = {
  id: string;
  date: Date;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
  notes: string | null;
};

type MonthlyCounts = {
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  excused: number;
};

function formatTime(dt: Date | null): string {
  if (!dt) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(dt));
}

export async function AttendancePanel({
  records,
  counts,
  monthLabel,
  employeeId,
}: {
  records: AttendanceRecord[];
  counts: MonthlyCounts;
  monthLabel: string;
  employeeId: string;
}) {
  const t = await getTranslations("attendance");
  const tC = await getTranslations("common");

  const statusMeta = {
    PRESENT:  { tone: "success" as const, icon: CheckCircle2 },
    LATE:     { tone: "warning" as const, icon: AlertCircle  },
    HALF_DAY: { tone: "warning" as const, icon: Coffee       },
    ABSENT:   { tone: "danger"  as const, icon: XCircle      },
    ON_LEAVE: { tone: "brand"   as const, icon: Clock        },
    EXCUSED:  { tone: "neutral" as const, icon: CheckCircle2 },
  };

  const totalRecorded = Object.values(counts).reduce((a, b) => a + b, 0);

  const countRows = [
    { key: "present",  label: t("statuses.PRESENT"),  color: "text-emerald-600" },
    { key: "late",     label: t("statuses.LATE"),     color: "text-gold-600"   },
    { key: "halfDay",  label: t("statuses.HALF_DAY"), color: "text-gold-500"   },
    { key: "absent",   label: t("statuses.ABSENT"),   color: "text-red-500"    },
    { key: "onLeave",  label: t("statuses.ON_LEAVE"), color: "text-brand-600"  },
    { key: "excused",  label: t("statuses.EXCUSED"),  color: "text-ink-900/50" },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionHeader icon={Clock} title={`${t("title")} — ${monthLabel}`} />

        {totalRecorded === 0 ? (
          <p className="text-sm text-ink-900/40">{t("noAttendance")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {countRows.map(({ key, label, color }) => (
              <div key={key} className="rounded-xl border border-ink-900/6 bg-sand-50 px-3 py-3 text-center">
                <p className={`font-display text-2xl font-semibold ${color}`}>
                  {counts[key as keyof MonthlyCounts]}
                </p>
                <p className="mt-0.5 text-xs text-ink-900/50">{label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-ink-900/8 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-ink-900">{t("title")}</h3>
          <Link href={`/attendance/mine`} className="text-xs font-medium text-brand-700 hover:underline">
            {tC("viewAll")}
          </Link>
        </div>

        {records.length === 0 ? (
          <EmptyState icon={<Clock className="h-7 w-7" />} title={t("noAttendance")} description={t("description")} />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {records.slice(0, 10).map((r) => {
              const meta = statusMeta[r.status as keyof typeof statusMeta] ?? { tone: "neutral" as const, icon: Clock };
              const statusLabel = t(`statuses.${r.status as "PRESENT"|"ABSENT"|"LATE"|"HALF_DAY"|"EXCUSED"|"ON_LEAVE"}`);
              const Icon = meta.icon;

              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      meta.tone === "success" ? "bg-emerald-50 text-emerald-600" :
                      meta.tone === "warning" ? "bg-gold-50 text-gold-600" :
                      meta.tone === "danger"  ? "bg-red-50 text-red-500" :
                      meta.tone === "brand"   ? "bg-brand-50 text-brand-600" :
                      "bg-ink-900/5 text-ink-900/40"
                    }`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-900">{formatDate(r.date)}</p>
                      {r.notes && <p className="text-xs text-ink-900/45 truncate max-w-[200px]">{r.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="text-xs text-ink-900/45">
                        {r.checkIn ? formatTime(r.checkIn) : tC("na")}
                        {r.checkOut ? ` – ${formatTime(r.checkOut)}` : ""}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{statusLabel}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
