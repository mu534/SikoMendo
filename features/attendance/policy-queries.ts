import "server-only";
import prisma from "@/lib/prisma";
import {
  normalisePolicyRow,
  DEFAULT_POLICY,
  type PolicyValues,
} from "@/lib/attendance-policy";

/**
 * Loads the active attendance policy from the DB.
 * Falls back to DEFAULT_POLICY when no row exists yet.
 * Never throws — always returns a usable PolicyValues object.
 */
export async function getAttendancePolicy(): Promise<PolicyValues> {
  try {
    const row = await prisma.attendancePolicy.findUnique({
      where: { id: "singleton" },
    });
    if (!row) return { ...DEFAULT_POLICY };
    return normalisePolicyRow(row);
  } catch {
    // Table may not exist yet during first deploy — fall back gracefully.
    return { ...DEFAULT_POLICY };
  }
}

/**
 * Returns the raw DB row for display in the policy editor, or null if not set.
 * Used by the admin policy page so it can show exactly what is stored.
 */
export async function getAttendancePolicyRaw() {
  try {
    return prisma.attendancePolicy.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}
