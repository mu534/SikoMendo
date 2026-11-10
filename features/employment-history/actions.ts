"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { assertPositionInDepartmentTx } from "@/lib/employee-access";
import { LocalizedError } from "@/lib/errors";
import { employmentChangeSchema, employmentChangeFormDataToObject } from "./schemas";

function dayBefore(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export async function recordEmploymentChange(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_EMPLOYMENT_HISTORY", async () => {
    const parsed = employmentChangeSchema.safeParse(
      employmentChangeFormDataToObject(formData)
    );
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const effectiveDate = new Date(`${parsed.data.effectiveDate}T00:00:00.000Z`);

    // ── Role-change validation ──────────────────────────────────────────────
    const requestedRole = parsed.data.newRole;
    const callerCanChangeRoles = can(session!.user.role, "MANAGE_ROLES");

    // ── Interactive Serializable transaction ────────────────────────────────
    // All reads and writes run inside a single Serializable transaction so there
    // is no TOCTOU gap between reading the dept manager and writing the new row.
    let historyId: string;
    let roleToUpdate: Role | null = null;
    let employeeUserId: string | null = null;
    let prevEmployeeRole: Role | null = null;

    await prisma.$transaction(
      async (tx) => {
        // ── Step 2: Load employee ───────────────────────────────────────────
        const employee = await tx.employee.findUnique({
          where: { id: employeeId },
          include: {
            user: { select: { id: true, role: true } },
            managedDepartment: { select: { id: true } },
          },
        });
        if (!employee) {
          throw new LocalizedError("errors.employees.notFound", "Employee not found.");
        }

        // ── Step 3: Validate position belongs to department ─────────────────
        await assertPositionInDepartmentTx(tx, parsed.data.positionId, parsed.data.departmentId);

        const currentActive = await tx.employmentHistory.findFirst({
          where: { employeeId, endDate: null },
          orderBy: { effectiveDate: "desc" },
        });

        if (currentActive && effectiveDate <= currentActive.effectiveDate) {
          throw new Error(
            "The effective date must be after the current employment record's effective date."
          );
        }

        // ── Step 4: Compute flags ───────────────────────────────────────────
        const newDepartmentId = parsed.data.departmentId;
        const newPositionId   = parsed.data.positionId;
        const newEmploymentType = parsed.data.employmentType;

        const departmentChanged = newDepartmentId !== employee.departmentId;

        const effectiveNewRole: Role | null =
          callerCanChangeRoles &&
          requestedRole &&
          employee.user &&
          requestedRole !== employee.user.role
            ? requestedRole
            : null;

        const isDeptManagerAppointment =
          effectiveNewRole === "DEPT_MANAGER" && !!employee.user;

        // ── Step 5: Guard — GM cannot be re-designated as DM ───────────────
        if (isDeptManagerAppointment && employee.user?.role === "MANAGER") {
          throw new LocalizedError(
            "errors.employmentHistory.cannotReassignGeneralManager",
            "The General Manager cannot be appointed as a Department Manager."
          );
        }

        // ── Step 6: Resolve newManagerId ────────────────────────────────────
        let newManagerId: string | null;

        if (employee.user?.role === "MANAGER" && !isDeptManagerAppointment) {
          // Case A: employee is active GM — stays top-level
          newManagerId = null;
        } else if (isDeptManagerAppointment) {
          // Case B: DM appointment — manager becomes the active GM
          const gm = await tx.user.findFirst({
            where: { role: "MANAGER", banned: false, deletedAt: null },
            select: { employee: { select: { id: true } } },
          });
          if (!gm?.employee?.id) {
            throw new LocalizedError(
              "errors.employmentHistory.noGeneralManager",
              "No active General Manager exists. A General Manager must be assigned before appointing a Department Manager."
            );
          }
          newManagerId = gm.employee.id;
        } else if (departmentChanged) {
          // Case C: department changed — derive manager from new dept's active DM
          const dept = await tx.department.findUnique({
            where: { id: newDepartmentId },
            select: {
              managerId: true,
              manager: { select: { deletedAt: true, employmentStatus: true } },
            },
          });
          const activeDM =
            dept?.managerId &&
            !dept.manager?.deletedAt &&
            dept.manager?.employmentStatus === "ACTIVE"
              ? dept.managerId
              : null;

          if (!activeDM) {
            throw new LocalizedError(
              "errors.employmentHistory.deptHasNoManager",
              "The selected department has no active Department Manager. Assign a Department Manager before transferring this employee."
            );
          }
          newManagerId = activeDM;
        } else {
          // Case D: same department, no DM appointment — manager unchanged
          newManagerId = employee.managerId;
        }

        // ── Step 7: Self-assignment guard ────────────────────────────────────
        if (newManagerId && newManagerId === employeeId) {
          throw new LocalizedError(
            "errors.employmentHistory.selfAssignment",
            "An employee cannot be assigned as their own manager."
          );
        }

        // ── Step 8: DM appointment writes ────────────────────────────────────
        if (isDeptManagerAppointment) {
          // 8a. Check for existing DM in target dept (excluding this employee)
          const conflict = await tx.user.findFirst({
            where: {
              role: "DEPT_MANAGER",
              banned: false,
              deletedAt: null,
              employee: { departmentId: newDepartmentId, deletedAt: null },
              id: { not: employee.user!.id },
            },
          });
          if (conflict) {
            throw new LocalizedError(
              "errors.employmentHistory.deptManagerAlreadyExists",
              "This department already has an active Department Manager."
            );
          }

          // 8b. Clear previously managed department (if different from target)
          await tx.department.updateMany({
            where: {
              managerId: employee.id,
              id: { not: newDepartmentId },
            },
            data: { managerId: null },
          });

          // 8c. Set new department's managerId to this employee
          await tx.department.update({
            where: { id: newDepartmentId },
            data: { managerId: employee.id },
          });
        }

        // ── Step 9: DM departure/downgrade ───────────────────────────────────
        // If employee was previously a DM and this change doesn't appoint them again
        const oldManaged = employee.managedDepartment;
        if (oldManaged && !isDeptManagerAppointment) {
          if (oldManaged.id !== newDepartmentId) {
            // Transferred away from managed dept
            await tx.department.update({
              where: { id: oldManaged.id },
              data: { managerId: null },
            });
          } else if (effectiveNewRole && effectiveNewRole !== "DEPT_MANAGER") {
            // Same dept but downgraded from DM
            await tx.department.update({
              where: { id: oldManaged.id },
              data: { managerId: null },
            });
          }
        }

        // ── Step 10: Append new EmploymentHistory row ─────────────────────────
        const historyRecord = await tx.employmentHistory.create({
          data: {
            employeeId,
            departmentId:         newDepartmentId,
            positionId:           newPositionId,
            employmentType:       newEmploymentType,
            effectiveDate,
            changeReason:         parsed.data.changeReason,
            remarks:              parsed.data.remarks,
            previousDepartmentId: employee.departmentId,
            previousPositionId:   employee.positionId,
            previousManagerId:    employee.managerId,
            newManagerId,
            recordedById:         session!.user.id,
          },
        });
        historyId = historyRecord.id;

        // ── Step 11: Close prior active history row ───────────────────────────
        if (currentActive) {
          await tx.employmentHistory.update({
            where: { id: currentActive.id },
            data: { endDate: dayBefore(effectiveDate) },
          });
        }

        // ── Step 12: Update Employee ──────────────────────────────────────────
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            departmentId:   newDepartmentId,
            positionId:     newPositionId,
            employmentType: newEmploymentType,
            managerId:      newManagerId,
          },
        });

        // ── Step 13: Update User role ─────────────────────────────────────────
        if (effectiveNewRole && employee.user) {
          await tx.user.update({
            where: { id: employee.user.id },
            data: { role: effectiveNewRole },
          });
          roleToUpdate      = effectiveNewRole;
          employeeUserId    = employee.user.id;
          prevEmployeeRole  = employee.user.role as Role;
        }
      },
      { isolationLevel: "Serializable" }
    );

    // ── Audit logs (outside transaction — non-fatal if they fail) ───────────

    // Employment change audit
    await logAudit("CREATE", "EmploymentHistory", historyId!, {
      departmentId:   parsed.data.departmentId,
      positionId:     parsed.data.positionId,
      employmentType: parsed.data.employmentType,
      effectiveDate:  parsed.data.effectiveDate,
      changeReason:   parsed.data.changeReason,
    }, session?.user.id);

    // Role change audit — separate entry, only when a role was actually changed
    if (roleToUpdate && employeeUserId) {
      await logAudit("UPDATE", "User", employeeUserId, {
        roleFrom: prevEmployeeRole,
        roleTo:   roleToUpdate,
        reason:   `Employment change: ${parsed.data.changeReason}`,
      }, session?.user.id);

      // Also update the better-auth user so the session reflects the new role
      // immediately on next sign-in. Non-fatal if it fails.
      try {
        await auth.api.adminUpdateUser({
          headers: await headers(),
          body: { userId: employeeUserId, data: { role: roleToUpdate } },
        });
      } catch {
        // Non-fatal — the Prisma user.role is already updated.
      }
    }

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/users");
    return { id: historyId! };
  });
}
