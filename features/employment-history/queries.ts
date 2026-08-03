import "server-only";
import prisma from "@/lib/prisma";

export async function getEmploymentHistory(employeeId: string) {
  return prisma.employmentHistory.findMany({
    where: { employeeId },
    include: {
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
    orderBy: { effectiveDate: "desc" },
  });
}

export async function getActiveEmploymentHistory(employeeId: string) {
  return prisma.employmentHistory.findFirst({
    where: { employeeId, endDate: null },
    orderBy: { effectiveDate: "desc" },
  });
}
