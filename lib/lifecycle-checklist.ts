/**
 * lib/lifecycle-checklist.ts
 *
 * Server-side checklist calculation for onboarding and offboarding.
 *
 * These functions are the AUTHORITATIVE source of truth for checklist
 * completion. The UI re-uses the same types; server actions call these
 * functions directly before allowing completion — client-supplied checklist
 * values are never trusted.
 *
 * IMPORTANT: server-only — never import on the client.
 */
import "server-only";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding (P1-6)
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingChecklist = {
  hasName:        boolean;
  hasDepartment:  boolean;
  hasPosition:    boolean;
  hasHireDate:    boolean;
  hasContract:    boolean;
  hasIdDocument:  boolean;
  hasUserAccount: boolean;
  completedSteps: number;
  totalSteps:     number;
  isComplete:     boolean;
};

/**
 * Recalculates the onboarding checklist from live database state.
 * Never reads checklist values from the client or from a stored boolean field.
 */
export async function computeOnboardingChecklist(
  employeeId: string
): Promise<OnboardingChecklist> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      firstName:    true,
      lastName:     true,
      departmentId: true,
      positionId:   true,
      hireDate:     true,
      userId:       true,
      contracts: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { id: true },
      },
      documents: {
        where: { deletedAt: null, type: "ID_DOCUMENT" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!employee) {
    return {
      hasName: false, hasDepartment: false, hasPosition: false, hasHireDate: false,
      hasContract: false, hasIdDocument: false, hasUserAccount: false,
      completedSteps: 0, totalSteps: 7, isComplete: false,
    };
  }

  const hasName        = !!(employee.firstName && employee.lastName);
  const hasDepartment  = !!employee.departmentId;
  const hasPosition    = !!employee.positionId;
  const hasHireDate    = !!employee.hireDate;
  const hasContract    = employee.contracts.length > 0;
  const hasIdDocument  = employee.documents.length > 0;
  const hasUserAccount = !!employee.userId;

  const steps = [hasName, hasDepartment, hasPosition, hasHireDate, hasContract, hasIdDocument, hasUserAccount];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps     = steps.length;

  return {
    hasName, hasDepartment, hasPosition, hasHireDate,
    hasContract, hasIdDocument, hasUserAccount,
    completedSteps,
    totalSteps,
    isComplete: completedSteps === totalSteps,
  };
}

/**
 * Throws a descriptive error listing which onboarding steps are incomplete.
 * Call this inside completeOnboarding() before doing any DB writes.
 */
export async function requireOnboardingComplete(employeeId: string): Promise<void> {
  const checklist = await computeOnboardingChecklist(employeeId);
  if (checklist.isComplete) return;

  const labels: Record<keyof Omit<OnboardingChecklist, "completedSteps" | "totalSteps" | "isComplete">, string> = {
    hasName:        "Employee name (first and last)",
    hasDepartment:  "Department assignment",
    hasPosition:    "Position assignment",
    hasHireDate:    "Hire date",
    hasContract:    "Active contract",
    hasIdDocument:  "Identity document",
    hasUserAccount: "System user account",
  };

  const missing = (Object.keys(labels) as Array<keyof typeof labels>)
    .filter((k) => !checklist[k])
    .map((k) => labels[k]);

  throw new Error(
    `Onboarding cannot be completed — the following requirements are not yet met: ${missing.join("; ")}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Offboarding (P1-7)
// ─────────────────────────────────────────────────────────────────────────────

export type OffboardingChecklist = {
  hasTerminatedContract:  boolean;
  hasNoActiveLeave:       boolean;
  userAccountDeactivated: boolean;
  completedSteps:         number;
  totalSteps:             number;
  isComplete:             boolean;
};

/**
 * Recalculates the offboarding checklist from live database state.
 */
export async function computeOffboardingChecklist(
  employeeId: string
): Promise<OffboardingChecklist> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      userId: true,
      user:   { select: { banned: true } },
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
    return {
      hasTerminatedContract: true, hasNoActiveLeave: true, userAccountDeactivated: true,
      completedSteps: 3, totalSteps: 3, isComplete: true,
    };
  }

  const hasTerminatedContract  = employee.contracts.length === 0;
  const hasNoActiveLeave        = employee.leaveRequests.length === 0;
  const userAccountDeactivated  = !employee.userId || (employee.user?.banned === true);

  const steps = [hasTerminatedContract, hasNoActiveLeave, userAccountDeactivated];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps     = steps.length;

  return {
    hasTerminatedContract, hasNoActiveLeave, userAccountDeactivated,
    completedSteps,
    totalSteps,
    isComplete: completedSteps === totalSteps,
  };
}

/**
 * Throws a descriptive error listing which offboarding steps are incomplete.
 * Call this inside completeOffboarding() before doing any DB writes.
 */
export async function requireOffboardingComplete(employeeId: string): Promise<void> {
  const checklist = await computeOffboardingChecklist(employeeId);
  if (checklist.isComplete) return;

  const labels: Record<keyof Omit<OffboardingChecklist, "completedSteps" | "totalSteps" | "isComplete">, string> = {
    hasTerminatedContract:  "All active contracts must be terminated or expired",
    hasNoActiveLeave:       "All pending leave requests must be resolved",
    userAccountDeactivated: "System account must be deactivated (banned)",
  };

  const missing = (Object.keys(labels) as Array<keyof typeof labels>)
    .filter((k) => !checklist[k])
    .map((k) => labels[k]);

  throw new Error(
    `Offboarding cannot be completed — the following requirements are not yet met: ${missing.join("; ")}.`
  );
}
