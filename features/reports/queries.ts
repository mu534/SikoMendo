import "server-only";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/utils";

export async function listReports(page = 1) {
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { generatedBy: { select: { name: true } } },
    }),
    prisma.report.count(),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
