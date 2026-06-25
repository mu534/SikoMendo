import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";

export type EmployeeListFilters = {
  q?: string;
  status?: string;
  cooperativeId?: string;
  showArchived?: boolean;
  page: number;
};

const EMPLOYMENT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"];

export async function listEmployees({ q, status, cooperativeId, showArchived, page }: EmployeeListFilters) {
  const where = {
    deletedAt: showArchived ? { not: null } : null,
    AND: [
      q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { employeeId: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      status && EMPLOYMENT_STATUSES.includes(status) ? { employmentStatus: status } : {},
      cooperativeId ? { cooperativeId } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { cooperative: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.employee.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getEmployeeById(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      cooperative: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
}

/** Active cooperatives for the assignment dropdown. */
export async function listAssignableCooperatives() {
  return prisma.cooperative.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Users not yet linked to an employee record — candidates for the
 * "link to a user account" field. Includes the current employee's own
 * linked user (if any) so editing a record doesn't make that option vanish.
 */
export async function listLinkableUsers(currentUserId?: string | null) {
  return prisma.user.findMany({
    where: currentUserId ? { OR: [{ employee: null }, { id: currentUserId }] } : { employee: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}

export async function generateNextEmployeeId() {
  const last = await prisma.employee.findFirst({
    orderBy: { employeeId: "desc" },
    select: { employeeId: true },
  });

  const lastNumber = last ? parseInt(last.employeeId.replace(/\D/g, ""), 10) || 0 : 0;
  return `EMP-${String(lastNumber + 1).padStart(4, "0")}`;
}
