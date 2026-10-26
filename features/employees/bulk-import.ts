import "server-only";
import Papa from "papaparse";
import { type EmploymentType, type MaritalStatus, type Gender, type InstitutionType, type QualificationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { employeeSchema, EDUCATION_LEVELS } from "./schemas";
import { generateNextEmployeeId } from "./queries";
import { assertPositionInDepartment } from "@/lib/employee-access";
import type { EducationLevel } from "@prisma/client";

/** Column headers the import template/CSV must use. */
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
  "hireDate",
  "employmentType",
  // Single education record for CSV import (the inline columns map to one Education row)
  "educationLevel",
  "fieldOfStudy",
  "institutionName",
  "graduationYear",
] as const;

// P2-12: employmentStatus is intentionally NOT in the import columns.
// All imported employees start in ONBOARDING state.

export type ImportRowResult =
  | { row: number; status: "created"; employeeId: string; name: string }
  | { row: number; status: "error"; name: string; errors: string[] };

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
    const rowNumber  = i + 2; // +1 for 0-index, +1 for the header row
    const displayName = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || `Row ${rowNumber}`;

    try {
      // ── 1. Resolve department ──────────────────────────────────────────────
      const departmentName = row.department?.trim();
      if (!departmentName) {
        results.push({ row: rowNumber, status: "error", name: displayName, errors: ["department: Department is required"] });
        continue;
      }

      const department = await prisma.department.findFirst({
        where: { name: { equals: departmentName, mode: "insensitive" }, isActive: true },
      });
      if (!department) {
        results.push({
          row: rowNumber, status: "error", name: displayName,
          errors: [`department: "${departmentName}" doesn't match any active department.`],
        });
        continue;
      }

      // ── 2. Resolve position ────────────────────────────────────────────────
      const positionName = row.position?.trim();
      if (!positionName) {
        results.push({ row: rowNumber, status: "error", name: displayName, errors: ["position: Position is required"] });
        continue;
      }

      const position = await prisma.position.findFirst({
        where: {
          name: { equals: positionName, mode: "insensitive" },
          departmentId: department.id,
          isActive: true,
        },
      });
      if (!position) {
        results.push({
          row: rowNumber, status: "error", name: displayName,
          errors: [`position: "${positionName}" doesn't match any active position in ${department.name}.`],
        });
        continue;
      }

      // ── 3. Build educations array from flat CSV columns ────────────────────
      // CSV carries at most one education record per row (flat columns).
      // Build a JSON string for the Zod schema's educations field.
      const csvLevel = row.educationLevel?.trim();
      const hasEducation = csvLevel && EDUCATION_LEVELS.includes(csvLevel as typeof EDUCATION_LEVELS[number]);
      const educationsJson = hasEducation
        ? JSON.stringify([{
            educationLevel:  csvLevel,
            fieldOfStudy:    row.fieldOfStudy?.trim() || null,
            institutionName: row.institutionName?.trim() || null,
            graduationYear:  row.graduationYear?.trim() || null,
          }])
        : "[]";

      // ── 4. Parse and validate with Zod schema ──────────────────────────────
      const parsed = employeeSchema.safeParse({
        ...row,
        departmentId: department.id,
        positionId:   position.id,
        userId: "",
        educations: educationsJson,
        // P2-12: Force ONBOARDING
        employmentStatus: "ONBOARDING",
      });
      if (!parsed.success) {
        results.push({
          row: rowNumber, status: "error", name: displayName,
          errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        });
        continue;
      }

      // P2-11: Belt-and-suspenders position/department check
      await assertPositionInDepartment(position.id, department.id);

      // ── 5. Duplicate email check ───────────────────────────────────────────
      if (parsed.data.email) {
        const duplicate = await prisma.employee.findFirst({
          where: { email: parsed.data.email, deletedAt: null },
        });
        if (duplicate) {
          results.push({
            row: rowNumber, status: "error", name: displayName,
            errors: [
              `Duplicate email — already exists for ${duplicate.firstName} ${duplicate.lastName} (${duplicate.employeeId}).`,
            ],
          });
          continue;
        }
      }

      // ── 6. Create Employee + Education + EmploymentHistory + OnboardingRecord
      const employeeId = await generateNextEmployeeId();

      await prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            employeeId,
            firstName:    parsed.data.firstName,
            middleName:   parsed.data.middleName ?? null,
            lastName:     parsed.data.lastName,
            email:        parsed.data.email ?? null,
            phone:        parsed.data.phone ?? null,
            gender:       parsed.data.gender as Gender | null ?? null,
            dateOfBirth:  parsed.data.dateOfBirth ?? null,
            maritalStatus: parsed.data.maritalStatus as MaritalStatus | null ?? null,
            address:      parsed.data.address ?? null,
            emergencyContactName:         parsed.data.emergencyContactName ?? null,
            emergencyContactPhone:        parsed.data.emergencyContactPhone ?? null,
            emergencyContactRelationship: parsed.data.emergencyContactRelationship ?? null,
            emergencyContactAddress:      parsed.data.emergencyContactAddress ?? null,
            departmentId:   department.id,
            positionId:     position.id,
            hireDate:       parsed.data.hireDate ?? null,
            employmentStatus: "ONBOARDING",
            employmentType: parsed.data.employmentType as EmploymentType | null ?? null,
          },
        });

        if (parsed.data.educations.length > 0) {
          await tx.education.createMany({
            data: parsed.data.educations.map((edu) => ({
              employeeId:          created.id,
              educationLevel:      edu.educationLevel as EducationLevel,
              fieldOfStudy:        edu.fieldOfStudy ?? null,
              institutionType:     (edu.institutionType as InstitutionType) ?? null,
              institutionName:     edu.institutionName ?? null,
              graduationYear:      edu.graduationYear ?? null,
              qualificationStatus: (edu.qualificationStatus as QualificationStatus) ?? null,
            })),
          });
        }

        await tx.employmentHistory.create({
          data: {
            employeeId:     created.id,
            departmentId:   department.id,
            positionId:     position.id,
            employmentType: parsed.data.employmentType as EmploymentType | null | undefined,
            effectiveDate:  created.hireDate ?? new Date(),
            changeReason:   "Initial hire (bulk import)",
          },
        });

        await tx.onboardingRecord.create({
          data: {
            employeeId:     created.id,
            responsibleHrId: actorUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            action:   "CREATE",
            entity:   "Employee",
            entityId: created.id,
            changes:  { source: "bulk_import", employeeId, importedBy: actorUserId },
            userId:   actorUserId,
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
