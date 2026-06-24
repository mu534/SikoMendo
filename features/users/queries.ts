import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import { ROLES, type Role } from "@/lib/permissions";

export type UserListFilters = {
  q?: string;
  role?: string;
  page: number;
};

export async function listUsers({ q, role, page }: UserListFilters) {
  const where = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      role && ROLES.includes(role as Role) ? { role: role as Role } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
