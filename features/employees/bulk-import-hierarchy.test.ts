/**
 * Unit tests for the bulk-import hierarchy enforcement (FEAT-002 Step 5).
 *
 * Tests that resolveRowReferences:
 *   - Rejects rows when the department has no active DM (managerId null).
 *   - Rejects rows when the dept's DM is archived (deletedAt set).
 *   - Rejects rows when the dept's DM has non-ACTIVE employmentStatus.
 *   - Accepts rows and resolves managerId to the dept's DM when everything is valid.
 *   - Ignores the CSV 'manager' column for the DB-write managerId.
 *
 * All DB calls are mocked via vi.mock("@/lib/prisma").
 * Pattern follows features/employment-history/employment-change.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRowReferences } from "./bulk-import";

// ── Mock @/lib/prisma ──────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  default: {
    department: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
    },
    position: {
      findFirst: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";

const mockDeptFindFirst   = prisma.department.findFirst   as ReturnType<typeof vi.fn>;
const mockDeptFindUnique  = prisma.department.findUnique  as ReturnType<typeof vi.fn>;
const mockPosFindFirst    = prisma.position.findFirst     as ReturnType<typeof vi.fn>;
const mockEmpFindFirst    = prisma.employee.findFirst     as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal valid CSV row for testing. */
function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    department: "Finance",
    position:   "Accountant",
    manager:    "",
    ...overrides,
  };
}

/** Minimal department record returned by prisma.department.findFirst. */
const DEPT = { id: "dept-finance", name: "Finance" };
/** Minimal position record returned by prisma.position.findFirst. */
const POSITION = { id: "pos-accountant", name: "Accountant" };
/** Employee id of the active DM for "Finance". */
const DM_EMPLOYEE_ID = "emp-dm-001";

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveRowReferences — hierarchy enforcement (FEAT-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: dept and position resolve successfully.
    mockDeptFindFirst.mockResolvedValue(DEPT);
    mockPosFindFirst.mockResolvedValue(POSITION);
    // Default: manager column is empty — employee lookup not needed.
    mockEmpFindFirst.mockResolvedValue(null);
  });

  // ── Error: no active DM — managerId is null ─────────────────────────────────

  it("returns error when department has no DM (managerId null)", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: null,
      manager: null,
    });

    const result = await resolveRowReferences(makeRow(), 2, "Test Employee");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("no active Department Manager"))).toBe(true);
    }
  });

  // ── Error: DM is archived (deletedAt set) ──────────────────────────────────

  it("returns error when department DM is archived (deletedAt is set)", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: DM_EMPLOYEE_ID,
      manager: {
        deletedAt: new Date("2024-01-01"),
        employmentStatus: "ACTIVE",
      },
    });

    const result = await resolveRowReferences(makeRow(), 2, "Test Employee");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("no active Department Manager"))).toBe(true);
    }
  });

  // ── Error: DM has non-ACTIVE employmentStatus ───────────────────────────────

  it("returns error when department DM has non-ACTIVE employmentStatus (SUSPENDED)", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: DM_EMPLOYEE_ID,
      manager: {
        deletedAt: null,
        employmentStatus: "SUSPENDED",
      },
    });

    const result = await resolveRowReferences(makeRow(), 2, "Test Employee");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("no active Department Manager"))).toBe(true);
    }
  });

  it("returns error when department DM has INACTIVE employmentStatus", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: DM_EMPLOYEE_ID,
      manager: {
        deletedAt: null,
        employmentStatus: "INACTIVE",
      },
    });

    const result = await resolveRowReferences(makeRow(), 2, "Test Employee");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("no active Department Manager"))).toBe(true);
    }
  });

  // ── Success: active DM → managerId resolved to DM's employee id ────────────

  it("resolves managerId to dept DM when dept has an active DM", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: DM_EMPLOYEE_ID,
      manager: {
        deletedAt: null,
        employmentStatus: "ACTIVE",
      },
    });

    const result = await resolveRowReferences(makeRow(), 2, "Test Employee");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.managerId).toBe(DM_EMPLOYEE_ID);
    }
  });

  // ── Ignores CSV 'manager' column — always uses dept DM ─────────────────────

  it("ignores the CSV 'manager' column value and uses the dept DM as managerId", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: DM_EMPLOYEE_ID,
      manager: {
        deletedAt: null,
        employmentStatus: "ACTIVE",
      },
    });

    // Simulate a row where the CSV 'manager' column contains a different employee id
    const rowWithCsvManager = makeRow({ manager: "EMP-0099" });

    // Mock a manager lookup result for the CSV column (display only)
    mockEmpFindFirst.mockResolvedValue({
      id: "emp-csv-manager-different",
      firstName: "Different",
      lastName: "Manager",
    });

    const result = await resolveRowReferences(rowWithCsvManager, 2, "Test Employee");

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The canonical managerId must be the dept's DM, NOT the CSV manager value
      expect(result.managerId).toBe(DM_EMPLOYEE_ID);
      expect(result.managerId).not.toBe("emp-csv-manager-different");
    }
  });

  // ── managerName reflects CSV column (display) when DM is active ────────────

  it("resolves managerName from CSV 'manager' column for display even when DM is used for write", async () => {
    mockDeptFindUnique.mockResolvedValue({
      managerId: DM_EMPLOYEE_ID,
      manager: {
        deletedAt: null,
        employmentStatus: "ACTIVE",
      },
    });

    mockEmpFindFirst.mockResolvedValue({
      id: "emp-csv-manager",
      firstName: "Jane",
      lastName: "Smith",
    });

    const rowWithCsvManager = makeRow({ manager: "EMP-0050" });
    const result = await resolveRowReferences(rowWithCsvManager, 2, "Test Employee");

    expect(result.ok).toBe(true);
    if (result.ok) {
      // managerId uses the dept DM
      expect(result.managerId).toBe(DM_EMPLOYEE_ID);
      // managerName is resolved from the CSV column (display only)
      expect(result.managerName).toBe("Jane Smith");
    }
  });
});
