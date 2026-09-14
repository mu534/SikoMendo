/**
 * Tests for lib/lifecycle-checklist.ts
 *
 * Covers:
 * P1-6: Onboarding checklist enforcement
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
    expect(result.totalSteps).toBe(7);
  });

  it("returns isComplete=false when any step is missing", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "John",
      lastName: "Doe",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: "user-1",
      contracts: [{ id: "c-1" }],
      documents: [], // missing ID document
    });
    const result = await computeOnboardingChecklist("emp-1");
    expect(result.hasIdDocument).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it("returns isComplete=true when all steps are satisfied", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "John",
      lastName: "Doe",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: "user-1",
      contracts: [{ id: "c-1" }],
      documents: [{ id: "doc-1" }],
    });
    const result = await computeOnboardingChecklist("emp-1");
    expect(result.isComplete).toBe(true);
    expect(result.completedSteps).toBe(7);
  });

  it("hasUserAccount is false when userId is null", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "John",
      lastName: "Doe",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: null,
      contracts: [{ id: "c-1" }],
      documents: [{ id: "doc-1" }],
    });
    const result = await computeOnboardingChecklist("emp-1");
    expect(result.hasUserAccount).toBe(false);
    expect(result.isComplete).toBe(false);
  });
});

describe("requireOnboardingComplete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws with missing-step details when checklist is incomplete", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "Jane",
      lastName: "Smith",
      departmentId: null,  // missing
      positionId: null,    // missing
      hireDate: null,      // missing
      userId: null,        // missing
      contracts: [],       // missing
      documents: [],       // missing
    });
    await expect(requireOnboardingComplete("emp-2")).rejects.toThrow(
      /requirements are not yet met/
    );
  });

  it("does not throw when checklist is complete", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "Jane",
      lastName: "Smith",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: "user-2",
      contracts: [{ id: "c-2" }],
      documents: [{ id: "doc-2" }],
    });
    await expect(requireOnboardingComplete("emp-2")).resolves.toBeUndefined();
  });

  it("error message names the specific missing steps", async () => {
    mockPrismaEmployee.mockResolvedValue({
      firstName: "Jane",
      lastName: "Smith",
      departmentId: "dept-1",
      positionId: "pos-1",
      hireDate: new Date(),
      userId: null,           // only this is missing
      contracts: [{ id: "c-3" }],
      documents: [{ id: "doc-3" }],
    });
    await expect(requireOnboardingComplete("emp-3")).rejects.toThrow(
      /System user account/
    );
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
    const err = await requireOffboardingComplete("emp-1").catch((e) => e);
    expect(err.message).toMatch(/All active contracts must be terminated/);
    expect(err.message).toMatch(/All pending leave requests must be resolved/);
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
