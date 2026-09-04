import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";


export async function listReports(
  page: number,
  userId: string,
  role: string
) {
  const ORG_WIDE_ROLES = new Set(["ADMIN", "HR_OFFICER"]);

  const where = ORG_WIDE_ROLES.has(role)
    ? {}                                       // unrestricted
    : { generatedById: userId };               // own reports only

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { generatedBy: { select: { name: true } } },
    }),
    prisma.report.count({ where }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
