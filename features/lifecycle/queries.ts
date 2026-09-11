import "server-only";
import prisma from "@/lib/prisma";

// ── Onboarding checklist (computed from real data, never stored) ─────────────

export type OnboardingChecklist = {
  hasName: boolean;
  hasDepartment: boolean;
  hasPosition: boolean;
  hasHireDate: boolean;
  hasContract: boolean;
  hasIdDocument: boolean;
  hasUserAccount: boolean;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
};

export async function getOnboardingChecklist(employeeId: string): Promise<OnboardingChecklist> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      firstName: true,
      lastName: true,
      departmentId: true,
      positionId: true,
      hireDate: true,
      userId: true,
      contracts: { where: { status: "ACTIVE" }, take: 1, select: { id: true } },
      documents: {
        where: { deletedAt: null, type: "ID_DOCUMENT" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!employee) {
    return { hasName: false, hasDepartment: false, hasPosition: false, hasHireDate: false, hasContract: false, hasIdDocument: false, hasUserAccount: false, completedSteps: 0, totalSteps: 7, isComplete: false };
  }

  const hasName        = !!employee.firstName && !!employee.lastName;
  const hasDepartment  = !!employee.departmentId;
  const hasPosition    = !!employee.positionId;
  const hasHireDate    = !!employee.hireDate;
  const hasContract    = employee.contracts.length > 0;
  const hasIdDocument  = employee.documents.length > 0;
  const hasUserAccount = !!employee.userId;

  const steps = [hasName, hasDepartment, hasPosition, hasHireDate, hasContract, hasIdDocument, hasUserAccount];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = steps.length;

  return {
    hasName,
    hasDepartment,
    hasPosition,
    hasHireDate,
    hasContract,
    hasIdDocument,
    hasUserAccount,
    completedSteps,
    totalSteps,
    isComplete: completedSteps === totalSteps,
  };
}

// ── Offboarding checklist (computed from real data) ──────────────────────────

export type OffboardingChecklist = {
  hasTerminatedContract: boolean;
  hasNoActiveLeave: boolean;
  userAccountDeactivated: boolean;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
};

export async function getOffboardingChecklist(employeeId: string): Promise<OffboardingChecklist> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      userId: true,
      user: { select: { banned: true } },
      contracts: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { id: true },
      },
      leaveRequests: {
        where: { status: "PENDING" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!employee) {
    return { hasTerminatedContract: true, hasNoActiveLeave: true, userAccountDeactivated: true, completedSteps: 3, totalSteps: 3, isComplete: true };
  }

  // No active contract = contract already closed/terminated/expired
  const hasTerminatedContract = employee.contracts.length === 0;
  // No pending leave requests
  const hasNoActiveLeave       = employee.leaveRequests.length === 0;
  // User account is deactivated (banned) or employee has no account
  const userAccountDeactivated = !employee.userId || (employee.user?.banned === true);

  const steps = [hasTerminatedContract, hasNoActiveLeave, userAccountDeactivated];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = steps.length;

  return {
    hasTerminatedContract,
    hasNoActiveLeave,
    userAccountDeactivated,
    completedSteps,
    totalSteps,
    isComplete: completedSteps === totalSteps,
  };
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
      position: { select: { name: true } },
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
      position: { select: { name: true } },
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
      documents: {
        none: { type: "ID_DOCUMENT", deletedAt: null },
      },
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      onboardingRecord: { select: { startedAt: true } },
    },
    take: 20,
  });
}

/** Active contracts expiring within the next 30 days. */
export async function getContractsExpiringSoon(daysAhead = 30) {
  const today = new Date();
  const cutoff = new Date();
  cutoff.setDate(today.getDate() + daysAhead);

  return prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gte: today, lte: cutoff },
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

/** Employees currently being offboarded (offboardingRecord present, completedAt null). */
export async function getOffboardingEmployees() {
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
    where: {
      deletedAt: { gte: sixtyDaysAgo, not: null },
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
      department: { select: { name: true } },
      deletedAt: true,
      offboardingRecord: { select: { reason: true } },
    },
    orderBy: { deletedAt: "desc" },
    take: 10,
  });
}

/** Single lifecycle record for an employee profile page. */
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
          completedBy: { select: { id: true, name: true } },
        },
      },
      offboardingRecord: {
        select: {
          reason: true,
          lastWorkingDate: true,
          startedAt: true,
          completedAt: true,
          notes: true,
          startedBy: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** Summary counts for the lifecycle dashboard stat cards. */
export async function getLifecycleSummaryCounts() {
  const today = new Date();
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(today.getDate() + 30);

  const [
    onboarding,
    missingDocs,
    expiring,
    offboarding,
  ] = await Promise.all([
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
        status: "ACTIVE",
        endDate: { gte: today, lte: thirtyDaysOut },
        employee: { deletedAt: null },
      },
    }),
    prisma.employee.count({
      where: { deletedAt: null, offboardingRecord: { completedAt: null } },
    }),
  ]);

  return { onboarding, missingDocs, expiring, offboarding };
}
