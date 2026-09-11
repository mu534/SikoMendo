"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { createNotification } from "@/lib/notifications";
import {
  completeOnboardingSchema,
  completeOnboardingFormDataToObject,
  startOffboardingSchema,
  startOffboardingFormDataToObject,
  completeOffboardingSchema,
  completeOffboardingFormDataToObject,
} from "./schemas";

// ── Shared audit helper ────────────────────────────────────────────────────

async function logAudit(
  action: string,
  entity: string,
  entityId: string,
  changes: unknown,
  userId?: string
) {
  await prisma.auditLog.create({
    data: { action, entity, entityId, changes: changes as object, userId },
  });
}

// ── Onboarding ─────────────────────────────────────────────────────────────

/**
 * Called automatically by createEmployee (in features/employees/actions.ts)
 * whenever a new employee is created. Creates the OnboardingRecord and ensures
 * the employee starts in ONBOARDING status.
 *
 * Exported so createEmployee can call it within a transaction or immediately
 * after — but it can also be called directly by HR to initialise onboarding
 * for legacy employees who are already in the system.
 */
export async function startOnboarding(
  employeeId: string,
  responsibleHrId?: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ONBOARDING", async () => {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        onboardingRecord: true,
        user: { select: { id: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.onboardingRecord) {
      // Idempotent — already has an onboarding record
      return { id: employee.onboardingRecord.id };
    }

    const [record] = await prisma.$transaction([
      prisma.onboardingRecord.create({
        data: {
          employeeId,
          responsibleHrId: responsibleHrId ?? session!.user.id,
        },
      }),
      prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: "ONBOARDING" },
      }),
    ]);

    await logAudit(
      "ONBOARDING_STARTED",
      "Employee",
      employeeId,
      { startedBy: session?.user.name, responsibleHrId: responsibleHrId ?? session?.user.id },
      session?.user.id
    );

    // Notify the responsible HR officer
    const hrId = responsibleHrId ?? session?.user.id;
    if (hrId) {
      await createNotification(
        hrId,
        "ONBOARDING_STARTED",
        "Onboarding started",
        `Onboarding for ${employee.firstName} ${employee.lastName} has been initiated and requires your attention.`
      ).catch(() => {/* non-fatal */});
    }

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees/lifecycle");
    return { id: record.id };
  });
}

/**
 * Marks onboarding as complete and transitions the employee to ACTIVE.
 * HR must confirm that checklist steps are done before calling this.
 */
export async function completeOnboarding(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_ONBOARDING", async () => {
    const parsed = completeOnboardingSchema.safeParse(
      completeOnboardingFormDataToObject(formData)
    );
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employmentStatus: true,
        onboardingRecord: { select: { id: true, completedAt: true } },
        user: { select: { id: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.employmentStatus !== "ONBOARDING") {
      throw new Error(
        "This employee is not in the ONBOARDING state. Only onboarding employees can be completed."
      );
    }
    if (!employee.onboardingRecord) {
      throw new Error("No onboarding record found for this employee.");
    }
    if (employee.onboardingRecord.completedAt) {
      throw new Error("Onboarding is already marked as complete.");
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.onboardingRecord.update({
        where: { employeeId },
        data: {
          completedAt: now,
          completedById: session!.user.id,
          notes: parsed.data.notes,
        },
      }),
      prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: "ACTIVE" },
      }),
    ]);

    await logAudit(
      "ONBOARDING_COMPLETED",
      "Employee",
      employeeId,
      { completedBy: session?.user.name, notes: parsed.data.notes },
      session?.user.id
    );

    // Notify the employee's linked user account
    if (employee.user?.id) {
      await createNotification(
        employee.user.id,
        "ONBOARDING_COMPLETED",
        "Onboarding complete",
        `Your onboarding process has been completed. Welcome, ${employee.firstName}!`
      ).catch(() => {/* non-fatal */});
    }

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees/lifecycle");
    return { id: employee.onboardingRecord.id };
  });
}

// ── Offboarding ────────────────────────────────────────────────────────────

/**
 * Initiates the offboarding process for an employee.
 * Sets the appropriate terminal EmploymentStatus and creates an OffboardingRecord.
 * Does NOT immediately archive — HR must complete the checklist first.
 */
export async function startOffboarding(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OFFBOARDING", async () => {
    const parsed = startOffboardingSchema.safeParse(
      startOffboardingFormDataToObject(formData)
    );
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employmentStatus: true,
        deletedAt: true,
        offboardingRecord: { select: { id: true } },
        user: { select: { id: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt) throw new Error("This employee is already archived.");
    if (employee.offboardingRecord) {
      throw new Error("Offboarding has already been initiated for this employee.");
    }

    // Map offboarding reason to the closest EmploymentStatus terminal state
    const reasonToStatus: Record<string, string> = {
      RESIGNATION:  "RESIGNED",
      RETIREMENT:   "RETIRED",
      CONTRACT_END: "INACTIVE",
      TERMINATION:  "TERMINATED",
      OTHER:        "INACTIVE",
    };
    const newStatus = reasonToStatus[parsed.data.reason] ?? "INACTIVE";

    const lastWorkingDate = parsed.data.lastWorkingDate
      ? new Date(`${parsed.data.lastWorkingDate}T00:00:00.000Z`)
      : null;

    const [record] = await prisma.$transaction([
      prisma.offboardingRecord.create({
        data: {
          employeeId,
          reason: parsed.data.reason,
          lastWorkingDate,
          notes: parsed.data.notes,
          startedById: session!.user.id,
        },
      }),
      prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: newStatus as never },
      }),
    ]);

    await logAudit(
      "OFFBOARDING_STARTED",
      "Employee",
      employeeId,
      {
        reason: parsed.data.reason,
        newStatus,
        lastWorkingDate: parsed.data.lastWorkingDate,
        startedBy: session?.user.name,
      },
      session?.user.id
    );

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees/lifecycle");
    return { id: record.id };
  });
}

/**
 * Completes offboarding: archives the employee (sets deletedAt), deactivates
 * their user account via Better Auth ban, and closes the OffboardingRecord.
 *
 * This is the point of no return for the normal HR workflow. The employee
 * can be restored by an Admin using restoreEmployee in the employees module.
 */
export async function completeOffboarding(
  employeeId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OFFBOARDING", async () => {
    const parsed = completeOffboardingSchema.safeParse(
      completeOffboardingFormDataToObject(formData)
    );
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        offboardingRecord: { select: { id: true, completedAt: true } },
        user: { select: { id: true, banned: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt) throw new Error("This employee is already archived.");
    if (!employee.offboardingRecord) {
      throw new Error("Offboarding has not been initiated. Start offboarding first.");
    }
    if (employee.offboardingRecord.completedAt) {
      throw new Error("Offboarding is already marked as complete.");
    }

    const now = new Date();

    // Archive employee + close offboarding record in a transaction
    await prisma.$transaction([
      prisma.offboardingRecord.update({
        where: { employeeId },
        data: {
          completedAt: now,
          completedById: session!.user.id,
          notes: parsed.data.notes
            ? `${parsed.data.notes}`
            : undefined,
        },
      }),
      prisma.employee.update({
        where: { id: employeeId },
        data: { deletedAt: now },
      }),
    ]);

    // Deactivate linked user account (ban via Better Auth)
    // Non-fatal — if this fails, the archive still stands; an Admin can ban manually
    if (employee.user && !employee.user.banned) {
      try {
        await auth.api.banUser({
          headers: await headers(),
          body: {
            userId: employee.user.id,
            banReason: "Employee offboarded — account deactivated by HR.",
          },
        });
        await logAudit(
          "DEACTIVATE",
          "User",
          employee.user.id,
          { reason: "Offboarding completed", deactivatedBy: session?.user.name },
          session?.user.id
        );
      } catch {
        // Log the failure but don't roll back the archive
        console.error(`[completeOffboarding] Failed to ban user ${employee.user.id}`);
      }
    }

    await logAudit(
      "OFFBOARDING_COMPLETED",
      "Employee",
      employeeId,
      { completedBy: session?.user.name, notes: parsed.data.notes, archived: true },
      session?.user.id
    );

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees");
    revalidatePath("/employees/lifecycle");
    return { id: employee.offboardingRecord.id };
  });
}

/**
 * Cancels an in-progress offboarding and restores the employee to ACTIVE.
 * Only available while offboarding is not yet completed (completedAt is null).
 */
export async function cancelOffboarding(
  employeeId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OFFBOARDING", async () => {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        offboardingRecord: { select: { id: true, completedAt: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (!employee.offboardingRecord) throw new Error("No active offboarding found.");
    if (employee.offboardingRecord.completedAt) {
      throw new Error("Cannot cancel a completed offboarding.");
    }

    const recordId = employee.offboardingRecord.id;

    await prisma.$transaction([
      prisma.offboardingRecord.delete({ where: { employeeId } }),
      prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: "ACTIVE" },
      }),
    ]);

    await logAudit(
      "OFFBOARDING_CANCELLED",
      "Employee",
      employeeId,
      { cancelledBy: session?.user.name },
      session?.user.id
    );

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees/lifecycle");
    return { id: recordId };
  });
}
