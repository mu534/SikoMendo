import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import type { EmploymentStatus, Gender, Prisma } from "@prisma/client";

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

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE",
];
const GENDERS: Gender[] = ["MALE", "FEMALE"];

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
  const andClauses: Prisma.EmployeeWhereInput[] = [];

  if (q) {
    andClauses.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { employeeId: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (status && EMPLOYMENT_STATUSES.includes(status as EmploymentStatus)) {
    andClauses.push({ employmentStatus: status as EmploymentStatus });
  }
  if (department) {
    andClauses.push({ department: { contains: department, mode: "insensitive" } });
  }
  if (employmentType) {
    andClauses.push({ employmentType });
  }
  if (gender && GENDERS.includes(gender as Gender)) {
    andClauses.push({ gender: gender as Gender });
  }
  if (cooperativeId) {
    andClauses.push({ cooperativeId });
  }

  const where: Prisma.EmployeeWhereInput = {
    deletedAt: showArchived ? { not: null } : null,
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
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
    where: currentUserId
      ? { OR: [{ employee: null }, { id: currentUserId }] }
      : { employee: null },
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
  month?: string;
}) {
  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (filters.status && EMPLOYMENT_STATUSES.includes(filters.status as EmploymentStatus)) {
    where.employmentStatus = filters.status as EmploymentStatus;
  }
  if (filters.department) where.department = filters.department;
  if (filters.gender && GENDERS.includes(filters.gender as Gender)) {
    where.gender = filters.gender as Gender;
  }
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
