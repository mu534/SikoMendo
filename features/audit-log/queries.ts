import "server-only";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export type AuditLogFilters = {
  /** Free-text: matches user name, entity ID, or action text. */
  q?: string;
  /** Filter to a specific entity type (e.g. "Employee", "Cooperative"). */
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

/**
 * Paginated audit log with optional filters.
 *
 * Uses a window-function query (`COUNT(*) OVER()`) so the total row count and
 * the page items come back in a single DB round-trip instead of two.
 *
 * When no free-text search is active the query hits the composite indexes on
 * (userId, createdAt), (entity, createdAt), and (action, createdAt). With a
 * free-text `q` we fall back to a Prisma ORM query so Prisma handles the
 * ILIKE join safely.
 */
export async function listAuditLog({
  q,
  entity,
  action,
  userId,
  dateFrom,
  dateTo,
  page,
}: AuditLogFilters) {
  // ── Free-text path: Prisma ORM (ILIKE on user join; no clean raw equivalent) ──
  if (q) {
    const term = q.trim();
    const andClauses: Prisma.AuditLogWhereInput[] = [
      {
        OR: [
          { user: { name: { contains: term, mode: "insensitive" } } },
          { user: { username: { contains: term, mode: "insensitive" } } },
          { entityId: { contains: term, mode: "insensitive" } },
          { action: { contains: term, mode: "insensitive" } },
          { entity: { contains: term, mode: "insensitive" } },
        ],
      },
    ];
    if (entity) andClauses.push({ entity });
    if (action) andClauses.push({ action });
    if (userId) andClauses.push({ userId });
    if (dateFrom) andClauses.push({ createdAt: { gte: new Date(`${dateFrom}T00:00:00.000Z`) } });
    if (dateTo)   andClauses.push({ createdAt: { lte: new Date(`${dateTo}T23:59:59.999Z`) } });

    const where: Prisma.AuditLogWhereInput = { AND: andClauses };
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

  // ── Fast path: raw SQL with window function (single round-trip, uses indexes) ─
  // Build WHERE conditions and parameter list dynamically.
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];
  let idx = 1;

  if (entity)   { conditions.push(`al.entity = $${idx++}`);    params.push(entity); }
  if (action)   { conditions.push(`al.action = $${idx++}`);    params.push(action); }
  if (userId)   { conditions.push(`al."userId" = $${idx++}`);  params.push(userId); }
  if (dateFrom) { conditions.push(`al."createdAt" >= $${idx++}`); params.push(new Date(`${dateFrom}T00:00:00.000Z`)); }
  if (dateTo)   { conditions.push(`al."createdAt" <= $${idx++}`); params.push(new Date(`${dateTo}T23:59:59.999Z`)); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * PAGE_SIZE;

  // COUNT(*) OVER() computes the total without a second query.
  const sql = `
    SELECT
      al.id, al.action, al.entity, al."entityId", al.changes,
      al."ipAddress", al."userId", al."createdAt",
      u.id   AS "user_id",
      u.name AS "user_name",
      u.username AS "user_username",
      COUNT(*) OVER() AS total_count
    FROM audit_log al
    LEFT JOIN "user" u ON u.id = al."userId"
    ${whereClause}
    ORDER BY al."createdAt" DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  params.push(PAGE_SIZE, offset);

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string | null;
      changes: unknown;
      ipAddress: string | null;
      userId: string | null;
      createdAt: Date;
      user_id: string | null;
      user_name: string | null;
      user_username: string | null;
      total_count: bigint;
    }>
  >(sql, ...params);

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const items = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    changes: r.changes,
    ipAddress: r.ipAddress,
    userId: r.userId,
    createdAt: r.createdAt,
    user: r.user_id
      ? { id: r.user_id, name: r.user_name ?? "", username: r.user_username ?? null }
      : null,
  }));

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Distinct entity/action values already recorded — used to populate filter dropdowns.
 *
 * Cached for 60 seconds — this runs 3 queries including correlated subqueries
 * on every audit log page load. The dropdown values change only when new audit
 * events are created, so a short TTL is safe.
 */
export const listAuditLogFilterOptions = unstable_cache(
  async () => {
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
  },
  ["audit-log-filter-options"],
  { revalidate: 60 }
);
