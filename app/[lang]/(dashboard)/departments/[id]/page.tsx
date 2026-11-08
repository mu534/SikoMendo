import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import { resolveEffectiveRole } from "@/lib/employee-access";
import { getDepartmentById } from "@/features/departments/queries";
import { updateDepartment, setDepartmentActive } from "@/features/departments/actions";
import { DepartmentForm } from "@/features/departments/department-form";
import { PositionsManager } from "@/features/departments/positions-manager";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("departments");
  const tC = await getTranslations("common");
  const session = await requireSession();
  const effectiveRole = await resolveEffectiveRole(session.user.id, session.user.role as Role);
  if (!can(effectiveRole, "VIEW_DEPARTMENTS")) notFound();
  const { id } = await params;

  const department = await getDepartmentById(id);
  if (!department) notFound();

  const canManageDepartment = can(effectiveRole, "MANAGE_DEPARTMENTS");
  const canManagePositions = can(effectiveRole, "MANAGE_POSITIONS");

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

        {/* Manager info */}
        <div className="mt-2 flex items-center gap-2">
          <UserCheck className="h-4 w-4 shrink-0 text-ink-900/40" />
          {department.manager ? (
            <span className="text-sm text-ink-900/70">
              Department Manager:{" "}
              <Link href={`/employees/${department.manager.id}`} className="font-medium text-brand-700 hover:underline">
                {department.manager.firstName} {department.manager.lastName}
              </Link>
              <span className="ml-1 text-ink-900/40">({department.manager.employeeId})</span>
              {department.manager.position?.name && (
                <span className="ml-1 text-ink-900/40">· {department.manager.position.name}</span>
              )}
            </span>
          ) : (
            <span className="text-sm italic text-ink-900/40">
              No Department Manager assigned.
              {canManageDepartment && (
                <> Use the <Link href="/users/new" className="text-brand-700 hover:underline">New Manager Account</Link> page to assign one.</>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader title={t("detail.title")} />
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
                    Department details can only be edited by Administrators and HR Officers.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={t("positions.title")} description="Positions belonging to this department." />
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
