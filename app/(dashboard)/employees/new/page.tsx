import { requirePermission } from "@/lib/session";
import { createEmployee } from "@/features/employees/actions";
import { EmployeeForm } from "@/features/employees/employee-form";
import { generateNextEmployeeId, listAssignableManagers } from "@/features/employees/queries";
import { listActiveDepartments } from "@/features/departments/queries";
import { listActivePositions } from "@/features/positions/queries";

export default async function NewEmployeePage() {
  await requirePermission("MANAGE_EMPLOYEES");

  // For a new employee we allow any active non-archived employee as a potential manager.
  // We use a placeholder "new" id so listAssignableManagers returns all active employees.
  const [nextId, departments, positions, managers] = await Promise.all([
    generateNextEmployeeId(),
    listActiveDepartments(),
    listActivePositions(),
    // "new" is not a real cuid so no employees are excluded — returns the full active list
    listAssignableManagers("new"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New employee record</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Employee ID <span className="font-medium text-ink-900">{nextId}</span> will be assigned automatically on save.
        </p>
      </div>
      <EmployeeForm
        action={createEmployee}
        departments={departments}
        positions={positions}
        managers={managers}
      />
    </div>
  );
}
