import Link from "next/link";
import { Building2 } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { listDepartments } from "@/features/departments/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";

export default async function DepartmentsPage() {
  await requirePermission("VIEW_DEPARTMENTS");
  const departments = await listDepartments();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Departments</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          The Union&apos;s official department structure. Departments are fixed — Admins can edit
          descriptions and active status, but new departments aren&apos;t created through the app.
        </p>
      </div>

      <Card>
        <Table>
          <THead>
            <TH>Department</TH>
            <TH>Positions</TH>
            <TH>Employees</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {departments.length === 0 && (
              <EmptyRow colSpan={4}>
                <Building2 className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No departments yet.
              </EmptyRow>
            )}
            {departments.map((dept) => (
              <TR key={dept.id}>
                <TD>
                  <Link href={`/departments/${dept.id}`} className="font-medium text-ink-900 hover:underline">
                    {dept.name}
                  </Link>
                  {dept.description && <p className="text-xs text-ink-900/50">{dept.description}</p>}
                </TD>
                <TD>{dept._count.positions}</TD>
                <TD>{dept._count.employees}</TD>
                <TD>
                  <Badge tone={dept.isActive ? "success" : "neutral"}>{dept.isActive ? "Active" : "Inactive"}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
