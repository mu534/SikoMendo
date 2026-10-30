import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { createEmployee } from "@/features/employees/actions";
import { EmployeeForm } from "@/features/employees/employee-form";
import { generateNextEmployeeId, listAssignableManagers } from "@/features/employees/queries";
import { listActiveDepartments } from "@/features/departments/queries";
import { listActivePositions } from "@/features/positions/queries";

export default async function NewEmployeePage() {
  await requirePermission("MANAGE_EMPLOYEES");

  const [nextId, departments, positions, managers] = await Promise.all([
    generateNextEmployeeId(),
    listActiveDepartments(),
    listActivePositions(),
    listAssignableManagers("new"),
  ]);

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/employees"
          className="flex items-center gap-1.5 text-sm text-ink-900/50 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Employees
        </Link>
        <span className="text-ink-900/25">/</span>
        <span className="text-sm text-ink-900/70">New Employee</span>
      </div>

      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700/10 text-brand-700">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">New Employee</h2>
          <p className="mt-0.5 text-sm text-ink-900/55">
            Employee ID{" "}
            <span className="font-medium text-ink-900">{nextId}</span>{" "}
            will be assigned automatically.
            New employees start in <span className="font-medium text-ink-900">Onboarding</span> status
            and must complete the onboarding checklist before becoming active.
          </p>
        </div>
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
