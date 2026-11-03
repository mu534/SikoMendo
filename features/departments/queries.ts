import "server-only";
import prisma from "@/lib/prisma";

export async function listDepartments() {
  return prisma.department.findMany({
    include: { _count: { select: { employees: true, positions: true } } },
    orderBy: { name: "asc" },
  });
}

/** For dropdowns — active departments only, no counts needed. */
export async function listActiveDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getDepartmentById(id: string) {
  return prisma.department.findUnique({
    where: { id },
    include: {
      positions: {
        include: { _count: { select: { employees: true } } },
        orderBy: { name: "asc" },
      },
      _count: { select: { employees: true } },
    },
  });
}

/**
 * Returns active departments with their designated manager employee (if any).
 * Used by the New Employee form to resolve the manager for a selected department.
 */
export async function listActiveDepartmentsWithManagers() {
  return prisma.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          position: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
