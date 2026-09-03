import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";

export type CooperativeListFilters = {
  q?: string;
  status?: string; // "active" | "inactive" | ""
  showArchived?: boolean;
  page: number;
};

export async function listCooperatives({ q, status, showArchived, page }: CooperativeListFilters) {
  const where = {
    deletedAt: showArchived ? { not: null } : null,
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { cooperativeId: { contains: q, mode: "insensitive" as const } },
              { location: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      status === "active" ? { isActive: true } : {},
      status === "inactive" ? { isActive: false } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.cooperative.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.cooperative.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCooperativeById(id: string) {
  return prisma.cooperative.findUnique({ where: { id } });
}

export async function generateNextCooperativeId() {
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('cooperative_id_seq') AS nextval`;
  return `COOP-${String(nextval).padStart(3, "0")}`;
}
