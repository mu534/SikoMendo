import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import type { EmploymentStatus, Gender, EmploymentType, Prisma } from "@prisma/client";

export type EmployeeListFilters = {
  q?: string;
  status?: string;
  departmentId?: string;
  employmentType?: string;
  gender?: string;
  showArchived?: boolean;
  /** When set, restricts results to these employee IDs (used to scope Managers to their reporting hierarchy). */
  restrictToIds?: string[];
  page: number;
};

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "ACTIVE", "ON_LEAVE", "RESIGNED", "RETIRED", "SUSPENDED", "TERMINATED", "INACTIVE",
];
const GENDERS: Gender[] = ["MALE", "FEMALE"];
const EMPLOYMENT_TYPES: EmploymentType[] = ["PERMANENT", "CONTRACT", "TEMPORARY", "PROBATION", "INTERNSHIP"];

const employeeListInclude = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

export async function listEmployees({
  q,
  status,
  departmentId,
  employmentType,
  gender,
  showArchived,
  restrictToIds,
  page,
}: EmployeeListFilters) {
  const andClauses: Prisma.EmployeeWhereInput[] = [];

  if (restrictToIds) {
    andClauses.push({ id: { in: restrictToIds } });
  }

  if (q) {
    andClauses.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { employeeId: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { department: { name: { contains: q, mode: "insensitive" } } },
        { position: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (status && EMPLOYMENT_STATUSES.includes(status as EmploymentStatus)) {
    andClauses.push({ employmentStatus: status as EmploymentStatus });
  }
  if (departmentId) {
    andClauses.push({ departmentId });
  }
  if (employmentType && EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
    andClauses.push({ employmentType: employmentType as EmploymentType });
  }
  if (gender && GENDERS.includes(gender as Gender)) {
    andClauses.push({ gender: gender as Gender });
  }

  const where: Prisma.EmployeeWhereInput = {
    deletedAt: showArchived ? { not: null } : null,
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: employeeListInclude,
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
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, departmentId: true } },
      user: { select: { id: true, email: true, username: true, role: true } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      employmentHistory: {
        include: {
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
        orderBy: { effectiveDate: "desc" },
      },
      contracts: {
        orderBy: { startDate: "desc" },
      },
    },
  });
}

export async function listLinkableUsers(currentUserId?: string | null) {
  return prisma.user.findMany({
    where: currentUserId
      ? { OR: [{ employee: null }, { id: currentUserId }] }
      : { employee: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, username: true },
  });
}

export async function generateNextEmployeeId() {
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('employee_id_seq') AS nextval`;
  return `EMP-${String(nextval).padStart(4, "0")}`;
}

// ── Reporting hierarchy ──────────────────────────────────────────────────────

/** All employee IDs reporting up to `managerId`, directly or transitively (BFS). */
export async function getSubordinateIds(managerId: string): Promise<string[]> {
  const all: string[] = [];
  let currentLevel = [managerId];

  while (currentLevel.length > 0) {
    const next = await prisma.employee.findMany({
      where: { managerId: { in: currentLevel }, deletedAt: null },
      select: { id: true },
    });
    const nextIds = next.map((e) => e.id);
    all.push(...nextIds);
    currentLevel = nextIds;
  }

  return all;
}

/** Employees this one could be assigned to report to — excludes themselves and anyone already reporting to them. */
export async function listAssignableManagers(employeeId: string) {
  const subordinateIds = await getSubordinateIds(employeeId);
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [employeeId, ...subordinateIds] },
    },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}