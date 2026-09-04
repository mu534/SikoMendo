import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";
import { ROLES, type Role } from "@/lib/permissions";

import type { Prisma } from "@prisma/client";

export type UserListFilters = {
  q?: string;
  role?: string;
  /** "active" | "suspended" | "" */
  status?: string;
  page: number;
};

export async function listUsers({ q, role, status, page }: UserListFilters) {
  const andClauses: Prisma.UserWhereInput[] = [];

  if (q) {
    andClauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        // Allow searching by linked employee ID (e.g. "EMP-0003")
        { employee: { employeeId: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (role && ROLES.includes(role as Role)) {
    andClauses.push({ role: role as Role });
  }

  if (status === "active") andClauses.push({ banned: false });
  if (status === "suspended") andClauses.push({ banned: true });

  const where = andClauses.length > 0 ? { AND: andClauses } : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        // Include just enough Employee data for the "Employee" column
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          deletedAt: true,
        },
      },
    },
  });
}
