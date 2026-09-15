import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatusValue, type LeaveTypeValue } from "./schemas";
import type { Prisma } from "@prisma/client";

/**
 * Resolves who a leave request should route to for a decision, per the
 * approval workflow:
 *   1. Direct manager decides first — they own day-to-day team coverage.
 *      Returns kind:"MANAGER" with the manager's userId.
 *   2. General Manager fallback — no direct manager is assigned (or the
 *      manager has no login / is banned), but an active General Manager
 *      exists. Returns kind:"GENERAL_MANAGER" with the GM's userId.
 *      The GM has organisation-wide authority and is a valid approver for
 *      any employee regardless of the reporting hierarchy.
 *   3. Unroutable — neither a direct manager nor a GM can be found.
 *      Returns kind:"UNROUTABLE" so the caller can give a precise error.
 *
 * NOTE: Admin can always decide as an override but is not part of this
 * notification routing.
 */
export async function resolveLeaveApprovalRoute(
  employeeId: string
): Promise<
  | { kind: "MANAGER";          userId: string; managerName: string }
  | { kind: "GENERAL_MANAGER";  userId: string; managerName: string }
  | { kind: "UNROUTABLE";       reason: string }
> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      manager: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
          user: { select: { banned: true } },
        },
      },
    },
  });

  const manager = employee?.manager;

  // ── Primary route: direct manager ────────────────────────────────────────
  if (manager && manager.userId && !manager.user?.banned) {
    return {
      kind: "MANAGER",
      userId: manager.userId,
      managerName: `${manager.firstName} ${manager.lastName}`,
    };
  }

  // ── Fallback route: General Manager ──────────────────────────────────────
  // If the direct manager is missing, has no login, or is banned, the General
  // Manager (MANAGER role) is the valid org-wide fallback approver.
  const generalManager = await prisma.user.findFirst({
    where: { role: "MANAGER", banned: false },
    select: { id: true, name: true },
  });

  if (generalManager) {
    // Describe why the direct route was skipped (for the notification message)
    let fallbackReason: string;
    if (!manager) {
      fallbackReason = "no direct manager assigned";
    } else if (!manager.userId) {
      fallbackReason = "direct manager has no login account";
    } else {
      fallbackReason = "direct manager account is disabled";
    }
    return {
      kind: "GENERAL_MANAGER",
      userId: generalManager.id,
      managerName: generalManager.name,
    };
  }

  // ── No valid approver found ───────────────────────────────────────────────
  let reason: string;
  if (!manager) {
    reason =
      "No manager is assigned to your employee record and no General Manager account is active. " +
      "Please ask HR to assign a manager before submitting leave.";
  } else if (!manager.userId) {
    reason =
      "Your manager does not have a login account and no General Manager is available as a fallback. " +
      "Please ask HR to set up your manager's account.";
  } else {
    reason =
      "Your manager's account is currently disabled and no General Manager is available as a fallback. " +
      "Please contact HR.";
  }
  return { kind: "UNROUTABLE", reason };
}

export async function generateNextLeaveId() {
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('leave_request_id_seq') AS nextval`;
  return `LR-${String(nextval).padStart(4, "0")}`;
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
      managerId: true,
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
  /** When set (a Manager viewing the list), restrict results to this employee's direct reports. */
  managerEmployeeId?: string;
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
  managerEmployeeId,
}: LeaveListFilters) {
  const andClauses: Prisma.LeaveRequestWhereInput[] = [];

  if (managerEmployeeId) {
    andClauses.push({ employee: { managerId: managerEmployeeId } });
  }
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
export async function listEmployeesForLeaveFilter(managerEmployeeId?: string) {
  return prisma.employee.findMany({
    where: { deletedAt: null, ...(managerEmployeeId ? { managerId: managerEmployeeId } : {}) },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

// ── Leave balances / entitlements ────────────────────────────────────────────

export type LeaveBalanceEntry = {
  leaveType: LeaveTypeValue;
  /** Org-wide days allowed per calendar year. Null = unlimited (no cap enforced). */
  entitled: number | null;
  used: number;
  /** Null when entitled is unlimited. */
  remaining: number | null;
};

/** Org-wide default entitlement per leave type. Types with no configured row are unlimited. */
export async function getLeaveEntitlements(): Promise<Record<LeaveTypeValue, number | null>> {
  const rows = await prisma.leaveEntitlement.findMany();
  const map = Object.fromEntries(LEAVE_TYPES.map((t) => [t, null])) as Record<LeaveTypeValue, number | null>;
  for (const row of rows) {
    map[row.leaveType as LeaveTypeValue] = row.daysPerYear;
  }
  return map;
}

/** Days used/remaining per leave type for one employee, for the given calendar year (defaults to current year). */
export async function getEmployeeLeaveBalances(
  employeeId: string,
  year: number = new Date().getFullYear()
): Promise<LeaveBalanceEntry[]> {
  const entitlements = await getLeaveEntitlements();

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const approved = await prisma.leaveRequest.findMany({
    where: { employeeId, status: "APPROVED", startDate: { gte: yearStart, lte: yearEnd } },
    select: { leaveType: true, totalDays: true },
  });

  const usedByType = new Map<string, number>();
  for (const req of approved) {
    usedByType.set(req.leaveType, (usedByType.get(req.leaveType) ?? 0) + req.totalDays);
  }

  return LEAVE_TYPES.map((leaveType) => {
    const entitled = entitlements[leaveType];
    const used = usedByType.get(leaveType) ?? 0;
    return {
      leaveType,
      entitled,
      used,
      remaining: entitled === null ? null : Math.max(0, entitled - used),
    };
  });
}

/**
 * Recent leave requests for a single employee — used on the employee profile
 * Leave tab. Returns the 5 most recent requests regardless of status.
 *
 * Security: `employeeId` must be resolved from session / hierarchy check by caller.
 */
export async function getRecentEmployeeLeaveRequests(employeeId: string, limit = 5) {
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      leaveId: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      status: true,
      reason: true,
      appliedDate: true,
    },
  });
}
