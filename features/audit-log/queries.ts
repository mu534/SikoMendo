import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export type AuditLogFilters = {
  q?: string;
  entity?: string;
  action?: string;
  page: number;
};

export async function listAuditLog({ q, entity, action, page }: AuditLogFilters) {
  const andClauses: Prisma.AuditLogWhereInput[] = [];

  if (q) {
    andClauses.push({
      OR: [
        { entityId: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (entity) andClauses.push({ entity });
  if (action) andClauses.push({ action });

  const where: Prisma.AuditLogWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Distinct entity/action values already recorded, used to populate filter dropdowns. */
export async function listAuditLogFilterOptions() {
  const [entities, actions] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  return {
    entities: entities.map((e) => e.entity),
    actions: actions.map((a) => a.action),
  };
}