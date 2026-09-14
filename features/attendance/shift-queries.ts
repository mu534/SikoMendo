import "server-only";
import prisma from "@/lib/prisma";

export type ShiftRow = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  _count: { employees: number };
};

/** All shifts ordered by name. */
export async function listShifts(): Promise<ShiftRow[]> {
  return prisma.workShift.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
}

/** Active shifts only — used by attendance evaluation and dropdowns. */
export async function listActiveShifts(): Promise<ShiftRow[]> {
  return prisma.workShift.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
}
