"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { createUserSchema, updateUserSchema, createManagerAccountSchema, createManagerWithEmployeeSchema } from "./schemas";
import { generateTempPassword } from "@/lib/credentials";
import { createNotification } from "@/lib/notifications";
import { generateUsernameFromName } from "@/lib/username-utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { assertSingleGeneralManager, assertSingleManagerPerDepartment } from "@/lib/employee-access";
import { generateNextEmployeeId } from "@/features/employees/queries";
import { getActiveGeneralManager } from "./queries";
import type { Gender, MaritalStatus, EmploymentType } from "@prisma/client";

function getPhotoFile(formData: FormData): File | null {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}



/**
 * Derives a unique username + temporary password from a full name.
 * Called client-side via useTransition so the admin sees the credentials
 * before submitting the create-user form.
 */
/**
 * Creates a login account for an existing Employee, using their Employee ID
 * as the username (e.g. EMP-0001). The username is derived server-side from
 * the employee record — the client only submits the employee internal ID and
 * the desired role. This prevents username spoofing via the form payload.
 */
export async function createEmployeeLoginAccount(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ userId: string; username: string; password: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const employeeId = String(formData.get("employeeId") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();

    if (!employeeId) throw new Error("Employee ID is required.");
    if (!role) throw new Error("Role is required.");

    // Prevent creating a second General Manager
    if (role === "MANAGER") {
      await assertSingleGeneralManager();
    }

    // FEAT-001: Prevent creating a second Department Manager for the same dept;
    // also require a departmentId when assigning DEPT_MANAGER.
    let deptId = "";
    if (role === "DEPT_MANAGER") {
      deptId = String(formData.get("departmentId") ?? "").trim();
      if (!deptId) {
        throw new Error("A department must be selected when assigning the Department Manager role.");
      }
      await assertSingleManagerPerDepartment(deptId);
    }

    // Load the employee to get their Employee ID (e.g. EMP-0001) and full name
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeId: true, firstName: true, middleName: true, lastName: true, userId: true },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.userId) throw new Error("This employee already has a login account.");

    // Username = Employee ID in lowercase (e.g. "emp-0001").
    // Better Auth's username plugin normalises to lowercase on sign-in lookup,
    // so the stored value must already be lowercase or the lookup won't match.
    const username = employee.employeeId.toLowerCase();

    // Check the username isn't already taken (shouldn't be, but guard it)
    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    if (existingByUsername) {
      throw new Error(`Username ${username} is already in use.`);
    }

    // Deterministic internal email — never shown in UI, never used for login
    const internalEmail = `${username.toLowerCase()}@internal.sikomendo.local`;
    const existingByEmail = await prisma.user.findUnique({ where: { email: internalEmail } });
    if (existingByEmail) {
      throw new Error("An account with this Employee ID already exists.");
    }

    const fullName = [employee.firstName, employee.middleName, employee.lastName]
      .filter(Boolean)
      .join(" ");

    const tempPassword = generateTempPassword();

    const { user } = await auth.api.createUser({
      headers: await headers(),
      body: { name: fullName, email: internalEmail, password: tempPassword },
    });

    // Set username, role, force-change, link employee — and if DEPT_MANAGER,
    // also update Department.managerId — all in one Serializable transaction to
    // prevent a race where two simultaneous requests both pass assertSingleManagerPerDepartment.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          username,
          displayUsername: username,
          role: role as import("@prisma/client").Role,
          mustChangePassword: true,
        },
      });

      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: user.id },
      });

      // FEAT-001: Atomically set Department.managerId when role is DEPT_MANAGER.
      if (role === "DEPT_MANAGER" && deptId) {
        await tx.department.update({
          where: { id: deptId },
          data: { managerId: employee.id },
        });

        // Auto-assign the department's manager-type position to this employee.
        const managerPosition = await tx.position.findFirst({
          where: {
            departmentId: deptId,
            isActive: true,
            name: { contains: 'Manager', mode: 'insensitive' },
          },
        });
        if (managerPosition) {
          await tx.employee.update({
            where: { id: employee.id },
            data:  { positionId: managerPosition.id },
          });
        } else {
          console.warn(
            `[createManagerAccount] No manager-type position found for department ${deptId}; positionId left as-is.`
          );
        }
      }
    }, { isolationLevel: "Serializable", timeout: 15000 });

    await logAudit(
      "CREATE",
      "User",
      user.id,
      { username, role, linkedEmployeeId: employee.employeeId },
      session?.user.id
    );

    revalidatePath(`/employees/${employee.id}`);
    revalidatePath("/users");

    // Return the temporary password ONCE — it is never stored in plaintext
    return { userId: user.id, username, password: tempPassword };
  });
}

export async function generateUserCredentials(
  fullName: string
): Promise<ActionResult<{ username: string; password: string }>> {
  const session = await getServerSession();
  return withPermission(session, "MANAGE_USERS", async () => {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "user";
    const lastName = parts[parts.length - 1] ?? parts[0] ?? "user";
    const username = await generateUsernameFromName(firstName, lastName);
    const password = generateTempPassword();
    return { username, password };
  });
}

export async function createUserAccount(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const parsed = createUserSchema.safeParse({
      name: formData.get("name"),
      username: formData.get("username"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // Prevent creating a second General Manager
    if (parsed.data.role === "MANAGER") {
      await assertSingleGeneralManager();
    }

    // Check username uniqueness before attempting creation
    const existingByUsername = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (existingByUsername) {
      throw new Error("A user with this username already exists.");
    }

    // better-auth's createUser API requires an email field.
    // We use a deterministic internal address that is never shown in the UI
    // and never used for login — username is the only login credential.
    const internalEmail = `${parsed.data.username}@internal.sikomendo.local`;

    const existing = await prisma.user.findUnique({ where: { email: internalEmail } });
    if (existing) {
      throw new Error("A user with this username already exists.");
    }

    const { user } = await auth.api.createUser({
      headers: await headers(),
      body: {
        name: parsed.data.name,
        email: internalEmail,
        password: parsed.data.password,
      },
    });

    // Optional photo, set by the admin creating this account on the
    // person's behalf (they may not have logged in themselves yet).
    const photo = getPhotoFile(formData);
    if (photo) {
      const asset = await uploadToCloudinary(photo, "siko-mendo/profile", { resourceType: "image" });
      await auth.api.adminUpdateUser({
        headers: await headers(),
        body: { userId: user.id, data: { image: asset.url } },
      });
    }

    // Set the username and role via Prisma (better-auth createUser doesn't
    // expose username or our custom role enum through its typed API).
    // mustChangePassword: true forces this brand-new temp password to be
    // replaced on first sign-in (enforced in app/(dashboard)/layout.tsx).
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: parsed.data.username,
        displayUsername: parsed.data.username,
        role: parsed.data.role,
        mustChangePassword: true,
      },
    });

    await logAudit(
      "CREATE",
      "User",
      user.id,
      { name: user.name, username: parsed.data.username, role: parsed.data.role },
      session?.user.id
    );
    revalidatePath("/users");
    return { id: user.id };
  });
}

export async function updateUserAccount(
  userId: string,
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    // Only name and role are editable — username is permanent.
    const parsed = updateUserSchema.safeParse({
      name:     formData.get("name"),
      username: formData.get("username"), // read but value will be ignored below
      role:     formData.get("role"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("User not found.");

    // Prevent assigning a second General Manager.
    // If the role is changing TO MANAGER and this user is not already the MANAGER,
    // ensure no other active MANAGER exists.
    if (parsed.data.role === "MANAGER" && target.role !== "MANAGER") {
      await assertSingleGeneralManager(userId);
    }

    // Username is immutable — always use the stored value regardless of
    // what was submitted. The internal email is also kept as-is.
    const photo = getPhotoFile(formData);
    const asset = photo
      ? await uploadToCloudinary(photo, "siko-mendo/profile", { resourceType: "image" })
      : null;

    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: {
        userId,
        data: asset
          ? { name: parsed.data.name, image: asset.url }
          : { name: parsed.data.name },
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { role: parsed.data.role },
    });

    await logAudit(
      "UPDATE",
      "User",
      userId,
      { name: parsed.data.name, role: parsed.data.role, photoChanged: Boolean(asset) },
      session?.user.id
    );
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    return { id: userId };
  });
}

/**
 * Suspends (bans) a user account, preventing them from signing in.
 * Audit-logged as SUSPEND. Does NOT affect Employee records.
 */
export async function suspendUserAccount(
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    if (session?.user.id === userId) {
      throw new Error("You can't suspend your own account.");
    }

    // Fix B: guard against suspending an archived account
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!target) throw new Error('User not found.');
    if (target.deletedAt) throw new Error('This account has been archived. Please restore it first before suspending.');

    await auth.api.banUser({ headers: await headers(), body: { userId } });

    await logAudit("SUSPEND", "User", userId, { suspended: true }, session?.user.id);
    // Fix A: revalidate both paths
    revalidatePath("/users");
    revalidatePath("/users/suspended");
    return { id: userId };
  });
}

/**
 * Reactivates a previously suspended user account.
 * Audit-logged as REACTIVATE.
 */
export async function reactivateUserAccount(
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    if (session?.user.id === userId) {
      throw new Error("You can't modify your own account status here.");
    }

    // Fix C: if the user is archived, clear deletedAt before unbanning
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!target) throw new Error('User not found.');
    if (target.deletedAt) {
      await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
    }

    await auth.api.unbanUser({ headers: await headers(), body: { userId } });

    await logAudit("REACTIVATE", "User", userId, { suspended: false }, session?.user.id);
    // Fix A: revalidate both paths
    revalidatePath("/users");
    revalidatePath("/users/suspended");
    return { id: userId };
  });
}

/**
 * Admin-initiated password reset: generates a brand-new temporary password and
 * forces the user to set their own on next sign-in. The password is returned
 * once in the action result and never persisted anywhere in plaintext.
 */
export async function resetUserPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    if (session?.user.id === userId) {
      throw new Error("Use Change Password on your own profile instead.");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new Error("User not found.");

    const newPassword = generateTempPassword();
    await auth.api.setUserPassword({ headers: await headers(), body: { userId, newPassword } });

    // Force this new temp password to be replaced on next sign-in, and kill
    // any sessions that were active under the old (now-reset) password —
    // otherwise a session started before the reset stays valid indefinitely.
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });
    await prisma.session.deleteMany({ where: { userId } });

    await logAudit("PASSWORD_RESET", "User", userId, {}, session?.user.id);
    await createNotification(
      userId,
      "PASSWORD_RESET",
      "Your password was reset",
      "An administrator reset your password. You'll be asked to set a new one the next time you sign in."
    );

    revalidatePath(`/users/${userId}`);
    return { password: newPassword };
  });
}

/**
 * Soft-archives a non-ADMIN user account (sets deletedAt = now).
 *
 * Archiving is preferred over hard-deletion because it:
 *   - preserves the User row so AuditLog, Report, and other FK back-refs
 *     remain intact (consistent with the cooperative archive pattern)
 *   - keeps all linked Employee HR data, attendance, leave, and documents
 *     fully intact — nothing is touched on the Employee side
 *   - is reversible if an account was archived by mistake
 *
 * Safety guarantees (all enforced server-side, independent of UI state):
 *   - ADMIN accounts can never be archived.
 *   - The currently authenticated user cannot archive their own account.
 *   - All active sessions for the target user are terminated immediately.
 *   - Manager references are cleaned up: employees who reported to this
 *     user's linked employee have their managerId nullified, and any
 *     Department whose managerId points to this employee is cleared.
 *   - An AuditLog entry is written before the archive so the acting user's
 *     context is captured.
 */
export async function deleteUserAccount(
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    // ── Load the target user with its linked employee ──────────────────────
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:        true,
        role:      true,
        name:      true,
        username:  true,
        deletedAt: true,
        employee: {
          select: {
            id:         true,
            employeeId: true,
          },
        },
      },
    });

    if (!target) throw new Error("User not found.");

    // ── SERVER-SIDE ADMIN BLOCK — never bypass this check ─────────────────
    if (target.role === "ADMIN") {
      throw new Error("Administrator accounts cannot be archived.");
    }

    // ── Self-archive block ─────────────────────────────────────────────────
    if (session?.user.id === userId) {
      throw new Error("You cannot archive your own account.");
    }

    // Already archived — idempotent no-op
    if (target.deletedAt) {
      return { id: userId };
    }

    // ── Clean up manager references tied to this user's employee ──────────
    if (target.employee) {
      const empId = target.employee.id;

      // FEAT-002 Step 3: Wrap both manager-reference cleanup writes in a single
      // Serializable transaction so they are atomic — no partial state possible.
      await prisma.$transaction(async (tx) => {
        // Nullify managerId for all direct reports
        await tx.employee.updateMany({
          where: { managerId: empId },
          data:  { managerId: null },
        });

        // Clear Department.managerId if this employee was a dept manager
        await tx.department.updateMany({
          where: { managerId: empId },
          data:  { managerId: null },
        });
      }, { isolationLevel: "Serializable" });
    }

    // ── Audit log BEFORE the archive ──────────────────────────────────────
    await logAudit(
      "ARCHIVE",
      "User",
      userId,
      {
        name:             target.name,
        username:         target.username,
        role:             target.role,
        linkedEmployeeId: target.employee?.employeeId ?? null,
      },
      session?.user.id
    );

    // ── Soft-archive: set deletedAt, ban the account (blocks sign-in),
    //    and kill all active sessions atomically ───────────────────────────
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data:  { deletedAt: new Date(), banned: true },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    revalidatePath("/users");
    revalidatePath("/users/archive");
    return { id: userId };
  });
}

/**
 * Restores a previously archived (soft-deleted) user account.
 * Audit-logged as RESTORE_ACCOUNT.
 */
export async function restoreUserAccount(
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, username: true, deletedAt: true },
    });

    if (!target) throw new Error("User not found.");
    if (!target.deletedAt) throw new Error("This account is not archived.");

    await prisma.user.update({
      where: { id: userId },
      data:  { deletedAt: null, banned: false },
    });

    await logAudit(
      "RESTORE_ACCOUNT",
      "User",
      userId,
      { name: target.name, username: target.username, role: target.role },
      session?.user.id
    );

    revalidatePath("/users");
    revalidatePath("/users/archive");
    return { id: userId };
  });
}

/** Forces a user to set a new password on their next sign-in, without changing their current one. */
export async function forcePasswordChangeForUser(userId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("User not found.");

    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });

    await logAudit("FORCE_PASSWORD_CHANGE", "User", userId, {}, session?.user.id);
    revalidatePath(`/users/${userId}`);
    return { id: userId };
  });
}

/**
 * Creates a login account for an employee and assigns them the MANAGER or
 * DEPT_MANAGER role.
 *
 * - MANAGER: enforces the single-general-manager rule.
 * - DEPT_MANAGER: requires a departmentId; enforces the single-dept-manager
 *   rule, then writes Department.managerId = employee.id after account creation.
 *
 * Username is derived server-side from the employee's Employee ID (e.g.
 * "EMP-0001" → "emp-0001") — the client never supplies the username, preventing
 * spoofing.
 *
 * Returns credentials (userId, username, temporary password) once on success;
 * the temp password is never persisted in plaintext.
 */
export async function createManagerAccount(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ userId: string; username: string; password: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    const parsed = createManagerAccountSchema.safeParse({
      employeeId:   formData.get("employeeId"),
      role:         formData.get("role"),
      departmentId: formData.get("departmentId") || undefined,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    const { employeeId, role, departmentId } = parsed.data;

    // ── Role-specific uniqueness guards ─────────────────────────────────────
    if (role === "MANAGER") {
      await assertSingleGeneralManager();
    }

    if (role === "DEPT_MANAGER") {
      if (!departmentId) {
        throw new Error("A department must be selected when creating a Department Manager account.");
      }
      await assertSingleManagerPerDepartment(departmentId);
    }

    // ── Load employee ────────────────────────────────────────────────────────
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id:         true,
        employeeId: true,
        firstName:  true,
        middleName: true,
        lastName:   true,
        userId:     true,
      },
    });
    if (!employee) throw new Error("Employee not found.");
    if (employee.userId) throw new Error("This employee already has a login account.");

    // ── Derive username from Employee ID ─────────────────────────────────────
    // Better Auth's username plugin normalises to lowercase on sign-in lookup,
    // so the stored value must already be lowercase.
    const username = employee.employeeId.toLowerCase();

    // Guard against the (unlikely) case where a username derived from an
    // Employee ID is already taken by a different account.
    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    if (existingByUsername) {
      throw new Error(`Username "${username}" is already in use.`);
    }

    // Deterministic internal email — never shown in UI, never used for login.
    const internalEmail = `${username}@internal.sikomendo.local`;
    const existingByEmail = await prisma.user.findUnique({ where: { email: internalEmail } });
    if (existingByEmail) {
      throw new Error("An account with this Employee ID already exists.");
    }

    const fullName = [employee.firstName, employee.middleName, employee.lastName]
      .filter(Boolean)
      .join(" ");

    const tempPassword = generateTempPassword();

    // ── Create the auth record ────────────────────────────────────────────────
    const { user } = await auth.api.createUser({
      headers: await headers(),
      body: { name: fullName, email: internalEmail, password: tempPassword },
    });

    // ── Set username, role, and force-change on first sign-in ─────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        displayUsername: username,
        role:            role as import("@prisma/client").Role,
        mustChangePassword: true,
      },
    });

    // ── Link employee ─────────────────────────────────────────────────────────
    await prisma.employee.update({
      where: { id: employee.id },
      data:  { userId: user.id },
    });

    // ── Assign department manager role (DEPT_MANAGER only) ────────────────────
    if (role === "DEPT_MANAGER" && departmentId) {
      await prisma.$transaction(async (tx) => {
        await tx.department.update({
          where: { id: departmentId },
          data:  { managerId: employee.id },
        });

        // Auto-assign the department's manager-type position to this employee.
        const managerPosition = await tx.position.findFirst({
          where: {
            departmentId,
            isActive: true,
            name: { contains: 'Manager', mode: 'insensitive' },
          },
        });
        if (managerPosition) {
          await tx.employee.update({
            where: { id: employee.id },
            data:  { positionId: managerPosition.id },
          });
        } else {
          console.warn(
            `[createManagerAccount] No manager-type position found for department ${departmentId}; positionId left as-is.`
          );
        }
      });
    }

    // ── Audit log ─────────────────────────────────────────────────────────────
    await logAudit(
      "CREATE",
      "User",
      user.id,
      { username, role, linkedEmployeeId: employee.employeeId, departmentId: departmentId ?? null },
      session?.user.id
    );

    // ── Revalidate affected pages ─────────────────────────────────────────────
    revalidatePath("/users");
    revalidatePath(`/employees/${employee.id}`);

    return { userId: user.id, username, password: tempPassword };
  });
}

/**
 * Creates a manager's Employee record AND their login account together in a
 * single atomic flow.
 *
 * Used by the /users/new page when no eligible employees exist yet — this
 * unblocks the chicken-and-egg scenario where the first General Manager or
 * Department Manager cannot be created because neither an employee record nor
 * a manager account exists yet.
 *
 * Transaction design:
 *   1. Employee + EmploymentHistory + OnboardingRecord are created inside a
 *      Prisma $transaction so they are all-or-nothing.
 *   2. auth.api.createUser() is called OUTSIDE the transaction (it uses its own
 *      DB connection). If it throws, the already-committed Employee row is
 *      compensated with a prisma.employee.delete() (compensating rollback).
 *   3. Post-auth Prisma writes (user.update, employee.update, department.update)
 *      are also outside the transaction; any failure triggers the same
 *      compensating delete of both the Employee and the partially-created User.
 *
 * Returns { userId, username, password } on success. The temporary password is
 * never persisted in plaintext.
 */
export async function createManagerWithEmployee(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ userId: string; username: string; password: string }>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_USERS", async () => {
    // ── 1. Parse & validate ──────────────────────────────────────────────────
    const parsed = createManagerWithEmployeeSchema.safeParse({
      managerType:    formData.get("managerType"),
      firstName:      formData.get("firstName"),
      middleName:     formData.get("middleName"),
      lastName:       formData.get("lastName"),
      phone:          formData.get("phone"),
      email:          formData.get("email") || undefined,
      gender:         formData.get("gender"),
      dateOfBirth:    formData.get("dateOfBirth"),
      maritalStatus:  formData.get("maritalStatus"),
      hireDate:       formData.get("hireDate"),
      employmentType: formData.get("employmentType"),
      departmentId:   formData.get("departmentId") || undefined,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const data = parsed.data;
    const { managerType } = data;
    const departmentId = managerType === "DEPT_MANAGER" ? data.departmentId : undefined;

    // ── 2. Role-specific uniqueness guards ───────────────────────────────────
    if (managerType === "MANAGER") {
      await assertSingleGeneralManager();
    }
    if (managerType === "DEPT_MANAGER") {
      if (!departmentId) {
        throw new Error("A department must be selected when creating a Department Manager.");
      }
      await assertSingleManagerPerDepartment(departmentId);
    }

    // ── 3. For DEPT_MANAGER: resolve General Manager's employee ID ────────────
    let generalManagerEmployeeId: string | null = null;
    if (managerType === "DEPT_MANAGER") {
      const gm = await getActiveGeneralManager();
      if (!gm?.employee) {
        throw new Error(
          "A General Manager must be created before a Department Manager can be assigned."
        );
      }
      generalManagerEmployeeId = gm.employee.id;
    }

    // ── 4. Generate the next Employee ID (outside transaction — uses a sequence)
    const employeeId = await generateNextEmployeeId();
    const username = employeeId.toLowerCase();
    const internalEmail = `${username}@internal.sikomendo.local`;

    // ── 5. Username / email collision guard (pre-transaction) ────────────────
    const [existingUsername, existingEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { email: internalEmail } }),
    ]);
    if (existingUsername) throw new Error(`Username "${username}" is already in use.`);
    if (existingEmail) throw new Error("An account with this Employee ID already exists.");

    const tempPassword = generateTempPassword();
    const fullName = [data.firstName, data.middleName, data.lastName]
      .filter(Boolean)
      .join(" ");

    // ── 6. Prisma transaction: Employee + OnboardingRecord ─────────────────────
    //
    // positionId is not collected for managers — they bypass the normal
    // onboarding workflow.  EmploymentHistory requires a non-null positionId so
    // that row is intentionally skipped here.
    const employee = await prisma.$transaction(async (tx) => {
      // The effective department for the Employee row
      const empDepartmentId = managerType === "DEPT_MANAGER" ? (departmentId ?? null) : null;

      const created = await tx.employee.create({
        data: {
          employeeId,
          firstName:      data.firstName,
          middleName:     data.middleName ?? null,
          lastName:       data.lastName,
          email:          data.email ?? null,
          phone:          data.phone ?? null,
          gender:         data.gender as Gender,
          dateOfBirth:    data.dateOfBirth ?? null,
          maritalStatus:  data.maritalStatus as MaritalStatus,
          hireDate:       data.hireDate ?? null,
          employmentType: data.employmentType as EmploymentType,
          // Managers start ACTIVE — they are not going through a normal onboarding checklist
          employmentStatus: "ACTIVE",
          departmentId:   empDepartmentId,
          // GM has no reporting manager; DM reports to the GM
          managerId:      generalManagerEmployeeId,
        },
      });

      await tx.onboardingRecord.create({
        data: {
          employeeId:      created.id,
          responsibleHrId: session?.user.id ?? null,
        },
      });

      return created;
    });

    // ── 7. Create auth account (outside transaction — compensate on failure) ──
    //
    // auth.api.createUser() uses its own DB connection and cannot participate
    // in a Prisma $transaction. The post-auth Prisma writes ARE wrapped in a
    // $transaction so that a partial failure (e.g. user.update succeeds but
    // employee.update fails) still leaves the DB consistent. If ANY post-auth
    // write fails the transaction is automatically rolled back and the catch
    // block then compensates by deleting both the employee row and the
    // partially-created User row (logging a warning if either deletion fails).
    let createdUser: { id: string } | null = null;
    try {
      const { user } = await auth.api.createUser({
        headers: await headers(),
        body: { name: fullName, email: internalEmail, password: tempPassword },
      });
      createdUser = user;

      // All post-auth Prisma writes run inside a single transaction so that
      // a failure in any one of them rolls back the others atomically.
      await prisma.$transaction(async (tx) => {
        // Set username, role, and force a password change on first sign-in
        await tx.user.update({
          where: { id: user.id },
          data: {
            username,
            displayUsername:    username,
            role:               managerType as import("@prisma/client").Role,
            mustChangePassword: true,
          },
        });

        // Link the user to the employee record
        await tx.employee.update({
          where: { id: employee.id },
          data:  { userId: user.id },
        });

        // For DEPT_MANAGER: set the department's manager pointer
        // Placed inside the same transaction so a failure here never leaves
        // the DEPT_MANAGER user/employee rows without the Department.managerId
        // pointer set — the two sources of truth stay in sync or both fail.
        if (managerType === "DEPT_MANAGER" && departmentId) {
          await tx.department.update({
            where: { id: departmentId },
            data:  { managerId: employee.id },
          });

          // Auto-assign the department's manager-type position to this employee.
          // Each department has its own named manager position (e.g. "Finance Manager").
          // If none is found, leave positionId as-is — do not throw.
          const managerPosition = await tx.position.findFirst({
            where: {
              departmentId,
              isActive: true,
              name: { contains: 'Manager', mode: 'insensitive' },
            },
          });
          if (managerPosition) {
            await tx.employee.update({
              where: { id: employee.id },
              data:  { positionId: managerPosition.id },
            });
          } else {
            console.warn(
              `[createManagerWithEmployee] No manager-type position found for department ${departmentId}; positionId left as-is.`
            );
          }
        }
      });
    } catch (err) {
      // Compensating rollback: remove the employee row to avoid orphaned records.
      // The $transaction above means that if the post-auth writes failed, the
      // Prisma state is already clean — we only need to remove the employee row
      // that was committed before auth.api.createUser was called.
      const empDeleteError = await prisma.employee
        .delete({ where: { id: employee.id } })
        .catch((e: unknown) => e);
      if (empDeleteError instanceof Error) {
        console.error(
          `[createManagerWithEmployee] Compensating employee delete failed for ${employee.id}:`,
          empDeleteError.message
        );
      }

      // Remove the User row if better-auth already created it.
      // Log a warning if the deletion fails so the partial row is visible
      // in server logs rather than silently surviving.
      if (createdUser) {
        const userDeleteError = await prisma.user
          .delete({ where: { id: createdUser.id } })
          .catch((e: unknown) => e);
        if (userDeleteError instanceof Error) {
          console.error(
            `[createManagerWithEmployee] Compensating user delete failed for ${createdUser.id}:`,
            userDeleteError.message
          );
        }
      }
      throw err;
    }

    // ── 8. Audit log + cache invalidation ────────────────────────────────────
    await logAudit(
      "CREATE",
      "User",
      createdUser.id,
      {
        username,
        role: managerType,
        linkedEmployeeId: employeeId,
        departmentId: departmentId ?? null,
      },
      session?.user.id
    );
    revalidatePath("/users");
    revalidatePath("/employees");

    return { userId: createdUser.id, username, password: tempPassword };
  });
}
