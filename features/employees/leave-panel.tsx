import Link from "next/link";
import { Calendar, CheckCircle2, Clock, XCircle, MinusCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "./section-header";
import type { LeaveBalanceEntry } from "@/features/leave/queries";

type LeaveRequest = {
  id: string;
  leaveId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: string;
  reason: string;
  appliedDate: Date;
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL:    "Annual Leave",
  SICK:      "Sick Leave",
  EMERGENCY: "Emergency Leave",
  MATERNITY: "Maternity Leave",
  PATERNITY: "Paternity Leave",
  UNPAID:    "Unpaid Leave",
};

const STATUS_META: Record<string, { tone: "success" | "warning" | "danger" | "neutral" | "brand"; label: string }> = {
  APPROVED:  { tone: "success", label: "Approved"  },
  PENDING:   { tone: "warning", label: "Pending"   },
  REJECTED:  { tone: "danger",  label: "Rejected"  },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

function BalanceBar({ used, entitled }: { used: number; entitled: number | null }) {
  if (entitled === null) return null;
  const pct = entitled > 0 ? Math.min(100, Math.round((used / entitled) * 100)) : 0;
  const overused = used > entitled;
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-900/8">
      <div
        className={`h-full rounded-full transition-all ${overused ? "bg-red-400" : "bg-brand-600"}`}
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function LeavePanel({
  balances,
  recentRequests,
  year,
}: {
  balances: LeaveBalanceEntry[];
  recentRequests: LeaveRequest[];
  year: number;
}) {
  // Only show leave types that have any usage or a configured entitlement
  const relevantBalances = balances.filter((b) => b.used > 0 || b.entitled !== null);

  return (
    <div className="space-y-5">
      {/* Leave balance summary */}
      <Card className="p-5">
        <SectionHeader icon={Calendar} title={`Leave Balances — ${year}`} />

        {relevantBalances.length === 0 ? (
          <p className="text-sm text-ink-900/40">No leave entitlements configured.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relevantBalances.map((b) => {
              const remaining = b.remaining;
              const overused = remaining !== null && remaining < 0;
              return (
                <div
                  key={b.leaveType}
                  className="rounded-xl border border-ink-900/8 bg-white p-4"
                >
                  <p className="text-xs font-medium text-ink-900/55">
                    {LEAVE_TYPE_LABEL[b.leaveType] ?? b.leaveType}
                  </p>
                  {b.entitled === null ? (
                    <p className="mt-1 text-sm text-ink-900/70">
                      <span className="font-semibold text-ink-900">{b.used}</span> days used
                      <span className="ml-2 text-xs text-ink-900/40">(unlimited)</span>
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-ink-900/70">
                        <span className={`font-semibold ${overused ? "text-red-600" : "text-ink-900"}`}>
                          {remaining !== null ? Math.max(0, remaining) : "—"}
                        </span>
                        <span className="text-ink-900/40"> / {b.entitled} days remaining</span>
                      </p>
                      <BalanceBar used={b.used} entitled={b.entitled} />
                      {overused && (
                        <p className="mt-1 text-xs text-red-500">
                          {Math.abs(remaining!)} day{Math.abs(remaining!) !== 1 ? "s" : ""} over limit
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent leave requests */}
      <Card>
        <div className="flex items-center justify-between border-b border-ink-900/8 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-ink-900">Recent Requests</h3>
          <Link href="/leave" className="text-xs font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-7 w-7" />}
            title="No leave requests"
            description="This employee has not submitted any leave requests."
          />
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {recentRequests.map((req) => {
              const meta = STATUS_META[req.status] ?? { tone: "neutral" as const, label: req.status };
              const isSingleDay = req.totalDays === 1;
              const dateRange = isSingleDay
                ? formatDate(req.startDate)
                : `${formatDate(req.startDate)} – ${formatDate(req.endDate)}`;

              return (
                <li key={req.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">
                        {LEAVE_TYPE_LABEL[req.leaveType] ?? req.leaveType}
                      </p>
                      <span className="text-xs text-ink-900/35">{req.leaveId}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-900/50">
                      {dateRange}
                      {" · "}
                      {req.totalDays} day{req.totalDays !== 1 ? "s" : ""}
                    </p>
                    {req.reason && (
                      <p className="mt-0.5 text-xs text-ink-900/40 truncate max-w-[280px]">
                        {req.reason}
                      </p>
                    )}
                  </div>
                  <Badge tone={meta.tone} className="shrink-0">
                    {meta.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
