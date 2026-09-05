import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listEmployees, getSubordinateIds } from "@/features/employees/queries";
import { listActiveDepartments } from "@/features/departments/queries";
import { archiveEmployee, restoreEmployee } from "@/features/employees/actions";
import prisma from "@/lib/prisma";
import { parsePageParam, parseStringParam, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Table, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type EmployeeRow = Awaited<ReturnType<typeof listEmployees>>["items"][number];

const STATUS_TONE = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  RESIGNED: "neutral",
  RETIRED: "neutral",
  INACTIVE: "neutral",
  SUSPENDED: "warning",
  TERMINATED: "danger",
} as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("VIEW_EMPLOYEES");
  const canManage = can(session.user.role, "MANAGE_EMPLOYEES");

  const params = await searchParams;
  const q = parseStringParam(params.q);
  const status = parseStringParam(params.status);
  const departmentId = parseStringParam(params.department);
  const employmentType = parseStringParam(params.employmentType);
  const showArchived = parseStringParam(params.archived) === "1";
  const page = parsePageParam(params.page);

  // Managers only see employees within their own reporting hierarchy — everyone
  // else (Admin/HR) sees the full list.
  let restrictToIds: string[] | undefined;
  if (session.user.role === "MANAGER") {
    const ownEmployee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    restrictToIds = ownEmployee ? await getSubordinateIds(ownEmployee.id) : [];
  }

  const [{ items, total, totalPages }, departments] = await Promise.all([
    listEmployees({ q, status, departmentId, employmentType, showArchived, restrictToIds, page }),
    listActiveDepartments(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">Employee records</h2>
        <p className="mt-1 text-sm text-ink-900/60">
          {showArchived
            ? "Archived employee records."
            : "All active employee records across Siko Mendo Union."}
        </p>
      </div>

      <Card>
        <Toolbar
          basePath="/employees"
          searchPlaceholder="Search by name, ID, department, or position"
          searchDefault={q}
        >
          <Select name="status" defaultValue={status} className="w-44">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="RESIGNED">Resigned</option>
            <option value="RETIRED">Retired</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <Select name="department" defaultValue={departmentId} className="w-48">
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </Select>
          <Select name="employmentType" defaultValue={employmentType} className="w-44">
            <option value="">All types</option>
            <option value="PERMANENT">Permanent</option>
            <option value="CONTRACT">Contract</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="PROBATION">Probation</option>
            <option value="INTERNSHIP">Internship</option>
          </Select>
          {showArchived && <input type="hidden" name="archived" value="1" />}
        </Toolbar>

        <Table>
          <THead>
            <TH>Employee</TH>
            <TH>Department / Position</TH>
            <TH>Employment Type</TH>
            <TH>Status</TH>
            <TH>Hired</TH>
            {canManage && <TH className="text-right">Actions</TH>}
          </THead>
          <TBody>
            {items.length === 0 && (
              <EmptyRow colSpan={canManage ? 6 : 5}>
                <UsersIcon className="mx-auto mb-2 h-8 w-8 text-ink-900/20" />
                No employee records match your filters.
              </EmptyRow>
            )}
            {items.map((employee: EmployeeRow) => (
              <TR key={employee.id}>
                <TD>
                  <Link
                    href={`/employees/${employee.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar
                      name={`${employee.firstName} ${employee.lastName}`}
                      imageUrl={employee.profileImageUrl}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-ink-900">
                        {employee.firstName}
                        {employee.middleName ? ` ${employee.middleName}` : ""}{" "}
                        {employee.lastName}
                      </p>
                      <p className="text-xs text-ink-900/50">{employee.employeeId}</p>
                    </div>
                  </Link>
                </TD>
                <TD>
                  <p className="text-ink-900/80">{employee.position.name}</p>
                  <p className="text-xs text-ink-900/50">{employee.department.name}</p>
                </TD>
                <TD>{employee.employmentType ?? "—"}</TD>
                <TD>
                  <Badge
                    tone={
                      STATUS_TONE[employee.employmentStatus as keyof typeof STATUS_TONE] ??
                      "neutral"
                    }
                  >
                    {employee.employmentStatus.replace("_", " ")}
                  </Badge>
                </TD>
                <TD>{formatDate(employee.hireDate)}</TD>
                {canManage && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/employees/${employee.id}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        Edit
                      </Link>
                      {showArchived ? (
                        <form
                          action={async () => {
                            "use server";
                            await restoreEmployee(employee.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            variant="outline"
                            confirmMessage={`Restore ${employee.firstName} ${employee.lastName}?`}
                          >
                            Restore
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            await archiveEmployee(employee.id);
                          }}
                        >
                          <ConfirmSubmitButton
                            confirmMessage={`Archive ${employee.firstName} ${employee.lastName}? You can restore this later.`}
                          >
                            Archive
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>

        <Pagination
          basePath="/employees"
          params={{ q, status, department: departmentId, employmentType, archived: showArchived ? "1" : undefined }}
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
        />
      </Card>
    </div>
  );
}
