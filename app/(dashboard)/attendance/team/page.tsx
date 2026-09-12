import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getDailyRegisterScoped } from "@/features/attendance/queries";
import { getSubordinateIds } from "@/features/employees/queries";
import { ReadOnlyRegister } from "@/features/attendance/read-only-register";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { parseStringParam } from "@/lib/utils";

/**
 * Team Attendance — Manager (VIEW_ATTENDANCE required).
 * Read-only register scoped to the Manager's reporting hierarchy.
 * Subordinates are resolved server-side — never from client input.
 */
export default async function TeamAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_ATTENDANCE");

  if (session.user.role !== "MANAGER") {
    redirect("/attendance/monitoring");
  }

  const params = await searchParams;
  const today  = getOrgLocalDateString();
  const date   = parseStringParam(params.date) || today;
  const status = parseStringParam(params.status);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(`/attendance/team`);

  // Resolve the manager's own employee record from session — never client input
  const managerEmployee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const allowedIds = managerEmployee
    ? await getSubordinateIds(managerEmployee.id)
    : [];

  if (!managerEmployee) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Team Attendance</h2>
        </div>
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No employee record linked"
            description="Ask HR to link your account to your employee record to see team attendance."
          />
        </Card>
      </div>
    );
  }

  if (allowedIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Team Attendance</h2>
        </div>
        <Card>
          <CardHeader title="Team Attendance" />
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No direct reports"
            description="You have no employees reporting to you yet."
          />
        </Card>
      </div>
    );
  }

  const { employees, summary } = await getDailyRegisterScoped({ date, status, allowedIds });

  return (
    <ReadOnlyRegister
      heading="Team Attendance"
      description="Attendance for employees in your reporting hierarchy — read only. Use My Attendance to record your own."
      employees={employees}
      summary={summary}
      date={date}
      today={today}
      status={status}
      basePath="/attendance/team"
    />
  );
}
