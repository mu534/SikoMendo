"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import { withPermission, type ActionResult } from "@/lib/action-utils";
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

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!employee) throw new Error("Employee not found.");

    const effectiveDate = new Date(`${parsed.data.effectiveDate}T00:00:00.000Z`);

    const currentActive = await prisma.employmentHistory.findFirst({
      where: { employeeId, endDate: null },
      orderBy: { effectiveDate: "desc" },
    });

    if (currentActive && effectiveDate <= currentActive.effectiveDate) {
      throw new Error(
        "The effective date must be after the current employment record's effective date."
      );
    }

    // ── Role-change validation ──────────────────────────────────────────────
    // A role change is only allowed when:
    //   1. The caller has MANAGE_ROLES (ADMIN only).
    //   2. The employee has a linked User account to update.
    //   3. The submitted newRole is actually different from the current role.
    // Any attempt to submit newRole without MANAGE_ROLES is silently ignored —
    // the server never trusts client-submitted privilege escalation.
    const requestedRole = parsed.data.newRole;
    const callerCanChangeRoles = can(session!.user.role, "MANAGE_ROLES");

    const effectiveNewRole: Role | null =
      callerCanChangeRoles &&
      requestedRole &&
      employee.user &&
      requestedRole !== employee.user.role
        ? requestedRole
        : null;

    // ── Database transaction ────────────────────────────────────────────────
    // All mutations are in a single transaction so a partial failure
    // (e.g. role update fails) rolls back the whole change.
    const [historyRecord] = await prisma.$transaction([
      // 1. Append new EmploymentHistory row
      prisma.employmentHistory.create({
        data: {
          employeeId,
          departmentId:   parsed.data.departmentId,
          positionId:     parsed.data.positionId,
          employmentType: parsed.data.employmentType,
          effectiveDate,
          changeReason:   parsed.data.changeReason,
          remarks:        parsed.data.remarks,
        },
      }),
      // 2. Close the previous active row
      ...(currentActive
        ? [
            prisma.employmentHistory.update({
              where: { id: currentActive.id },
              data: { endDate: dayBefore(effectiveDate) },
            }),
          ]
        : []),
      // 3. Update Employee denormalised fields
      prisma.employee.update({
        where: { id: employeeId },
        data: {
          departmentId:   parsed.data.departmentId,
          positionId:     parsed.data.positionId,
          employmentType: parsed.data.employmentType,
        },
      }),
      // 4. Update linked User role — only when validated above
      ...(effectiveNewRole && employee.user
        ? [prisma.user.update({ where: { id: employee.user.id }, data: { role: effectiveNewRole } })]
        : []),
    ]);

    // ── Audit logs (outside transaction — non-fatal if they fail) ───────────

    // Employment change audit
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "EmploymentHistory",
        entityId: historyRecord.id,
        changes: {
          departmentId:   parsed.data.departmentId,
          positionId:     parsed.data.positionId,
          employmentType: parsed.data.employmentType,
          effectiveDate:  parsed.data.effectiveDate,
          changeReason:   parsed.data.changeReason,
        },
        userId: session?.user.id,
      },
    });

    // Role change audit — separate entry, only when a role was actually changed
    if (effectiveNewRole && employee.user) {
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "User",
          entityId: employee.user.id,
          changes: {
            roleFrom: employee.user.role,
            roleTo:   effectiveNewRole,
            reason:   `Employment change: ${parsed.data.changeReason}`,
          },
          userId: session?.user.id,
        },
      });

      // Also update the better-auth user so the session reflects the new role
      // immediately on next sign-in. Use adminUpdateUser to keep auth state
      // consistent with the Prisma update above.
      try {
        await auth.api.adminUpdateUser({
          headers: await headers(),
          body: { userId: employee.user.id, data: { role: effectiveNewRole } },
        });
      } catch {
        // Non-fatal — the Prisma user.role is already updated and will be read
        // correctly on the next session load. Better-auth may lag by one session.
      }
    }

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/users");
    return { id: historyRecord.id };
  });
}
