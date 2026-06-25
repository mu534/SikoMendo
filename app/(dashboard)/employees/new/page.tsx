import { requirePermission } from "@/lib/session";
import { listAssignableCooperatives, listLinkableUsers } from "@/features/employees/queries";
import { createEmployee } from "@/features/employees/actions";
import { EmployeeForm } from "@/features/employees/employee-form";

export default async function NewEmployeePage() {
  await requirePermission("MANAGE_EMPLOYEES");

  const [cooperatives, linkableUsers] = await Promise.all([listAssignableCooperatives(), listLinkableUsers()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New employee record</h2>
        <p className="mt-1 text-sm text-ink-900/60">A business ID (e.g. EMP-0007) is assigned automatically.</p>
      </div>
      <EmployeeForm action={createEmployee} cooperatives={cooperatives} linkableUsers={linkableUsers} />
    </div>
  );
}
