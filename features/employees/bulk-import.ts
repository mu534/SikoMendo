import "server-only";
import Papa from "papaparse";
import { z } from "zod";
import { type EmploymentType, type MaritalStatus, type Gender, type InstitutionType, type QualificationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { employeeSchemaObject, validateEmployeeConsent, EDUCATION_LEVELS } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { assertPositionInDepartment } from "@/lib/employee-access";
import type { EducationLevel } from "@prisma/client";

// ── DM presence check (inline — does not require a tx client) ─────────────────
/**
 * Checks that a department has an active Department Manager.
 * Returns { ok: true, managerId } or { ok: false, errorMsg }.
 * Used in resolveRowReferences (outside a transaction — the final import write
 * runs its own Serializable tx that re-validates via managerId fetch).
 */
async function checkDeptHasActiveDM(
  departmentId: string,
  departmentName: string
): Promise<{ ok: true; managerId: string } | { ok: false; errorMsg: string }> {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      managerId: true,
      manager: { select: { deletedAt: true, employmentStatus: true } },
    },
  });

  const isActive =
    dept?.managerId !== null &&
    dept?.manager?.deletedAt === null &&
    dept?.manager?.employmentStatus === "ACTIVE";

  if (!isActive || !dept?.managerId) {
    return {
      ok: false,
      errorMsg: `department: The department "${departmentName}" has no active Department Manager. Employees cannot be registered into a department without one.`,
    };
  }

  return { ok: true, managerId: dept.managerId };
}

// ── Local schema for CSV import ────────────────────────────────────────────
// Same as employeeSchema but managerId is optional — CSV rows may omit it.
// Empty value → null (DB allows null for managerId; onDelete: SetNull).
const importEmployeeSchema = employeeSchemaObject.extend({
  managerId: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().optional().transform((v) => (v && v.length > 0 ? v : null))
  ),
}).superRefine(validateEmployeeConsent);

type ImportEmployeeInput = z.infer<typeof importEmployeeSchema>;

/** Column headers the import template/CSV must use (24 columns in this order). */
export const IMPORT_COLUMNS = [
  "firstName",
  "middleName",
  "lastName",
  "email",
  "phone",
  "gender",
  "dateOfBirth",
  "maritalStatus",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
  "emergencyContactAddress",
  "department",
  "position",
  "manager",
  "hireDate",
  "employmentType",
  // Single education record for CSV import (the inline columns map to one Education row)
  "educationLevel",
  "fieldOfStudy",
  "institutionType",
  "institutionName",
  "graduationYear",
  "qualificationStatus",
] as const;

// P2-12: employmentStatus is intentionally NOT in the import columns.
// All imported employees start in ONBOARDING state.

// P2-12: employmentStatus is intentionally NOT in the import columns.
// All imported employees start in ONBOARDING state.

export type ImportRowResult =
  | { row: number; status: "created"; employeeId: string; name: string }
  | { row: number; status: "error"; name: string; errors: string[] };

/** A validated row ready for preview — carries resolved names plus original data. */
export type ValidatedRow = {
  rowNumber: number;
  name: string;
  data: ImportEmployeeInput;
  /** Resolved department name (for display) */
  departmentName: string;
  /** Resolved position name (for display) */
  positionName: string;
  /** Resolved manager name (for display), or null */
  managerName: string | null;
  /** Original CSV row */
  original: Record<string, string>;
};

/**
 * ParsedEmployeeRow: the shape returned by validateEmployeeCsvRows for each
 * valid row. Carries the minimal fields needed for the preview table, plus the
 * internally-resolved IDs used when the user confirms the import.
 */
export type ParsedEmployeeRow = {
  rowIndex: number;
  firstName: string;
  /** Father's name (Ethiopian convention) */
  middleName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  hireDate: string;
  employmentType: string;
  educationLevel: string;
  /** The full validated data — used by bulkImportEmployees to re-use validation */
  _data: ImportEmployeeInput;
  /** Resolved department ID */
  _departmentId: string;
  /** Resolved position ID */
  _positionId: string;
  /** Resolved manager ID, or null */
  _managerId: string | null;
};

export type ValidationResult = {
  validRows: ValidatedRow[];
  invalidRows: { rowNumber: number; name: string; errors: string[] }[];
};

export function parseEmployeeCsv(text: string): {
  rows: Record<string, string>[];
  parseErrors: string[];
} {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return {
    rows: result.data,
    parseErrors: result.errors.map((e) => `Row ${e.row != null ? e.row + 2 : "?"}: ${e.message}`),
  };
}

/**
 * Builds the educations JSON string from flat CSV columns, or returns an error
 * list when required education fields are missing or invalid.
 *
 * Education is always required — every imported employee must have at least one
 * record, matching the same rule enforced by the registration form.
 *
 * Accepted educationLevel values are the same as the registration form offers:
 * HIGH_SCHOOL | CERTIFICATE | DIPLOMA | BACHELOR | MASTER | PHD | OTHER.
 * (PRIMARY and SECONDARY are legacy DB values, not accepted in new registrations.)
 *
 * For HIGH_SCHOOL, fieldOfStudy must be exactly "Natural Science" or "Social Science".
 */
function buildEducationsJson(row: Record<string, string>): { json: string } | { errors: string[] } {
  const errors: string[] = [];

  const rawLevel = row.educationLevel?.trim() ?? "";

  if (!rawLevel) {
    errors.push("educationLevel: Education level is required.");
  } else if (!EDUCATION_LEVELS.includes(rawLevel as (typeof EDUCATION_LEVELS)[number])) {
    errors.push(
      `educationLevel: "${rawLevel}" is not a valid education level. ` +
      `Accepted values: ${EDUCATION_LEVELS.join(", ")}.`
    );
  }

  if (errors.length > 0) return { errors };

  // educationLevel is valid — build the record and let educationRecordSchema
  // run its full superRefine checks (fieldOfStudy streams, institutionType
  // compatibility, required fields, graduation year range, etc.)
  const educationRecord = {
    educationLevel: rawLevel,
    fieldOfStudy:        row.fieldOfStudy?.trim()        || null,
    institutionType:     row.institutionType?.trim()     || null,
    institutionName:     row.institutionName?.trim()     || null,
    graduationYear:      row.graduationYear?.trim()      || null,
    qualificationStatus: row.qualificationStatus?.trim() || null,
  };

  return { json: JSON.stringify([educationRecord]) };
}

/**
 * Resolves department, position, and manager for a single CSV row.
 * Returns the resolved IDs and display names, or collects errors.
 *
 * Exported for unit-testing in bulk-import-hierarchy.test.ts.
 *
 * Hierarchy rules (FEAT-002):
 *   - The department must have an active Department Manager. If not, the row
 *     is rejected with a clear error.
 *   - The canonical managerId for the DB write is always the dept's active DM.
 *   - The CSV 'manager' column is still resolved for display in the preview
 *     table but is NOT used for the actual DB write.
 */
export async function resolveRowReferences(
  row: Record<string, string>,
  rowNumber: number,
  displayName: string
): Promise<
  | {
      ok: true;
      departmentId: string;
      departmentName: string;
      positionId: string;
      positionName: string;
      /** Canonical manager ID derived from the dept's active DM — always used for DB write. */
      managerId: string;
      /** Display-only manager name resolved from the CSV 'manager' column (may be null). */
      managerName: string | null;
    }
  | { ok: false; errors: string[] }
> {
  const errors: string[] = [];

  // ── Resolve department ───────────────────────────────────────────────────
  const departmentName = row.department?.trim();
  if (!departmentName) {
    errors.push("department: Department is required");
  }

  const department = departmentName
    ? await prisma.department.findFirst({
        where: { name: { equals: departmentName, mode: "insensitive" }, isActive: true },
      })
    : null;

  if (departmentName && !department) {
    errors.push(`department: "${departmentName}" doesn't match any active department.`);
  }

  // ── Resolve position ─────────────────────────────────────────────────────
  const positionName = row.position?.trim();
  if (!positionName) {
    errors.push("position: Position is required");
  }

  const position =
    positionName && department
      ? await prisma.position.findFirst({
          where: {
            name: { equals: positionName, mode: "insensitive" },
            departmentId: department.id,
            isActive: true,
          },
        })
      : null;

  if (positionName && department && !position) {
    errors.push(
      `position: "${positionName}" doesn't match any active position in ${department?.name}.`
    );
  }

  // ── FEAT-002 Step 1: Enforce active DM in the department ─────────────────
  // After resolving the department, check that it has an active DM. Reject
  // the row immediately — employees cannot be imported into a dept with no DM.
  let canonicalManagerId: string | null = null;
  if (department) {
    const dmCheck = await checkDeptHasActiveDM(department.id, department.name);
    if (!dmCheck.ok) {
      errors.push(dmCheck.errorMsg);
    } else {
      // Use the dept's active DM as the canonical managerId for this row.
      canonicalManagerId = dmCheck.managerId;
    }
  }

  // ── Resolve manager column for display only ───────────────────────────────
  // The CSV 'manager' column value is resolved purely for backwards-compat
  // display in the preview table. It is NOT used for the DB write — the dept
  // DM (canonicalManagerId) is the source of truth.
  const managerRaw = row.manager?.trim() ?? "";
  let resolvedManagerName: string | null = null;

  if (managerRaw !== "") {
    // Try by employeeId first (e.g. "EMP-0001")
    const byEmpId = await prisma.employee.findFirst({
      where: { employeeId: { equals: managerRaw, mode: "insensitive" }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    if (byEmpId) {
      resolvedManagerName = `${byEmpId.firstName} ${byEmpId.lastName}`;
    } else {
      // Try first+last name match (case-insensitive)
      const nameParts = managerRaw.split(/\s+/);
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ");

      const byName =
        firstName && lastName
          ? await prisma.employee.findFirst({
              where: {
                firstName: { equals: firstName, mode: "insensitive" },
                lastName: { equals: lastName, mode: "insensitive" },
                deletedAt: null,
              },
              select: { id: true, firstName: true, lastName: true },
            })
          : null;

      if (byName) {
        resolvedManagerName = `${byName.firstName} ${byName.lastName}`;
      }
      // Display-only lookup failure is silently ignored — the dept DM is authoritative.
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    departmentId: department!.id,
    departmentName: department!.name,
    positionId: position!.id,
    positionName: position!.name,
    // FEAT-002: always use the dept's canonical DM id, never the CSV 'manager' column value
    managerId: canonicalManagerId!,
    managerName: resolvedManagerName,
  };
}

/**
 * Validates CSV rows (department/position/manager resolution + Zod) without
 * writing to the database or calling generateNextEmployeeId.
 *
 * Used by the preview step before the user confirms the actual import.
 *
 * @param rows     Parsed CSV data rows (from PapaParse header mode).
 * @param _headers Column header names (unused — PapaParse encodes them as keys
 *                 in each row object; kept in signature for API consistency).
 */
export async function validateEmployeeCsvRows(
  rows: Record<string, string>[],
  _headers: string[]
): Promise<{
  validRows: ParsedEmployeeRow[];
  invalidRows: { rowIndex: number; name: string; errors: string[] }[];
}> {
  const validRows: ParsedEmployeeRow[] = [];
  const invalidRows: { rowIndex: number; name: string; errors: string[] }[] = [];

  // Track emails seen within this CSV batch to catch intra-batch duplicates.
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2; // +1 for 0-index, +1 for header row
    const displayName =
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || `Row ${rowIndex}`;

    const rowErrors: string[] = [];

    // ── Resolve department / position / manager ─────────────────────────
    const resolved = await resolveRowReferences(row, rowIndex, displayName);
    if (!resolved.ok) {
      invalidRows.push({ rowIndex, name: displayName, errors: resolved.errors });
      continue;
    }

    // ── Build and pre-validate education columns ────────────────────────
    const eduResult = buildEducationsJson(row);
    if ("errors" in eduResult) {
      rowErrors.push(...eduResult.errors);
    }

    if (rowErrors.length > 0) {
      invalidRows.push({ rowIndex, name: displayName, errors: rowErrors });
      continue;
    }

    // ── Duplicate email check (DB + intra-batch) ────────────────────────
    const rawEmail = row.email?.trim() ?? "";
    if (rawEmail) {
      const normalizedEmail = rawEmail.toLowerCase();
      if (seenEmails.has(normalizedEmail)) {
        invalidRows.push({
          rowIndex,
          name: displayName,
          errors: [`email: Duplicate email "${rawEmail}" — appears more than once in this CSV.`],
        });
        continue;
      }
      const existingEmployee = await prisma.employee.findFirst({
        where: { email: { equals: rawEmail, mode: "insensitive" }, deletedAt: null },
        select: { firstName: true, lastName: true, employeeId: true },
      });
      if (existingEmployee) {
        invalidRows.push({
          rowIndex,
          name: displayName,
          errors: [
            `email: "${rawEmail}" is already used by ${existingEmployee.firstName} ${existingEmployee.lastName} (${existingEmployee.employeeId}).`,
          ],
        });
        continue;
      }
      seenEmails.add(normalizedEmail);
    }

    // ── Zod parse ───────────────────────────────────────────────────────
    const parsed = importEmployeeSchema.safeParse({
      ...row,
      departmentId: resolved.departmentId,
      positionId: resolved.positionId,
      userId: "",
      educations: ("json" in eduResult) ? eduResult.json : "[]",
      employmentStatus: "ONBOARDING",
      managerId: resolved.managerId ?? "",
    });

    if (!parsed.success) {
      invalidRows.push({
        rowIndex,
        name: displayName,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
      continue;
    }

    const eduLevel = parsed.data.educations[0]?.educationLevel ?? "";
    const hireDateStr =
      parsed.data.hireDate instanceof Date
        ? parsed.data.hireDate.toISOString().slice(0, 10)
        : parsed.data.hireDate != null
          ? String(parsed.data.hireDate)
          : "";

    validRows.push({
      rowIndex,
      firstName: parsed.data.firstName,
      middleName: parsed.data.middleName ?? "",
      lastName: parsed.data.lastName,
      email: parsed.data.email ?? "",
      department: resolved.departmentName,
      position: resolved.positionName,
      hireDate: hireDateStr,
      employmentType: parsed.data.employmentType ?? "",
      educationLevel: eduLevel,
      _data: parsed.data,
      _departmentId: resolved.departmentId,
      _positionId: resolved.positionId,
      // FEAT-002: managerId is always the dept's canonical DM, never null at this point
      _managerId: resolved.managerId,
    });
  }

  return { validRows, invalidRows };
}

/**
 * Creates one employee per valid row.
 *
 * P2-12: Each successful row creates Employee + Education (if provided) +
 * EmploymentHistory + OnboardingRecord in a single Prisma transaction.
 * All imported employees start in ONBOARDING — the CSV cannot override this.
 *
 * P2-11: Position must belong to the selected department (verified server-side).
 *
 * CSV education columns map to a single Education row per import row.
 * Rows are processed sequentially because generateNextEmployeeId uses
 * a sequence that must advance one step at a time.
 */
export async function importEmployeeRows(
  rows: Record<string, string>[],
  actorUserId: string
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    const displayName =
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || `Row ${rowNumber}`;

    try {
      // ── 1-3. Resolve department, position, manager ──────────────────────
      const resolved = await resolveRowReferences(row, rowNumber, displayName);
      if (!resolved.ok) {
        results.push({ row: rowNumber, status: "error", name: displayName, errors: resolved.errors });
        continue;
      }

      // ── 4. Build educations array from flat CSV columns ─────────────────
      const eduResult = buildEducationsJson(row);
      if ("errors" in eduResult) {
        results.push({ row: rowNumber, status: "error", name: displayName, errors: eduResult.errors });
        continue;
      }

      // ── 5. Parse and validate with Zod schema ───────────────────────────
      const parsed = importEmployeeSchema.safeParse({
        ...row,
        departmentId: resolved.departmentId,
        positionId: resolved.positionId,
        userId: "",
        educations: eduResult.json,
        // P2-12: Force ONBOARDING
        employmentStatus: "ONBOARDING",
        managerId: resolved.managerId ?? "",
      });
      if (!parsed.success) {
        results.push({
          row: rowNumber,
          status: "error",
          name: displayName,
          errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        });
        continue;
      }

      // P2-11: Belt-and-suspenders position/department check
      await assertPositionInDepartment(resolved.positionId, resolved.departmentId);

      // ── 6. Duplicate email check ────────────────────────────────────────
      if (parsed.data.email) {
        const duplicate = await prisma.employee.findFirst({
          where: { email: parsed.data.email, deletedAt: null },
        });
        if (duplicate) {
          results.push({
            row: rowNumber,
            status: "error",
            name: displayName,
            errors: [
              `Duplicate email — already exists for ${duplicate.firstName} ${duplicate.lastName} (${duplicate.employeeId}).`,
            ],
          });
          continue;
        }
      }

      // ── 7. Create Employee + Education + EmploymentHistory + OnboardingRecord
      const employeeId = await generateNextEmployeeId();

      await prisma.$transaction(async (tx) => {
        // FEAT-002 Step 1b: Re-fetch the dept's canonical DM inside the transaction
        // (Serializable isolation ensures no race between validation and write).
        const deptInTx = await tx.department.findUnique({
          where: { id: resolved.departmentId },
          select: { managerId: true },
        });
        // deptInTx.managerId must be non-null — resolveRowReferences above already
        // rejected any row where the dept has no active DM. This is a final safety check.
        if (!deptInTx?.managerId) {
          throw new Error(
            `The department no longer has an active Department Manager. Please retry the import.`
          );
        }
        const canonicalManagerId = deptInTx.managerId;

        const created = await tx.employee.create({
          data: {
            employeeId,
            firstName: parsed.data.firstName,
            middleName: parsed.data.middleName ?? null,
            lastName: parsed.data.lastName,
            email: parsed.data.email ?? null,
            phone: parsed.data.phone ?? null,
            gender: parsed.data.gender as Gender | null ?? null,
            dateOfBirth: parsed.data.dateOfBirth ?? null,
            maritalStatus: parsed.data.maritalStatus as MaritalStatus | null ?? null,
            address: parsed.data.address ?? null,
            emergencyContactName: parsed.data.emergencyContactName ?? null,
            emergencyContactPhone: parsed.data.emergencyContactPhone ?? null,
            emergencyContactRelationship: parsed.data.emergencyContactRelationship ?? null,
            emergencyContactAddress: parsed.data.emergencyContactAddress ?? null,
            emergencyContactConsentRecorded: parsed.data.emergencyContactConsentRecorded ?? false,
            ...(parsed.data.emergencyContactConsentRecorded
              ? {
                  emergencyContactConsentAt:       new Date(),
                  emergencyContactConsentByUserId: actorUserId,
                }
              : {}),
            departmentId: resolved.departmentId,
            positionId: resolved.positionId,
            hireDate: parsed.data.hireDate ?? null,
            employmentStatus: "ONBOARDING",
            employmentType: parsed.data.employmentType as EmploymentType | null ?? null,
            // FEAT-002: always use the dept's canonical DM id, not the CSV 'manager' column
            managerId: canonicalManagerId,
          },
        });

        if (parsed.data.educations.length > 0) {
          await tx.education.createMany({
            data: parsed.data.educations.map((edu) => ({
              employeeId: created.id,
              educationLevel: edu.educationLevel as EducationLevel,
              fieldOfStudy: edu.fieldOfStudy ?? null,
              institutionType: (edu.institutionType as InstitutionType) ?? null,
              institutionName: edu.institutionName ?? null,
              graduationYear: edu.graduationYear ?? null,
              qualificationStatus: (edu.qualificationStatus as QualificationStatus) ?? null,
            })),
          });
        }

        await tx.employmentHistory.create({
          data: {
            employeeId: created.id,
            departmentId: resolved.departmentId,
            positionId: resolved.positionId,
            employmentType: parsed.data.employmentType as EmploymentType | null | undefined,
            effectiveDate: created.hireDate ?? new Date(),
            changeReason: "Initial hire (bulk import)",
          },
        });

        await tx.onboardingRecord.create({
          data: {
            employeeId: created.id,
            responsibleHrId: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            action: "CREATE",
            entity: "Employee",
            entityId: created.id,
            changes: { source: "bulk_import", employeeId, importedBy: actorUserId },
            userId: actorUserId,
          },
        });

        return created;
      }, { isolationLevel: "Serializable" });

      results.push({ row: rowNumber, status: "created", employeeId, name: displayName });
    } catch (err) {
      results.push({
        row: rowNumber,
        status: "error",
        name: displayName,
        errors: [err instanceof Error ? err.message : "Failed to create this record."],
      });
    }
  }

  return results;
}
