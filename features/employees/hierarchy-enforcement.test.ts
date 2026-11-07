/**
 * Unit tests for three-tier hierarchy enforcement helpers.
 *
 * Tests cover FEAT-001 acceptance criteria:
 *   - resolveReportingManager: returns DM id / throws for various invalid states
 *   - assertManagerBelongsToDept: passes when correct / throws when cross-dept
 *
 * DB calls are mocked via vi.mock('@/lib/prisma').
 * Transaction client is a partial mock of the Prisma tx object.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ───────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    department: {
      findUnique: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

import prisma from "@/lib/prisma";
import { resolveReportingManager, assertManagerBelongsToDept } from "@/lib/employee-access";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal transaction-client mock that proxies department.findUnique
 * to the mocked prisma client. assertManagerBelongsToDept uses prisma directly
 * (not a tx), so it does not need a tx mock.
 */
function makeTx(deptResult: unknown): Parameters<Parameters<typeof import("@/lib/prisma").default.$transaction>[0]>[0] {
  return {
    department: {
      findUnique: vi.fn().mockResolvedValue(deptResult),
    },
  } as unknown as Parameters<Parameters<typeof import("@/lib/prisma").default.$transaction>[0]>[0];
}

// ── resolveReportingManager ───────────────────────────────────────────────────

describe("resolveReportingManager", () => {
  it("returns the active DM id when department has an active DM", async () => {
    const tx = makeTx({
      managerId: "dm-emp-1",
      manager: { id: "dm-emp-1", deletedAt: null, employmentStatus: "ACTIVE" },
    });

    const result = await resolveReportingManager(tx, "dept-1", "other-emp-99");
    expect(result).toBe("dm-emp-1");
  });

  it("throws deptHasNoActiveManager when managerId is null (no DM assigned)", async () => {
    const tx = makeTx({
      managerId: null,
      manager: null,
    });

    await expect(
      resolveReportingManager(tx, "dept-1", "other-emp-99")
    ).rejects.toMatchObject({ code: "errors.hierarchy.deptHasNoActiveManager" });
  });

  it("throws deptHasNoActiveManager when DM is archived (deletedAt set)", async () => {
    const tx = makeTx({
      managerId: "dm-emp-1",
      manager: { id: "dm-emp-1", deletedAt: new Date(), employmentStatus: "ACTIVE" },
    });

    await expect(
      resolveReportingManager(tx, "dept-1", "other-emp-99")
    ).rejects.toMatchObject({ code: "errors.hierarchy.deptHasNoActiveManager" });
  });

  it("throws deptHasNoActiveManager when DM employmentStatus is SUSPENDED", async () => {
    const tx = makeTx({
      managerId: "dm-emp-1",
      manager: { id: "dm-emp-1", deletedAt: null, employmentStatus: "SUSPENDED" },
    });

    await expect(
      resolveReportingManager(tx, "dept-1", "other-emp-99")
    ).rejects.toMatchObject({ code: "errors.hierarchy.deptHasNoActiveManager" });
  });

  it("throws deptHasNoActiveManager when DM employmentStatus is ONBOARDING", async () => {
    const tx = makeTx({
      managerId: "dm-emp-1",
      manager: { id: "dm-emp-1", deletedAt: null, employmentStatus: "ONBOARDING" },
    });

    await expect(
      resolveReportingManager(tx, "dept-1", "other-emp-99")
    ).rejects.toMatchObject({ code: "errors.hierarchy.deptHasNoActiveManager" });
  });

  it("throws selfAssignment when the resolved DM id equals the employee's own id", async () => {
    const tx = makeTx({
      managerId: "emp-self",
      manager: { id: "emp-self", deletedAt: null, employmentStatus: "ACTIVE" },
    });

    await expect(
      resolveReportingManager(tx, "dept-1", "emp-self")
    ).rejects.toMatchObject({ code: "errors.hierarchy.selfAssignment" });
  });
});

// ── assertManagerBelongsToDept ────────────────────────────────────────────────

describe("assertManagerBelongsToDept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes silently when managerId is null", async () => {
    // Should not call prisma at all
    await expect(
      assertManagerBelongsToDept(null, "dept-1")
    ).resolves.toBeUndefined();
    expect((prisma.department.findUnique as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("passes silently when managerId is undefined", async () => {
    await expect(
      assertManagerBelongsToDept(undefined, "dept-1")
    ).resolves.toBeUndefined();
    expect((prisma.department.findUnique as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("passes silently when managerId exactly equals dept.managerId", async () => {
    (prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      managerId: "dm-emp-1",
    });

    await expect(
      assertManagerBelongsToDept("dm-emp-1", "dept-1")
    ).resolves.toBeUndefined();
  });

  it("throws managerNotInDepartment when managerId does not match dept.managerId", async () => {
    (prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      managerId: "dm-emp-1",
    });

    await expect(
      assertManagerBelongsToDept("some-other-emp", "dept-1")
    ).rejects.toMatchObject({ code: "errors.hierarchy.managerNotInDepartment" });
  });

  it("throws managerNotInDepartment when dept has no DM (managerId is null) but a value is submitted", async () => {
    (prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      managerId: null,
    });

    await expect(
      assertManagerBelongsToDept("any-emp", "dept-1")
    ).rejects.toMatchObject({ code: "errors.hierarchy.managerNotInDepartment" });
  });
});
