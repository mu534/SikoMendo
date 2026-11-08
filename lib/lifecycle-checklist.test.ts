/**
 * Tests for lib/lifecycle-checklist.ts
 *
 * Covers:
 * P1-6: Onboarding checklist enforcement (including employment-type-conditional contract)
 * P1-7: Offboarding checklist enforcement
 *
 * These tests mock the Prisma client to avoid needing a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => {
  return {
    default: {
      employee: {
        findUnique: vi.fn(),
      },
    },
  };
});

import prisma from "@/lib/prisma";
import {
  computeOnboardingChecklist,
  requireOnboardingComplete,
  computeOffboardingChecklist,
  requireOffboardingComplete,
} from "./lifecycle-checklist";

const mockPrismaEmployee = prisma.employee.findUnique as ReturnType<typeof vi.fn>;

// ── Shared mock data ──────────────────────────────────────────────────────────

/** A fully complete employee with a given employment type. */
function fullEmployee(employmentType: string | null) {
  return {
    firstName: "John",
    lastName: "Doe",
    departmentId: "dept-1",
    positionId: "pos-1",
    hireDate: new Date(),
    userId: "user-1",
    employmentType,
    contracts: [{ id: "c-1" }],
    documents: [{ id: "doc-1" }],
  };
}

/** A fully complete employee WITHOUT any contracts. */
function fullEmployeeNoContract(employmentType: string | null) {
  return {
    firstName: "John",
    lastName: "Doe",
    departmentId: "dept-1",
    positionId: "pos-1",
    hireDate: new Date(),
    userId: "user-1",
    employmentType,
    contracts: [],
    documents: [{ id: "doc-1" }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding checklist (P1-6)
// ─────────────────────────────────────────────────────────────────────────────

describe("computeOnboardingChecklist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all false when employee not found", async () => {
    mockPrismaEmployee.mockResolvedValue(null);
    const result = await computeOnboardingChecklist("nonexistent");
    expect(result.isComplete).toBe(false);
    expect(result.completedSteps).toBe(0);
    // totalSteps is 6 for the not-found case (contract not required by default)
    expect(result.totalSteps).toBe(6);
    expect(result.contractRequired).toBe(false);
  });

  it("returns isComplete=false when any non-contract step is missing", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "John",
      lastName: "Doe",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: "user-1",
      employmentType: "CONTRACT",
      contracts: [{ id: "c-1" }],
      documents: [], // missing ID document
    });
    const result = await computeOnboardingChecklist("emp-1");
    expect(result.hasIdDocument).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  // ── PERMANENT ──────────────────────────────────────────────────────────────

  it("PERMANENT: completes without a contract record", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("PERMANENT"));
    const result = await computeOnboardingChecklist("emp-perm");
    expect(result.contractRequired).toBe(false);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.totalSteps).toBe(6);
    expect(result.completedSteps).toBe(6);
  });

  it("PERMANENT: completes with a contract record too", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployee("PERMANENT"));
    const result = await computeOnboardingChecklist("emp-perm");
    expect(result.contractRequired).toBe(false);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.totalSteps).toBe(6);
  });

  it("null employmentType is treated as PERMANENT (no contract required)", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract(null));
    const result = await computeOnboardingChecklist("emp-null");
    expect(result.contractRequired).toBe(false);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  // ── CONTRACT ──────────────────────────────────────────────────────────────

  it("CONTRACT: requires an active contract record", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("CONTRACT"));
    const result = await computeOnboardingChecklist("emp-contract");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.totalSteps).toBe(7);
  });

  it("CONTRACT: completes when active contract is present", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployee("CONTRACT"));
    const result = await computeOnboardingChecklist("emp-contract");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.totalSteps).toBe(7);
  });

  // ── TEMPORARY ─────────────────────────────────────────────────────────────

  it("TEMPORARY: requires a contract (no contract → incomplete)", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("TEMPORARY"));
    const result = await computeOnboardingChecklist("emp-temp");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.totalSteps).toBe(7);
  });

  it("TEMPORARY: completes with a contract", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployee("TEMPORARY"));
    const result = await computeOnboardingChecklist("emp-temp");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  // ── PROBATION ─────────────────────────────────────────────────────────────

  it("PROBATION: requires a contract (no contract → incomplete)", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("PROBATION"));
    const result = await computeOnboardingChecklist("emp-prob");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.totalSteps).toBe(7);
  });

  it("PROBATION: completes with a contract", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployee("PROBATION"));
    const result = await computeOnboardingChecklist("emp-prob");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  // ── INTERNSHIP ────────────────────────────────────────────────────────────

  it("INTERNSHIP: requires a contract (no contract → incomplete)", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("INTERNSHIP"));
    const result = await computeOnboardingChecklist("emp-intern");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.totalSteps).toBe(7);
  });

  it("INTERNSHIP: completes with a contract", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployee("INTERNSHIP"));
    const result = await computeOnboardingChecklist("emp-intern");
    expect(result.contractRequired).toBe(true);
    expect(result.hasContract).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  // ── Generic checks ────────────────────────────────────────────────────────

  it("hasUserAccount is false when userId is null", async () => {
    mockPrismaEmployee.mockResolvedValue({
      ...fullEmployee("CONTRACT"),
      userId: null,
    });
    const result = await computeOnboardingChecklist("emp-1");
    expect(result.hasUserAccount).toBe(false);
    expect(result.isComplete).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireOnboardingComplete
// ─────────────────────────────────────────────────────────────────────────────

describe("requireOnboardingComplete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws with missing-step details when checklist is incomplete", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "Jane",
      lastName: "Smith",
      departmentId: null,
      positionId: null,
      hireDate: null,
      userId: null,
      employmentType: "CONTRACT",
      contracts: [],
      documents: [],
    });
    await expect(requireOnboardingComplete("emp-2")).rejects.toThrow(
      /requirements are not yet met/
    );
  });

  it("does not throw for CONTRACT employee when all steps are satisfied", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployee("CONTRACT"));
    await expect(requireOnboardingComplete("emp-2")).resolves.toBeUndefined();
  });

  it("does NOT throw for PERMANENT employee without a contract", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("PERMANENT"));
    await expect(requireOnboardingComplete("emp-perm")).resolves.toBeUndefined();
  });

  it("throws for CONTRACT employee without a contract — message mentions Active contract", async () => {
    mockPrismaEmployee.mockResolvedValue(fullEmployeeNoContract("CONTRACT"));
    await expect(requireOnboardingComplete("emp-contract")).rejects.toThrow(
      /Active contract/
    );
  });

  it("error message names the specific missing steps (user account)", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "Jane",
      lastName: "Smith",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: null, // only this is missing
      employmentType: "CONTRACT",
      contracts: [{ id: "c-3" }],
      documents: [{ id: "doc-3" }],
    });
    await expect(requireOnboardingComplete("emp-3")).rejects.toThrow(
      /System user account/
    );
  });

  it("does not include 'Active contract' in error for PERMANENT employee", async () => {
    // PERMANENT employee missing only userId — should NOT mention contract
    mockPrismaEmployee.mockResolvedValue({
      ...fullEmployeeNoContract("PERMANENT"),
      userId: null,
    });
    const err = await requireOnboardingComplete("emp-perm-no-user").catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toMatch(/Active contract/);
    expect((err as Error).message).toMatch(/System user account/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Offboarding checklist (P1-7)
// ─────────────────────────────────────────────────────────────────────────────

describe("computeOffboardingChecklist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns safe defaults (all true) when employee not found", async () => {
    mockPrismaEmployee.mockResolvedValue(null);
    const result = await computeOffboardingChecklist("nonexistent");
    expect(result.isComplete).toBe(true);
  });

  it("hasTerminatedContract=false when active contract exists", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: false },
      contracts: [{ id: "c-1" }],    // active contract still exists
      leaveRequests: [],
    });
    const result = await computeOffboardingChecklist("emp-1");
    expect(result.hasTerminatedContract).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it("hasNoActiveLeave=false when pending leave exists", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: true },
      contracts: [],
      leaveRequests: [{ id: "lr-1" }], // pending leave
    });
    const result = await computeOffboardingChecklist("emp-1");
    expect(result.hasNoActiveLeave).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it("userAccountDeactivated=true when no user account exists", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: null,
      user: null,
      contracts: [],
      leaveRequests: [],
    });
    const result = await computeOffboardingChecklist("emp-1");
    expect(result.userAccountDeactivated).toBe(true);
  });

  it("userAccountDeactivated=false when account exists and is not banned", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: false },
      contracts: [],
      leaveRequests: [],
    });
    const result = await computeOffboardingChecklist("emp-1");
    expect(result.userAccountDeactivated).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it("returns isComplete=true when all steps are satisfied", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: true },
      contracts: [],
      leaveRequests: [],
    });
    const result = await computeOffboardingChecklist("emp-1");
    expect(result.isComplete).toBe(true);
    expect(result.completedSteps).toBe(3);
  });
});

describe("requireOffboardingComplete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when checklist is incomplete", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: false },
      contracts: [{ id: "c-1" }],
      leaveRequests: [{ id: "lr-1" }],
    });
    await expect(requireOffboardingComplete("emp-1")).rejects.toThrow(
      /requirements are not yet met/
    );
  });

  it("throws and names all incomplete steps", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: false },
      contracts: [{ id: "c-1" }],     // active contract
      leaveRequests: [{ id: "lr-1" }], // pending leave
    });
    const err = await requireOffboardingComplete("emp-1").catch((e: Error) => e);
    expect((err as Error).message).toMatch(/All active contracts must be terminated/);
    expect((err as Error).message).toMatch(/All pending leave requests must be resolved/);
  });

  it("does not throw when all steps are complete", async () => {
    mockPrismaEmployee.mockResolvedValue({
      userId: "user-1",
      user: { banned: true },
      contracts: [],
      leaveRequests: [],
    });
    await expect(requireOffboardingComplete("emp-1")).resolves.toBeUndefined();
  });
});
