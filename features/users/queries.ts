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
    const term = q.trim();
    // Each OR branch is independent so that:
    // - name/username search works for users without employees
    // - employee.employeeId / employee name search works for linked accounts
    // Using separate `some`-style nested OR so Prisma generates a proper
    // LEFT JOIN with OR conditions rather than an implicit INNER JOIN.
    andClauses.push({
      OR: [
        // Direct user fields — works for both linked and unlinked accounts
        { name:     { contains: term, mode: "insensitive" } },
        { username: { contains: term, mode: "insensitive" } },
        // Employee fields — only matches users that have a linked employee
        // Searching by business-facing Employee ID (e.g. "EMP-0001")
        { employee: { is: { employeeId: { contains: term, mode: "insensitive" } } } },
        // Searching by employee first name
        { employee: { is: { firstName:  { contains: term, mode: "insensitive" } } } },
        // Searching by employee last name
        { employee: { is: { lastName:   { contains: term, mode: "insensitive" } } } },
        // Searching by employee middle name (father's name)
        { employee: { is: { middleName: { contains: term, mode: "insensitive" } } } },
      ],
    });
  }

  if (role && ROLES.includes(role as Role)) {
    andClauses.push({ role: role as Role });
  }

  if (status === "active")    andClauses.push({ banned: false });
  if (status === "suspended") andClauses.push({ banned: true });

  const where: Prisma.UserWhereInput =
    andClauses.length > 0 ? { AND: andClauses } : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // Pagination is applied at the database level AFTER the where clause,
      // so search + pagination always work together correctly.
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        employee: {
          select: {
            id:         true,
            employeeId: true,
            firstName:  true,
            lastName:   true,
            deletedAt:  true,
          },
        },
      },
    }),
    // Count uses the SAME where clause so total/totalPages reflect the search.
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
          id:         true,
          employeeId: true,
          firstName:  true,
          lastName:   true,
          deletedAt:  true,
        },
      },
    },
  });
}
