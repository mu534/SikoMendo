"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarCheck } from "lucide-react";

type TrendPoint = { date: string; label: string; present: number; absent: number; onLeave: number };

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-900/8 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink-900">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5" style={{ color: entry.color }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function AttendanceTrendChart({ data }: { data: TrendPoint[] }) {
  const hasActivity = data.some((d) => d.present > 0 || d.absent > 0 || d.onLeave > 0);

  if (!hasActivity) {
    return (
      <EmptyState
        title="No attendance activity yet"
        description="Once attendance is recorded, a 30-day trend will appear here."
        icon={<CalendarCheck className="h-8 w-8" />}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8350" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2f8350" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="onLeaveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8902a" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#c8902a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#161a17" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#161a17", opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: "#161a17", opacity: 0.5 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="present" name="Present" stroke="#2f8350" strokeWidth={2} fill="url(#presentGradient)" />
        <Area type="monotone" dataKey="onLeave" name="On Leave" stroke="#c8902a" strokeWidth={2} fill="url(#onLeaveGradient)" />
        <Area type="monotone" dataKey="absent" name="Absent" stroke="#dc2626" strokeWidth={2} fill="url(#absentGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}