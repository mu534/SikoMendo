import "server-only";
import prisma from "@/lib/prisma";

/** For the cascading Department → Position dropdown on the employee form. */
export async function listActivePositions() {
  return prisma.position.findMany({
    where: { isActive: true, department: { isActive: true } },
    select: { id: true, name: true, departmentId: true },
    orderBy: { name: "asc" },
  });
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
