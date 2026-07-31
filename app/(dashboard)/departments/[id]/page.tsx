import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getDepartmentById } from "@/features/departments/queries";
import { updateDepartment, setDepartmentActive } from "@/features/departments/actions";
import { DepartmentForm } from "@/features/departments/department-form";
import { PositionsManager } from "@/features/departments/positions-manager";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!can(session.user.role, "VIEW_DEPARTMENTS")) notFound();
  const { id } = await params;

  const department = await getDepartmentById(id);
  if (!department) notFound();

  const canManageDepartment = can(session.user.role, "MANAGE_DEPARTMENTS");
  const canManagePositions = can(session.user.role, "MANAGE_POSITIONS");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/departments" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to departments
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-ink-900">{department.name}</h2>
          <Badge tone={department.isActive ? "success" : "neutral"}>
            {department.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-ink-900/60">{department._count.employees} employee(s) in this department.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader title="Department Details" />
            <div className="p-6 pt-5">
              {canManageDepartment ? (
                <>
                  <DepartmentForm
                    action={updateDepartment.bind(null, department.id)}
                    department={{ description: department.description, isActive: department.isActive }}
                  />
                  <form
                    action={async () => {
                      "use server";
                      await setDepartmentActive(department.id, !department.isActive);
                    }}
                    className="mt-3"
                  >
                    <button type="submit" className="text-sm font-medium text-ink-900/50 hover:text-ink-900">
                      {department.isActive ? "Deactivate this department" : "Activate this department"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-ink-900/70">{department.description || "No description."}</p>
                  <p className="text-xs text-ink-900/45">
                    Department details can only be edited by an Administrator.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Positions" description="Positions belonging to this department." />
            <div className="px-6 pt-5 pb-2">
              <PositionsManager
                departmentId={department.id}
                positions={department.positions}
                canManage={canManagePositions}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
