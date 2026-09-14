import "server-only";
import prisma from "@/lib/prisma";

// Re-export checklist types and computation from the canonical location so
// existing imports in pages/components continue to work.
export type { OnboardingChecklist, OffboardingChecklist } from "@/lib/lifecycle-checklist";
export {
  computeOnboardingChecklist as getOnboardingChecklist,
  computeOffboardingChecklist as getOffboardingChecklist,
} from "@/lib/lifecycle-checklist";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the single in-progress OffboardingRecord for an employee, or null.
 *
 * NOTE: The DB still has the pre-migration schema where offboarding_record has
 * a UNIQUE constraint on employeeId (one-to-one). Migration
 * 20260914200000_offboarding_one_to_many_with_cancel must be applied before
 * the one-to-many features (cancelledAt, plural relation) are usable.
 * Until then we query offboardingRecord directly via the Employee relation.
 */
export async function getActiveOffboardingRecord(employeeId: string) {
  return prisma.offboardingRecord.findFirst({
    where: {
      employeeId,
      completedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });
}

/** Returns the most recent OffboardingRecord for display purposes. */
export async function getLatestOffboardingRecord(employeeId: string) {
  return prisma.offboardingRecord.findFirst({
    where: { employeeId },
    orderBy: { startedAt: "desc" },
    include: {
      startedBy:   { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
  });
}

// ── Lifecycle dashboard queries ──────────────────────────────────────────────

/** Employees currently in ONBOARDING status. */
export async function getOnboardingEmployees() {
  return prisma.employee.findMany({
    where: { employmentStatus: "ONBOARDING", deletedAt: null },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      hireDate: true,
      department: { select: { name: true } },
      position:   { select: { name: true } },
      onboardingRecord: {
        select: { startedAt: true, responsibleHr: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/** Recently completed onboardings (last 30 days). */
export async function getRecentlyOnboardedEmployees() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return prisma.employee.findMany({
    where: {
      employmentStatus: "ACTIVE",
      deletedAt: null,
      onboardingRecord: { completedAt: { gte: thirtyDaysAgo } },
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      department: { select: { name: true } },
      position:   { select: { name: true } },
      onboardingRecord: { select: { completedAt: true } },
    },
    orderBy: { onboardingRecord: { completedAt: "desc" } },
    take: 10,
  });
}

/** Employees in ONBOARDING who are still missing required documents. */
export async function getEmployeesMissingDocuments() {
  return prisma.employee.findMany({
    where: {
      employmentStatus: "ONBOARDING",
      deletedAt: null,
      documents: { none: { type: "ID_DOCUMENT", deletedAt: null } },
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department:       { select: { name: true } },
      onboardingRecord: { select: { startedAt: true } },
    },
    take: 20,
  });
}

/** Active contracts expiring within the next 30 days. */
export async function getContractsExpiringSoon(daysAhead = 30) {
  const today  = new Date();
  const cutoff = new Date();
  cutoff.setDate(today.getDate() + daysAhead);

  return prisma.contract.findMany({
    where: {
      status:   "ACTIVE",
      endDate:  { gte: today, lte: cutoff },
      employee: { deletedAt: null },
    },
    select: {
      id: true,
      contractType: true,
      endDate: true,
      employee: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { endDate: "asc" },
    take: 20,
  });
}

/** Employees currently being offboarded (active offboarding record exists). */
export async function getOffboardingEmployees() {
  // Use the singular offboardingRecord relation (pre-migration schema)
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      offboardingRecord: { completedAt: null },
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      department: { select: { name: true } },
      offboardingRecord: {
        select: {
          reason: true,
          lastWorkingDate: true,
          startedAt: true,
          startedBy: { select: { name: true } },
        },
      },
    },
    orderBy: { offboardingRecord: { startedAt: "desc" } },
    take: 20,
  });
}

/** Recently archived employees (last 60 days). */
export async function getRecentlyArchivedEmployees() {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  return prisma.employee.findMany({
    where: { deletedAt: { gte: sixtyDaysAgo, not: null } },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      department:  { select: { name: true } },
      deletedAt:   true,
      // singular relation — pre-migration schema
      offboardingRecord: { select: { reason: true } },
    },
    orderBy: { deletedAt: "desc" },
    take: 10,
  });
}

/** Single lifecycle record for the employee profile Lifecycle tab. */
export async function getEmployeeLifecycleRecord(employeeId: string) {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      employmentStatus: true,
      hireDate: true,
      deletedAt: true,
      onboardingRecord: {
        select: {
          startedAt: true,
          completedAt: true,
          notes: true,
          responsibleHr: { select: { id: true, name: true } },
          completedBy:   { select: { id: true, name: true } },
        },
      },
      // singular relation — pre-migration schema
      offboardingRecord: {
        select: {
          reason: true,
          lastWorkingDate: true,
          startedAt: true,
          completedAt: true,
          notes: true,
          startedBy:   { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** Summary counts for the lifecycle dashboard stat cards. */
export async function getLifecycleSummaryCounts() {
  const today         = new Date();
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(today.getDate() + 30);

  const [onboarding, missingDocs, expiring, offboarding] = await Promise.all([
    prisma.employee.count({ where: { employmentStatus: "ONBOARDING", deletedAt: null } }),
    prisma.employee.count({
      where: {
        employmentStatus: "ONBOARDING",
        deletedAt: null,
        documents: { none: { type: "ID_DOCUMENT", deletedAt: null } },
      },
    }),
    prisma.contract.count({
      where: {
        status:   "ACTIVE",
        endDate:  { gte: today, lte: thirtyDaysOut },
        employee: { deletedAt: null },
      },
    }),
    // Active offboardings — singular relation (pre-migration schema)
    prisma.employee.count({
      where: {
        deletedAt: null,
        offboardingRecord: { completedAt: null },
      },
    }),
  ]);

  return { onboarding, missingDocs, expiring, offboarding };
}
