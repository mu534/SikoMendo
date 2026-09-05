import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export type AuditLogFilters = {
  /** Free-text: matches user name, entity ID, or action text. */
  q?: string;
  /** Filter to a specific entity type (e.g. "Employee", "User"). */
  entity?: string;
  /** Filter to a specific action verb (e.g. "CREATE", "SUSPEND"). */
  action?: string;
  /** Filter to events by a specific user (user.id). */
  userId?: string;
  /** Inclusive lower bound — ISO date string yyyy-mm-dd. */
  dateFrom?: string;
  /** Inclusive upper bound — ISO date string yyyy-mm-dd. */
  dateTo?: string;
  page: number;
};

export async function listAuditLog({
  q,
  entity,
  action,
  userId,
  dateFrom,
  dateTo,
  page,
}: AuditLogFilters) {
  const andClauses: Prisma.AuditLogWhereInput[] = [];

  // Free-text: user name OR entity ID OR action text
  if (q) {
    const term = q.trim();
    andClauses.push({
      OR: [
        { user: { name: { contains: term, mode: "insensitive" } } },
        { user: { username: { contains: term, mode: "insensitive" } } },
        { entityId: { contains: term, mode: "insensitive" } },
        { action: { contains: term, mode: "insensitive" } },
        { entity: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (entity) andClauses.push({ entity });
  if (action) andClauses.push({ action });
  if (userId) andClauses.push({ userId });

  // Date range — applied at the beginning of the start day and the end of the
  // end day so records from the full selected days are included.
  if (dateFrom) {
    andClauses.push({
      createdAt: { gte: new Date(`${dateFrom}T00:00:00.000Z`) },
    });
  }
  if (dateTo) {
    andClauses.push({
      createdAt: { lte: new Date(`${dateTo}T23:59:59.999Z`) },
    });
  }

  const where: Prisma.AuditLogWhereInput =
    andClauses.length > 0 ? { AND: andClauses } : {};

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Distinct entity/action values already recorded — used to populate filter dropdowns. */
export async function listAuditLogFilterOptions() {
  const [entities, actions, users] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    // Users who have generated at least one audit event
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    entities: entities.map((e) => e.entity),
    actions: actions.map((a) => a.action),
    users,
  };
}
