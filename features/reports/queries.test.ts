/**
 * features/reports/queries.test.ts
 *
 * Unit tests for listReports() query scoping by role.
 *
 * Business rules:
 * - ADMIN and HR_OFFICER (including HR-dept DEPT_MANAGER elevated to HR_OFFICER)
 *   receive unrestricted access (where={}).
 * - All other roles (MANAGER, DEPT_MANAGER, EMPLOYEE) are scoped to their
 *   own generated reports (where={ generatedById: userId }).
 *
 * Uses vi.mock for prisma — no real DB required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock prisma (must be declared before imports that use it)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  default: {
    report: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { listReports } from "./queries";
import { PAGE_SIZE } from "@/lib/utils";

const mockFindMany = prisma.report.findMany as ReturnType<typeof vi.fn>;
const mockCount    = prisma.report.count    as ReturnType<typeof vi.fn>;

// Minimal stubs — listReports returns { items, total, totalPages }
const STUB_ITEMS = [{ id: "r-1", title: "Test Report" }];
const STUB_TOTAL = 1;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue(STUB_ITEMS);
  mockCount.mockResolvedValue(STUB_TOTAL);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extracts the `where` clause passed to prisma.report.findMany */
function capturedWhere(): Record<string, unknown> {
  return (mockFindMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
}

/** Extracts the `where` clause passed to prisma.report.count */
function capturedCountWhere(): Record<string, unknown> {
  return (mockCount.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
}

const USER_ID = "user-abc";
const PAGE    = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Test cases
// ─────────────────────────────────────────────────────────────────────────────

describe("listReports — query scoping by role", () => {
  // (a) ADMIN → unrestricted
  it("ADMIN: queries with where={} (unrestricted)", async () => {
    await listReports(PAGE, USER_ID, "ADMIN");

    expect(capturedWhere()).toEqual({});
    expect(capturedCountWhere()).toEqual({});
  });

  // (b) HR_OFFICER → unrestricted (this is the effective role an HR-dept DEPT_MANAGER resolves to)
  it("HR_OFFICER: queries with where={} (unrestricted)", async () => {
    await listReports(PAGE, USER_ID, "HR_OFFICER");

    expect(capturedWhere()).toEqual({});
    expect(capturedCountWhere()).toEqual({});
  });

  // (c) MANAGER → scoped to own reports
  it("MANAGER: queries with where={ generatedById: userId } (own only)", async () => {
    await listReports(PAGE, USER_ID, "MANAGER");

    expect(capturedWhere()).toEqual({ generatedById: USER_ID });
    expect(capturedCountWhere()).toEqual({ generatedById: USER_ID });
  });

  // (d) DEPT_MANAGER → scoped to own reports
  it("DEPT_MANAGER: queries with where={ generatedById: userId } (own only)", async () => {
    await listReports(PAGE, USER_ID, "DEPT_MANAGER");

    expect(capturedWhere()).toEqual({ generatedById: USER_ID });
    expect(capturedCountWhere()).toEqual({ generatedById: USER_ID });
  });

  // (e) EMPLOYEE → scoped to own reports
  it("EMPLOYEE: queries with where={ generatedById: userId } (own only)", async () => {
    await listReports(PAGE, USER_ID, "EMPLOYEE");

    expect(capturedWhere()).toEqual({ generatedById: USER_ID });
    expect(capturedCountWhere()).toEqual({ generatedById: USER_ID });
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it("passes correct skip/take for page 1", async () => {
    await listReports(1, USER_ID, "ADMIN");

    const call = (mockFindMany.mock.calls[0] as [{ skip: number; take: number }])[0];
    expect(call.skip).toBe(0);
    expect(call.take).toBe(PAGE_SIZE);
  });

  it("passes correct skip/take for page 3", async () => {
    await listReports(3, USER_ID, "ADMIN");

    const call = (mockFindMany.mock.calls[0] as [{ skip: number; take: number }])[0];
    expect(call.skip).toBe(2 * PAGE_SIZE);
    expect(call.take).toBe(PAGE_SIZE);
  });

  // ── Return shape ──────────────────────────────────────────────────────────

  it("returns items, total, and totalPages", async () => {
    mockCount.mockResolvedValue(25);
    const result = await listReports(PAGE, USER_ID, "ADMIN");

    expect(result.items).toEqual(STUB_ITEMS);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(Math.ceil(25 / PAGE_SIZE));
  });

  it("totalPages is at least 1 even when total is 0", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const result = await listReports(PAGE, USER_ID, "ADMIN");
    expect(result.totalPages).toBe(1);
  });
});
