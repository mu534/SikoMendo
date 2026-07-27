"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarOff } from "lucide-react";
import type { LeaveStatusValue } from "@/features/leave/schemas";

type LeaveBreakdownPoint = { status: LeaveStatusValue; label: string; count: number };

const STATUS_COLORS: Record<LeaveStatusValue, string> = {
  PENDING: "#c8902a",
  APPROVED: "#2f8350",
  REJECTED: "#dc2626",
  CANCELLED: "#9ca3af",
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-ink-900/8 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink-900">
        {entry.name}: {entry.value}
      </p>
    </div>
  );
}

export function LeaveStatusChart({ data }: { data: LeaveBreakdownPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No leave requests yet"
        description="Submitted leave requests will be broken down by status here."
        icon={<CalendarOff className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-semibold text-ink-900">{total}</span>
          <span className="text-[11px] text-ink-900/50">total</span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {data.map((entry) => (
          <li key={entry.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-ink-900/70">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.status] }} />
              {entry.label}
            </span>
            <span className="font-medium text-ink-900">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
