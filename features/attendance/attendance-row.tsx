"use client";

import { useActionState } from "react";
import { upsertAttendance } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "EXCUSED", label: "Excused" },
  { value: "ABSENT", label: "Absent" },
];

const STATUS_TONE = {
  PRESENT: "success",
  LATE: "warning",
  HALF_DAY: "warning",
  EXCUSED: "neutral",
  ABSENT: "danger",
} as const;

function toTimeInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(11, 16);
}

type EmployeeWithAttendance = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  profileImageUrl: string | null;
  cooperative: { name: string } | null;
  attendances: { status: string; checkIn: Date | null; checkOut: Date | null; notes: string | null }[];
};

export function AttendanceRow({ employee, date, readOnly }: { employee: EmployeeWithAttendance; date: string; readOnly?: boolean }) {
  const record = employee.attendances[0];

  if (readOnly) {
    return (
      <div className="grid grid-cols-1 items-center gap-3 border-b border-ink-900/6 px-6 py-3 last:border-0 sm:grid-cols-[1.6fr_110px_100px_100px_1.2fr]">
        <EmployeeCell employee={employee} />
        <div>
          {record ? (
            <Badge tone={STATUS_TONE[record.status as keyof typeof STATUS_TONE]}>{record.status}</Badge>
          ) : (
            <Badge tone="neutral">Not marked</Badge>
          )}
        </div>
        <span className="text-sm text-ink-900/60">{toTimeInputValue(record?.checkIn) || "—"}</span>
        <span className="text-sm text-ink-900/60">{toTimeInputValue(record?.checkOut) || "—"}</span>
        <span className="truncate text-sm text-ink-900/60">{record?.notes || "—"}</span>
      </div>
    );
  }

  return <EditableAttendanceRow employee={employee} date={date} record={record} />;
}

function EmployeeCell({ employee }: { employee: EmployeeWithAttendance }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={`${employee.firstName} ${employee.lastName}`} imageUrl={employee.profileImageUrl} size="sm" />
      <div>
        <p className="text-sm font-medium text-ink-900">
          {employee.firstName} {employee.lastName}
        </p>
        <p className="text-xs text-ink-900/50">
          {employee.employeeId} {employee.cooperative ? `· ${employee.cooperative.name}` : ""}
        </p>
      </div>
    </div>
  );
}

function EditableAttendanceRow({
  employee,
  date,
  record,
}: {
  employee: EmployeeWithAttendance;
  date: string;
  record?: { status: string; checkIn: Date | null; checkOut: Date | null; notes: string | null };
}) {
  const [state, formAction, isPending] = useActionState(upsertAttendance, null);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 items-center gap-3 border-b border-ink-900/6 px-6 py-3 last:border-0 sm:grid-cols-[1.6fr_110px_100px_100px_1.2fr_auto]"
    >
      <input type="hidden" name="employeeId" value={employee.id} />
      <input type="hidden" name="date" value={date} />

      <EmployeeCell employee={employee} />

      <Select name="status" defaultValue={record?.status ?? "PRESENT"} className="text-sm">
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>

      <Input type="time" name="checkIn" defaultValue={toTimeInputValue(record?.checkIn)} className="text-sm" />
      <Input type="time" name="checkOut" defaultValue={toTimeInputValue(record?.checkOut)} className="text-sm" />
      <Input name="notes" placeholder="Notes" defaultValue={record?.notes ?? ""} className="text-sm" />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={record ? "outline" : "secondary"} disabled={isPending}>
          {isPending ? "Saving…" : record ? "Update" : "Mark"}
        </Button>
        {state && !state.success && <span className="text-xs text-red-600">{state.error.message}</span>}
        {state?.success && <span className="text-xs text-emerald-600">Saved</span>}
      </div>
    </form>
  );
}
