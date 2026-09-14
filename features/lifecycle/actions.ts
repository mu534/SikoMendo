"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { createNotification } from "@/lib/notifications";
import { requireOnboardingComplete, requireOffboardingComplete } from "@/lib/lifecycle-checklist";
import { getActiveOffboardingRecord } from "./queries";
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
 * Creates an OnboardingRecord and ensures the employee starts in ONBOARDING status.
 * Called by createEmployee — idempotent if a record already exists.
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
 *
 * P1-6: Server-side checklist is recomputed from the DB — client-supplied
 * values are never trusted. All mandatory requirements must be met before
 * the status transition occurs.
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

    // P1-6: Recompute checklist from DB — never trust client
    await requireOnboardingComplete(employeeId);

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
 *
 * P2-15: OffboardingRecord is now one-to-many. We check for an *active*
 * (not cancelled, not completed) offboarding record rather than any record.
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
        user: { select: { id: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt) throw new Error("This employee is already archived.");

    // P2-15: check for an active (not cancelled/completed) offboarding record
    const activeOffboarding = await getActiveOffboardingRecord(employeeId);
    if (activeOffboarding) {
      throw new Error("Offboarding has already been initiated for this employee.");
    }

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

    const record = await prisma.$transaction(async (tx) => {
      const [offboardingRecord] = await Promise.all([
        tx.offboardingRecord.create({
          data: {
            employeeId,
            reason: parsed.data.reason,
            lastWorkingDate,
            notes: parsed.data.notes,
            startedById: session!.user.id,
          },
        }),
        tx.employee.update({
          where: { id: employeeId },
          data: { employmentStatus: newStatus as never },
        }),
      ]);
      return offboardingRecord;
    });

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
 * Completes offboarding: archives the employee, deactivates their user account,
 * and closes the OffboardingRecord.
 *
 * P1-7: Server-side offboarding checklist is recomputed from the DB before
 * allowing completion — client-supplied checklist values are never trusted.
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
        user: { select: { id: true, banned: true } },
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.deletedAt) throw new Error("This employee is already archived.");

    // P2-15: find the active offboarding record
    const activeRecord = await getActiveOffboardingRecord(employeeId);
    if (!activeRecord) {
      throw new Error("Offboarding has not been initiated. Start offboarding first.");
    }

    // P1-7: Recompute checklist from DB — never trust client
    await requireOffboardingComplete(employeeId);

    const now = new Date();

    await prisma.$transaction([
      prisma.offboardingRecord.update({
        where: { id: activeRecord.id },
        data: {
          completedAt: now,
          completedById: session!.user.id,
          notes: parsed.data.notes ?? undefined,
        },
      }),
      prisma.employee.update({
        where: { id: employeeId },
        data: { deletedAt: now },
      }),
    ]);

    // Deactivate linked user account (ban via Better Auth) — non-fatal
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
    return { id: activeRecord.id };
  });
}

/**
 * Cancels an in-progress offboarding and restores the employee to ACTIVE.
 *
 * P2-14 intent: preserve the record with cancelledAt instead of deleting so
 * the audit trail is kept. This requires migration 20260914200000 to be applied.
 * Until that migration runs on the target DB, we fall back to the previous
 * behaviour (delete the record) so the action doesn't crash at runtime.
 * Once the migration is confirmed applied, replace the delete with:
 *   prisma.offboardingRecord.update({ where: { id }, data: { cancelledAt, cancelledById } })
 */
export async function cancelOffboarding(
  employeeId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_OFFBOARDING", async () => {
    const activeRecord = await getActiveOffboardingRecord(employeeId);
    if (!activeRecord) throw new Error("No active offboarding found.");

    const recordId = activeRecord.id;

    await prisma.$transaction([
      // Delete the record for now — replace with cancelledAt update after
      // migration 20260914200000 is applied on the target database.
      prisma.offboardingRecord.delete({ where: { id: recordId } }),
      prisma.employee.update({
        where: { id: employeeId },
        data:  { employmentStatus: "ACTIVE" },
      }),
    ]);

    await logAudit(
      "OFFBOARDING_CANCELLED",
      "Employee",
      employeeId,
      { cancelledBy: session?.user.name, recordId },
      session?.user.id
    );

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees/lifecycle");
    return { id: recordId };
  });
}
