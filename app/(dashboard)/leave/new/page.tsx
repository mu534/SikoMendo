import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getEmployeeLeaveBalances } from "@/features/leave/queries";
import { LeaveRequestForm } from "@/features/leave/leave-request-form";

export default async function NewLeaveRequestPage() {
  const session = await requirePermission("MANAGE_OWN_LEAVE");

  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    redirect("/leave");
  }

  const balances = await getEmployeeLeaveBalances(employee.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New leave request</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Total days are calculated automatically from your start and end dates.
        </p>
      </div>
      <LeaveRequestForm balances={balances} />
    </div>
  );
}
