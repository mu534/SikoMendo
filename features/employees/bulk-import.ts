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

    const parsed = employeeSchema.safeParse({ ...row, cooperativeId: "", userId: "" });
    if (!parsed.success) {
      results.push({
        row: rowNumber,
        status: "error",
        name: displayName,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
      continue;
    }

    try {
      const employeeId = await generateNextEmployeeId();
      const created = await prisma.employee.create({
        data: { ...parsed.data, employeeId },
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
