import "server-only";
import Papa from "papaparse";
import prisma from "@/lib/prisma";
import { employeeSchema } from "./schemas";
import { generateNextEmployeeId } from "./queries";

/** Column headers the import template/CSV must use. cooperativeId/userId are deliberately
 *  excluded — those are relationship fields best set individually via the employee form. */
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
  "employmentStatus",
  "employmentType",
  "educationLevel",
  "fieldOfStudy",
  "institutionName",
  "graduationYear",
] as const;

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
 * Creates one employee per valid row. Processed sequentially (not in parallel) —
 * generateNextEmployeeId reads the current max ID on each call, so rows must be
 * created one at a time within the batch to avoid generating duplicate IDs.
 */
export async function importEmployeeRows(
  rows: Record<string, string>[],
  actorUserId: string
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    const displayName = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || `Row ${rowNumber}`;

    // The CSV uses department/position names (user-friendly); resolve them to the
    // IDs the schema actually expects. Case-insensitive, since spreadsheet entry
    // is prone to casing slips.
    const departmentName = row.department?.trim();
    const positionName = row.position?.trim();

    if (!departmentName) {
      results.push({ row: rowNumber, status: "error", name: displayName, errors: ["department: Department is required"] });
      continue;
    }

    const department = await prisma.department.findFirst({
      where: { name: { equals: departmentName, mode: "insensitive" }, isActive: true },
    });
    if (!department) {
      results.push({
        row: rowNumber,
        status: "error",
        name: displayName,
        errors: [`department: "${departmentName}" doesn't match any active department.`],
      });
      continue;
    }

    if (!positionName) {
      results.push({ row: rowNumber, status: "error", name: displayName, errors: ["position: Position is required"] });
      continue;
    }

    const position = await prisma.position.findFirst({
      where: { name: { equals: positionName, mode: "insensitive" }, departmentId: department.id, isActive: true },
    });
    if (!position) {
      results.push({
        row: rowNumber,
        status: "error",
        name: displayName,
        errors: [`position: "${positionName}" doesn't match any active position in ${department.name}.`],
      });
      continue;
    }

    const parsed = employeeSchema.safeParse({
      ...row,
      departmentId: department.id,
      positionId: position.id,
      cooperativeId: "",
      userId: "",
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

    try {
      const employeeId = await generateNextEmployeeId();
      const created = await prisma.employee.create({
        data: {
          ...parsed.data,
          employeeId,
          employmentType: parsed.data.employmentType as never ?? null,
          educationLevel: parsed.data.educationLevel as never ?? null,
          maritalStatus: parsed.data.maritalStatus as never ?? null,
          gender: parsed.data.gender as never ?? null,
        },
      });

      await prisma.employmentHistory.create({
        data: {
          employeeId: created.id,
          departmentId: parsed.data.departmentId,
          positionId: parsed.data.positionId,
          employmentType: parsed.data.employmentType,
          effectiveDate: created.hireDate ?? new Date(),
          changeReason: "Initial hire (bulk import)",
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "CREATE",
          entity: "Employee",
          entityId: created.id,
          changes: { source: "bulk_import", employeeId },
          userId: actorUserId,
        },
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
