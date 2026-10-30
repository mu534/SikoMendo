import { FileBarChart } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { generateReport } from "@/features/reports/actions";
import { listActiveDepartments } from "@/features/departments/queries";
import { getSubordinateIds } from "@/features/employees/queries";
import { Card } from "@/components/ui/card";
import { GenerateReportForm } from "@/features/reports/generate-report-form";
import prisma from "@/lib/prisma";

export default async function GenerateReportPage() {
  const session = await requirePermission("GENERATE_REPORTS");
  const { role, id: userId } = session.user;

  // ── Resolve employee dropdown scope ────────────────────────────────────
  // Manager → only their transitive subordinates.
  // Admin / HR → all active employees.
  // The server action re-validates scope regardless of what the client sends.
  let employees: { id: string; employeeId: string; firstName: string; lastName: string }[] = [];

  if (role === "MANAGER") {
    const ownEmployee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (ownEmployee) {
      const subordinateIds = await getSubordinateIds(ownEmployee.id);
      const allIds = [ownEmployee.id, ...subordinateIds];
      employees = await prisma.employee.findMany({
        where: { id: { in: allIds }, deletedAt: null },
        select: { id: true, employeeId: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      });
    }
    // If no linked employee, employees stays [] — the dropdown shows nothing,
    // and the server will return an empty result for employee-scoped reports.
  } else {
    employees = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: { id: true, employeeId: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }

  const departments = await listActiveDepartments();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Generate Report</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          Select a report type, apply filters, and export to PDF or CSV.
          Generated reports are saved to{" "}
          <a href="/reports/history" className="font-medium text-brand-700 hover:underline">
            Report History
          </a>
          .
        </p>
      </div>

      <div className="max-w-2xl">
        <Card className="overflow-hidden">
          <div className="h-1 bg-brand-700" />
          <div className="p-6">
            <div className="mb-5 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <FileBarChart className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-ink-900">
                  Report Settings
                </h3>
                <p className="mt-0.5 text-xs text-ink-900/50">
                  Choose a type and apply optional filters
                </p>
              </div>
            </div>
            <GenerateReportForm
              action={generateReport}
              employees={employees}
              departments={departments}
            />
          </div>
        </Card>
      </div>

      {/* Scope note for Managers */}
      {role === "MANAGER" && employees.length === 0 && (
        <p className="max-w-2xl rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-ink-900/70">
          Your account is not linked to an employee record, so employee-scoped reports will return
          no data. Ask HR to link your account to your employee profile.
        </p>
      )}
      {role === "MANAGER" && employees.length > 0 && (
        <p className="max-w-2xl text-xs text-ink-900/45">
          Manager scope: reports will include only employees within your reporting hierarchy
          ({employees.length} employee{employees.length === 1 ? "" : "s"}).
        </p>
      )}

      {/* Non-generate roles see a redirect notice */}
      {!can(role, "GENERATE_REPORTS") && (
        <p className="text-sm text-ink-900/60">
          You don&apos;t have permission to generate reports. Visit{" "}
          <a href="/reports/history" className="font-medium text-brand-700 hover:underline">
            Report History
          </a>{" "}
          to view previously generated reports.
        </p>
      )}
    </div>
  );
}
