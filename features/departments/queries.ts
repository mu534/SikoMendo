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
