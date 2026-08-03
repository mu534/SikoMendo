import { requirePermission } from "@/lib/session";
import { createEmployee } from "@/features/employees/actions";
import { EmployeeForm } from "@/features/employees/employee-form";
import { generateNextEmployeeId } from "@/features/employees/queries";

export default async function NewEmployeePage() {
  await requirePermission("MANAGE_EMPLOYEES");
  const nextId = await generateNextEmployeeId();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New employee record</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Employee ID <span className="font-medium text-ink-900">{nextId}</span> will be assigned automatically on save.
        </p>
      </div>
      <EmployeeForm action={createEmployee} />
    </div>
  );
}
