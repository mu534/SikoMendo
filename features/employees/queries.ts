import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";

export type EmployeeListFilters = {
  q?: string;
  status?: string;
  department?: string;
  employmentType?: string;
  gender?: string;
  cooperativeId?: string;
  showArchived?: boolean;
  page: number;
};

const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE"];

export async function listEmployees({
  q,
  status,
  department,
  employmentType,
  gender,
  cooperativeId,
  showArchived,
  page,
}: EmployeeListFilters) {
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
              { department: { contains: q, mode: "insensitive" as const } },
              { position: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      status && EMPLOYMENT_STATUSES.includes(status) ? { employmentStatus: status } : {},
      department ? { department: { contains: department, mode: "insensitive" as const } } : {},
      employmentType ? { employmentType } : {},
      gender ? { gender } : {},
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

export async function listAssignableCooperatives() {
  return prisma.cooperative.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

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

// ── Report data queries ───────────────────────────────────────────────────────

export async function getEmployeesForReport(filters: {
  status?: string;
  department?: string;
  gender?: string;
  employmentType?: string;
  cooperativeId?: string;
  month?: string; // "YYYY-MM"
}) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.status) where.employmentStatus = filters.status;
  if (filters.department) where.department = filters.department;
  if (filters.gender) where.gender = filters.gender;
  if (filters.employmentType) where.employmentType = filters.employmentType;
  if (filters.cooperativeId) where.cooperativeId = filters.cooperativeId;

  return prisma.employee.findMany({
    where,
    include: {
      cooperative: { select: { name: true } },
      attendances: filters.month
        ? {
            where: {
              date: {
                gte: new Date(`${filters.month}-01`),
                lt: new Date(
                  new Date(`${filters.month}-01`).setMonth(
                    new Date(`${filters.month}-01`).getMonth() + 1
                  )
                ),
              },
            },
          }
        : false,
    },
    orderBy: [{ department: "asc" }, { firstName: "asc" }],
  });
}

export async function getDepartmentList() {
  const result = await prisma.employee.findMany({
    where: { deletedAt: null, department: { not: null } },
    select: { department: true },
    distinct: ["department"],
    orderBy: { department: "asc" },
  });
  return result.map((r) => r.department as string);
}
