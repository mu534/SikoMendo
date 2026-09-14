import Link from "next/link";
import { Clock, CheckCircle2, AlertCircle, XCircle, Coffee } from "lucide-react";
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

const STATUS_META: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" | "brand"; icon: React.ElementType }
> = {
  PRESENT:  { label: "Present",   tone: "success",  icon: CheckCircle2 },
  LATE:     { label: "Late",      tone: "warning",  icon: AlertCircle  },
  HALF_DAY: { label: "Half Day",  tone: "warning",  icon: Coffee       },
  ABSENT:   { label: "Absent",    tone: "danger",   icon: XCircle      },
  ON_LEAVE: { label: "On Leave",  tone: "brand",    icon: Clock        },
  EXCUSED:  { label: "Excused",   tone: "neutral",  icon: CheckCircle2 },
};

function formatTime(dt: Date | null): string {
  if (!dt) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(dt));
}

export function AttendancePanel({
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
  const totalRecorded = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Month summary */}
      <Card className="p-5">
        <SectionHeader icon={Clock} title={`Attendance — ${monthLabel}`} />

        {totalRecorded === 0 ? (
          <p className="text-sm text-ink-900/40">No attendance recorded this month.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { key: "present",  label: "Present",   color: "text-emerald-600" },
              { key: "late",     label: "Late",       color: "text-gold-600"   },
              { key: "halfDay",  label: "Half Day",   color: "text-gold-500"   },
              { key: "absent",   label: "Absent",     color: "text-red-500"    },
              { key: "onLeave",  label: "On Leave",   color: "text-brand-600"  },
              { key: "excused",  label: "Excused",    color: "text-ink-900/50" },
            ].map(({ key, label, color }) => (
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

      {/* Recent records */}
      <Card>
        <div className="flex items-center justify-between border-b border-ink-900/8 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-ink-900">Recent Records</h3>
          <Link
            href={`/attendance/mine`}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-7 w-7" />}
            title="No attendance records"
            description="No attendance has been recorded for this employee yet."
          />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {records.slice(0, 10).map((r) => {
              const meta = STATUS_META[r.status] ?? { label: r.status, tone: "neutral" as const, icon: Clock };
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
                      {r.notes && (
                        <p className="text-xs text-ink-900/45 truncate max-w-[200px]">{r.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="text-xs text-ink-900/45">
                        {r.checkIn ? formatTime(r.checkIn) : "—"}
                        {r.checkOut ? ` – ${formatTime(r.checkOut)}` : ""}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
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
