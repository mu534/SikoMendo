/**
 * lib/employee-access.ts
 *
 * Centralised server-side helpers for employee access control and business-rule
 * validation. Every module that touches employee data should import from here
 * rather than duplicating logic.
 *
 * IMPORTANT: All functions are server-only.
 */
import "server-only";
import prisma from "@/lib/prisma";
import { can, type Role } from "@/lib/permissions";
import type { AuthSession } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scoped employee access (P0-1 / P0-2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Viewer capability levels used throughout employee detail queries.
 *
 * FULL   – Admin / HR Officer: unrestricted access to all data.
 * SCOPED – Manager: can view subordinates; restricted to non-sensitive fields.
 * NONE   – Employee / unauthenticated: no access to other employees.
 */
export type ViewerCapability = "FULL" | "SCOPED" | "NONE";

/** Derive the viewer's capability from their role. */
export function resolveViewerCapability(role: string | undefined): ViewerCapability {
  if (role === "ADMIN" || role === "HR_OFFICER") return "FULL";
  if (role === "MANAGER") return "SCOPED";
  return "NONE";
}

/**
 * Returns a scoped employee record for a given viewer, or null when the
 * viewer does not have access.
 *
 * - ADMIN / HR_OFFICER: access any employee, full data.
 * - MANAGER: access only employees in their reporting hierarchy; receives a
 *   reduced field set (no documents, no contracts, no user account details).
 * - EMPLOYEE / unknown: access denied → always returns null.
 *
 * Callers must treat null as "not found" — do not reveal whether the employee
 * exists to unauthorised viewers.
 */
export async function getEmployeeByIdForViewer(
  employeeId: string,
  session: AuthSession | null
) {
  if (!session?.user) return null;
  const capability = resolveViewerCapability(session.user.role);
  if (capability === "NONE") return null;

  // FULL viewer: unrestricted
  if (capability === "FULL") {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department:  { select: { id: true, name: true } },
        position:    { select: { id: true, name: true, departmentId: true } },
        user:        { select: { id: true, email: true, username: true, role: true, banned: true, mustChangePassword: true } },
        documents:   { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        manager:     { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        employmentHistory: {
          include: {
            department: { select: { name: true } },
            position:   { select: { name: true } },
          },
          orderBy: { effectiveDate: "desc" },
        },
        contracts: { orderBy: { startDate: "desc" } },
      },
    });
  }

  // SCOPED viewer (Manager): first verify the employee is in their hierarchy
  const viewerEmployee = await prisma.employee.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { id: true },
  });

  if (!viewerEmployee) return null; // Manager has no linked employee record

  const subordinateIds = await getSubordinateIds(viewerEmployee.id);
  if (!subordinateIds.includes(employeeId)) return null; // Not in hierarchy

  // Return limited fields — no documents, no contracts, no user/security info
  return prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: { select: { id: true, name: true } },
      position:   { select: { id: true, name: true, departmentId: true } },
      manager:    { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      employmentHistory: {
        include: {
          department: { select: { name: true } },
          position:   { select: { name: true } },
        },
        orderBy: { effectiveDate: "desc" },
      },
      // Sensitive relations intentionally omitted for MANAGER:
      // user, documents, contracts
    },
  });
}

/** BFS traversal — returns all employee IDs that ultimately report to managerId. */
export async function getSubordinateIds(managerId: string): Promise<string[]> {
  const all: string[] = [];
  let currentLevel = [managerId];

  while (currentLevel.length > 0) {
    const next = await prisma.employee.findMany({
      where: { managerId: { in: currentLevel }, deletedAt: null },
      select: { id: true },
    });
    const nextIds = next.map((e) => e.id);
    all.push(...nextIds);
    currentLevel = nextIds;
  }

  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Manager assignment validation (P0-3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that `managerId` is a safe assignment for `employeeId`.
 *
 * Rejects:
 *  - Employee managing themselves
 *  - A descendant becoming the ancestor (would create a cycle)
 *  - Archived managers (deletedAt not null)
 *  - Non-existent manager IDs
 *
 * @throws Error with a user-facing message on any violation.
 */
export async function validateManagerAssignment(
  employeeId: string,
  managerId: string | null | undefined
): Promise<void> {
  if (!managerId) return; // Null manager is always valid

  if (managerId === employeeId) {
    throw new Error("An employee cannot be assigned as their own manager.");
  }

  const manager = await prisma.employee.findUnique({
    where: { id: managerId },
    select: { id: true, firstName: true, lastName: true, deletedAt: true },
  });

  if (!manager) {
    throw new Error("The selected manager does not exist.");
  }

  if (manager.deletedAt) {
    throw new Error(
      `${manager.firstName} ${manager.lastName} is archived and cannot be assigned as a manager.`
    );
  }

  // Detect cycle: if the proposed manager is already a descendant of the employee,
  // assigning them as manager would create a cycle.
  const subordinateIds = await getSubordinateIds(employeeId);
  if (subordinateIds.includes(managerId)) {
    throw new Error(
      `Cannot assign ${manager.firstName} ${manager.lastName} as manager — they currently report (directly or transitively) to this employee. This would create a reporting cycle.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Contract ownership validation (P0-4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that a contract belongs to the specified employee.
 * Throws a safe error (no information leak) if either does not exist or
 * the contract belongs to a different employee.
 */
export async function assertContractBelongsToEmployee(
  contractId: string,
  employeeId: string
): Promise<{ id: string; employeeId: string; status: string }> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, employeeId: true, status: true },
  });

  if (!contract || contract.employeeId !== employeeId) {
    throw new Error("Contract not found.");
  }

  return contract;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Document ownership validation (P0-5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that a document belongs to the specified employee.
 * Returns the full document row so callers can proceed with deletion/update.
 * Throws a safe error (no information leak) on mismatch.
 */
export async function assertDocumentBelongsToEmployee(
  documentId: string,
  employeeId: string
) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.employeeId !== employeeId) {
    throw new Error("Document not found.");
  }

  return document;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Department / Position relationship validation (P2-11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that the given position belongs to the given department.
 * Also checks both are active.
 * Throws a user-facing error on mismatch.
 */
export async function assertPositionInDepartment(
  positionId: string,
  departmentId: string
): Promise<void> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, name: true, departmentId: true, isActive: true, department: { select: { name: true, isActive: true } } },
  });

  if (!position) {
    throw new Error("The selected position does not exist.");
  }
  if (!position.isActive) {
    throw new Error(`Position "${position.name}" is inactive and cannot be used.`);
  }
  if (position.departmentId !== departmentId) {
    throw new Error(
      `Position "${position.name}" does not belong to the selected department. Select a position within the correct department.`
    );
  }
  if (!position.department.isActive) {
    throw new Error(`Department "${position.department.name}" is inactive and cannot be used.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Lifecycle status protection (P1-8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Statuses that may ONLY be set through dedicated lifecycle actions.
 * updateEmployee() must NOT allow these to be written directly.
 */
export const LIFECYCLE_CONTROLLED_STATUSES = new Set([
  "ACTIVE",
  "RESIGNED",
  "RETIRED",
  "TERMINATED",
  "INACTIVE",
]);

/**
 * Statuses that a direct employee update is allowed to set.
 * Currently only ONBOARDING (initial state) and ON_LEAVE/SUSPENDED
 * which are administrative adjustments that don't require a full
 * lifecycle workflow.
 */
export const DIRECTLY_EDITABLE_STATUSES = new Set([
  "ONBOARDING",
  "ON_LEAVE",
  "SUSPENDED",
]);

/**
 * Throws if the caller is attempting to change the employment status to a
 * lifecycle-controlled value via the general update form.
 *
 * @param currentStatus  The employee's current status in the DB.
 * @param submittedStatus The status submitted via the edit form.
 */
export function assertStatusChangeAllowed(
  currentStatus: string,
  submittedStatus: string
): void {
  if (submittedStatus === currentStatus) return; // No change — always OK

  if (LIFECYCLE_CONTROLLED_STATUSES.has(submittedStatus)) {
    throw new Error(
      `Cannot change employment status to "${submittedStatus}" from the edit form. ` +
      `Use the Lifecycle tab to manage onboarding, offboarding, or status transitions.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Archiving guard (P1-9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that an employee is safe to archive directly.
 *
 * ACTIVE employees must go through the offboarding workflow first.
 * Terminal statuses (RESIGNED, TERMINATED, RETIRED, INACTIVE) can be archived
 * directly — they have already passed through the offboarding flow.
 *
 * ADMIN users with MANAGE_EMPLOYEES can force-archive any status for exceptional
 * administrative recovery, but it will be flagged in the error message.
 *
 * @param employeeId  The ID of the employee being archived.
 * @param callerRole  The role of the person calling archiveEmployee().
 */
export async function assertArchiveSafe(
  employeeId: string,
  callerRole: string
): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employmentStatus: true, deletedAt: true, firstName: true, lastName: true },
  });

  if (!employee) throw new Error("Employee not found.");
  if (employee.deletedAt) throw new Error("Employee is already archived.");

  const blockedStatuses = new Set(["ACTIVE", "ONBOARDING", "ON_LEAVE"]);

  if (blockedStatuses.has(employee.employmentStatus)) {
    // ADMIN can force-archive with a clear error explaining the situation,
    // but only if they explicitly confirm — for now we always block to enforce workflow.
    // If you need an admin override, add a `force` parameter and log an audit event.
    throw new Error(
      `${employee.firstName} ${employee.lastName} is currently ${employee.employmentStatus}. ` +
      `Use the Lifecycle tab to initiate and complete offboarding before archiving.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Restore semantics (P1-10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that an employee can be safely restored and returns the employment
 * status that should remain after restoration.
 *
 * Restoring is NOT rehiring. The employee retains their pre-archive status
 * (TERMINATED, RESIGNED, RETIRED, etc.). Only deletedAt is cleared.
 *
 * If the employee was ACTIVE (e.g. accidentally archived by admin), they are
 * restored to their terminal/pre-archive status — never blindly to ACTIVE unless
 * they were never in a terminal status.
 */
export async function assertRestoreSafe(employeeId: string): Promise<{ keepStatus: string }> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, deletedAt: true, employmentStatus: true },
  });

  if (!employee) throw new Error("Employee not found.");
  if (!employee.deletedAt) throw new Error("Employee is not archived.");

  // The status is preserved as-is — no automatic promotion to ACTIVE.
  return { keepStatus: employee.employmentStatus };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Viewer permission check for sensitive tabs (P0-2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns which tabs a viewer role can access on the employee detail page.
 */
export function getEmployeeDetailTabPermissions(role: string | undefined) {
  const isFullViewer = role === "ADMIN" || role === "HR_OFFICER";
  const isManager    = role === "MANAGER";

  return {
    canViewOverview:    isFullViewer || isManager,
    canViewHistory:     isFullViewer || isManager, // limited for manager — no role change
    canViewContracts:   isFullViewer,              // sensitive — admin/HR only
    canViewDocuments:   isFullViewer,              // sensitive — admin/HR only
    canViewLifecycle:   isFullViewer || isManager, // managers can view lifecycle status
    canViewSystemAccount: isFullViewer && role === "ADMIN", // admin only
    isFullViewer,
    isManager,
  } as const;
}
