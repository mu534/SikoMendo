import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { BulkImportForm } from "@/features/employees/bulk-import-form";

export default async function ImportEmployeesPage() {
  await requirePermission("MANAGE_EMPLOYEES");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/employees" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to employees
        </Link>
        <h2 className="font-display text-xl font-semibold text-ink-900">Import Employees</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Upload a CSV file to validate and preview employee data before importing. Download the
          template to see the expected columns — the <code>department</code> and{" "}
          <code>position</code> values must match an existing active department and position name
          (case-insensitive). All validation errors are shown before anything is saved.
        </p>
      </div>
      <BulkImportForm />
    </div>
  );
}
