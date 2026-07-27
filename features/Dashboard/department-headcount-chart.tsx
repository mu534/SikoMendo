"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

type DepartmentPoint = { department: string; count: number };

const BAR_COLORS = ["#2f8350", "#4f9e6e", "#82bf97", "#1c5235", "#226740"];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: DepartmentPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-ink-900/8 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink-900">
        {point.department}: {point.count}
      </p>
    </div>
  );
}

export function DepartmentHeadcountChart({ data }: { data: DepartmentPoint[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No employees yet"
        description="Headcount by department will appear here once employees are added."
        icon={<Users className="h-8 w-8" />}
      />
    );
  }

  const chartHeight = Math.max(160, data.length * 36);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#161a17" strokeOpacity={0.06} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#161a17", opacity: 0.5 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ fontSize: 12, fill: "#161a17", opacity: 0.7 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#161a17", opacity: 0.03 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((entry, index) => (
            <Cell key={entry.department} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
