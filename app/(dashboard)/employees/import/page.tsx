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
          Upload a CSV file to create multiple employee records at once. Download the template below
          to see the exact columns expected — rows with errors are skipped and reported individually,
          the rest still get created. The <code>department</code> and <code>position</code> columns must
          match an existing active department/position name exactly (case-insensitive).
        </p>
      </div>
      <BulkImportForm />
    </div>
  );
}
