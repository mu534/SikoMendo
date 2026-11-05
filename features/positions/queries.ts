import "server-only";
import prisma from "@/lib/prisma";

/**
 * For the cascading Department → Position dropdown on the employee form.
 *
 * Returns each active position with two boolean flags:
 *
 * - `isManagerPosition` — true when this exact position is currently held by
 *   the department's designated manager employee (Department.manager.positionId
 *   === this position's id). Granular: targets a specific position.
 *
 * - `departmentHasManager` — true when the department already has any active
 *   Department Manager (Department.managerId !== null), regardless of which
 *   position that manager holds. Used by the form to disable manager-type
 *   positions even when the current manager was created without a positionId.
 *
 * These two flags together drive the "disabled manager position" UI in the
 * new-employee form and the backend guard in createEmployee.
 */
export async function listActivePositions() {
  const positions = await prisma.position.findMany({
    where: { isActive: true, department: { isActive: true } },
    select: {
      id: true,
      name: true,
      departmentId: true,
      department: {
        select: {
          managerId: true,
          manager: { select: { positionId: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return positions.map((p) => ({
    id: p.id,
    name: p.name,
    departmentId: p.departmentId,
    // True when:
    //   1. the department has a designated manager (managerId is not null), AND
    //   2. that manager employee currently holds this exact position.
    isManagerPosition:
      p.department.managerId !== null &&
      p.department.manager?.positionId === p.id,
    // True when the department already has any active Department Manager
    // (managerId is not null), regardless of which position they hold.
    departmentHasManager: p.department.managerId !== null,
  }));
}

/** Active positions for one department, for admin position management. */
export async function listActivePositionsByDepartment(departmentId: string) {
  return prisma.position.findMany({
    where: { departmentId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getPositionById(id: string) {
  return prisma.position.findUnique({ where: { id } });
}
