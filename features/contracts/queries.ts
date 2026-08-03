import "server-only";
import prisma from "@/lib/prisma";

const EXPIRY_WARNING_DAYS = 30;

export async function getContracts(employeeId: string) {
  const contracts = await prisma.contract.findMany({
    where: { employeeId },
    orderBy: { startDate: "desc" },
  });

  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + EXPIRY_WARNING_DAYS);

  return contracts.map((c) => ({
    ...c,
    isExpiringSoon: c.status === "ACTIVE" && c.endDate !== null && c.endDate <= warningThreshold,
  }));
}

export async function getActiveContract(employeeId: string) {
  return prisma.contract.findFirst({
    where: { employeeId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
}
