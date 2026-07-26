import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatusValue, type LeaveTypeValue } from "./schemas";
import type { Prisma } from "@prisma/client";

export async function generateNextLeaveId() {
  const last = await prisma.leaveRequest.findFirst({
    orderBy: { leaveId: "desc" },
    select: { leaveId: true },
  });
  const lastNumber = last ? parseInt(last.leaveId.replace(/\D/g, ""), 10) || 0 : 0;
  return `LR-${String(lastNumber + 1).padStart(4, "0")}`;
}

/** Any PENDING or APPROVED request for this employee whose date range overlaps [startDate, endDate]. */
export async function hasOverlappingLeave({
  employeeId,
  startDate,
  endDate,
  excludeId,
}: {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  excludeId?: string;
}) {
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });
  return Boolean(overlapping);
}

const leaveInclude = {
  employee: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      department: true,
      userId: true,
    },
  },
  approver: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestInclude;

export async function getLeaveRequestById(id: string) {
  return prisma.leaveRequest.findUnique({
    where: { id },
    include: leaveInclude,
  });
}

export async function getMyLeaveRequests({ employeeId, page }: { employeeId: string; page: number }) {
  const where: Prisma.LeaveRequestWhereInput = { employeeId };

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type LeaveListFilters = {
  q?: string;
  status?: string;
  leaveType?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page: number;
};

export async function listAllLeaveRequests({
  q,
  status,
  leaveType,
  employeeId,
  startDate,
  endDate,
  sort,
  page,
}: LeaveListFilters) {
  const andClauses: Prisma.LeaveRequestWhereInput[] = [];

  if (q) {
    andClauses.push({
      OR: [
        { leaveId: { contains: q, mode: "insensitive" } },
        { reason: { contains: q, mode: "insensitive" } },
        { employee: { firstName: { contains: q, mode: "insensitive" } } },
        { employee: { lastName: { contains: q, mode: "insensitive" } } },
        { employee: { employeeId: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (status && LEAVE_STATUSES.includes(status as LeaveStatusValue)) {
    andClauses.push({ status: status as LeaveStatusValue });
  }
  if (leaveType && LEAVE_TYPES.includes(leaveType as LeaveTypeValue)) {
    andClauses.push({ leaveType: leaveType as LeaveTypeValue });
  }
  if (employeeId) {
    andClauses.push({ employeeId });
  }
  if (startDate) {
    andClauses.push({ startDate: { gte: new Date(`${startDate}T00:00:00.000Z`) } });
  }
  if (endDate) {
    andClauses.push({ endDate: { lte: new Date(`${endDate}T00:00:00.000Z`) } });
  }

  const where: Prisma.LeaveRequestWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const orderBy: Prisma.LeaveRequestOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "start_date"
        ? { startDate: "asc" }
        : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Lightweight list for filter dropdowns (leave list page, report filters). */
export async function listEmployeesForLeaveFilter() {
  return prisma.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}
