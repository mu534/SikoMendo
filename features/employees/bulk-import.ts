import "server-only";
import Papa from "papaparse";
import { z } from "zod";
import { type EmploymentType, type MaritalStatus, type Gender, type InstitutionType, type QualificationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { employeeSchema, EDUCATION_LEVELS } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { assertPositionInDepartment } from "@/lib/employee-access";
import type { EducationLevel } from "@prisma/client";

// ── Local schema for CSV import ────────────────────────────────────────────
// Extends employeeSchema with managerId as optional (CSV rows may omit it;
// empty value resolves to null which is valid in the DB).
const importEmployeeSchema = employeeSchema.extend({
  managerId: z.preprocess(
    (v) => (v ? String(v).trim() : ""),
    z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined))
  ),
});

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
 * Resolves department, position, and manager for a single CSV row.
 * Returns the resolved IDs and display names, or collects errors.
 */
async function resolveRowReferences(
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
      managerId: string | null;
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

  // ── Resolve manager ──────────────────────────────────────────────────────
  const managerRaw = row.manager?.trim() ?? "";
  let managerId: string | null = null;
  let resolvedManagerName: string | null = null;

  if (managerRaw !== "") {
    // Try by employeeId first (e.g. "EMP-0001")
    const byEmpId = await prisma.employee.findFirst({
      where: { employeeId: { equals: managerRaw, mode: "insensitive" }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    if (byEmpId) {
      managerId = byEmpId.id;
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
        managerId = byName.id;
        resolvedManagerName = `${byName.firstName} ${byName.lastName}`;
      } else {
        errors.push(
          `manager: "${managerRaw}" doesn't match any active employee (tried by employee ID and by first + last name).`
        );
      }
    }
  }
  // Empty managerRaw → managerId stays null (acceptable)

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    departmentId: department!.id,
    departmentName: department!.name,
    positionId: position!.id,
    positionName: position!.name,
    managerId,
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2; // +1 for 0-index, +1 for header row
    const displayName =
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || `Row ${rowIndex}`;

    // Resolve references
    const resolved = await resolveRowReferences(row, rowIndex, displayName);
    if (!resolved.ok) {
      invalidRows.push({ rowIndex, name: displayName, errors: resolved.errors });
      continue;
    }

    // Build educations JSON
    const csvLevel = row.educationLevel?.trim();
    const hasEducation =
      csvLevel && EDUCATION_LEVELS.includes(csvLevel as (typeof EDUCATION_LEVELS)[number]);
    const educationsJson = hasEducation
      ? JSON.stringify([
          {
            educationLevel: csvLevel,
            fieldOfStudy: row.fieldOfStudy?.trim() || null,
            institutionType: row.institutionType?.trim() || null,
            institutionName: row.institutionName?.trim() || null,
            graduationYear: row.graduationYear?.trim() || null,
            qualificationStatus: row.qualificationStatus?.trim() || null,
          },
        ])
      : "[]";

    // Zod parse
    const parsed = importEmployeeSchema.safeParse({
      ...row,
      departmentId: resolved.departmentId,
      positionId: resolved.positionId,
      userId: "",
      educations: educationsJson,
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
      const csvLevel = row.educationLevel?.trim();
      const hasEducation =
        csvLevel && EDUCATION_LEVELS.includes(csvLevel as (typeof EDUCATION_LEVELS)[number]);
      const educationsJson = hasEducation
        ? JSON.stringify([
            {
              educationLevel: csvLevel,
              fieldOfStudy: row.fieldOfStudy?.trim() || null,
              institutionType: row.institutionType?.trim() || null,
              institutionName: row.institutionName?.trim() || null,
              graduationYear: row.graduationYear?.trim() || null,
              qualificationStatus: row.qualificationStatus?.trim() || null,
            },
          ])
        : "[]";

      // ── 5. Parse and validate with Zod schema ───────────────────────────
      const parsed = importEmployeeSchema.safeParse({
        ...row,
        departmentId: resolved.departmentId,
        positionId: resolved.positionId,
        userId: "",
        educations: educationsJson,
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
            departmentId: resolved.departmentId,
            positionId: resolved.positionId,
            hireDate: parsed.data.hireDate ?? null,
            employmentStatus: "ONBOARDING",
            employmentType: parsed.data.employmentType as EmploymentType | null ?? null,
            managerId: resolved.managerId ?? null,
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
      });

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
