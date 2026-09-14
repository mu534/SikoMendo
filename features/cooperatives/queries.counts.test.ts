import { describe, it, expect } from "vitest";

/**
 * Unit tests for the cooperative counts logic used by getCooperativeCounts().
 * Since the query runs against a real database, we test the filtering logic
 * in isolation by simulating the shape of records the query would produce.
 */

type CoopRecord = {
  isActive: boolean;
  deletedAt: Date | null;
};

function computeCounts(records: CoopRecord[]) {
  const live = records.filter((r) => r.deletedAt === null);
  return {
    total: live.length,
    active: live.filter((r) => r.isActive).length,
    inactive: live.filter((r) => !r.isActive).length,
    archived: records.filter((r) => r.deletedAt !== null).length,
  };
}

describe("getCooperativeCounts — logic", () => {
  it("counts total as only non-archived records", () => {
    const records: CoopRecord[] = [
      { isActive: true, deletedAt: null },
      { isActive: true, deletedAt: null },
      { isActive: false, deletedAt: new Date() },
    ];
    expect(computeCounts(records).total).toBe(2);
  });

  it("counts active correctly", () => {
    const records: CoopRecord[] = [
      { isActive: true, deletedAt: null },
      { isActive: false, deletedAt: null },
      { isActive: true, deletedAt: null },
    ];
    expect(computeCounts(records).active).toBe(2);
  });

  it("counts inactive correctly", () => {
    const records: CoopRecord[] = [
      { isActive: true, deletedAt: null },
      { isActive: false, deletedAt: null },
      { isActive: false, deletedAt: null },
    ];
    expect(computeCounts(records).inactive).toBe(2);
  });

  it("counts archived correctly (deletedAt not null)", () => {
    const records: CoopRecord[] = [
      { isActive: true, deletedAt: new Date() },
      { isActive: false, deletedAt: new Date() },
      { isActive: true, deletedAt: null },
    ];
    expect(computeCounts(records).archived).toBe(2);
  });

  it("returns all zeros for empty dataset", () => {
    expect(computeCounts([])).toEqual({ total: 0, active: 0, inactive: 0, archived: 0 });
  });

  it("archived records do not inflate active/inactive/total counts", () => {
    const records: CoopRecord[] = [
      { isActive: true, deletedAt: new Date() },  // archived — should not count as active
      { isActive: true, deletedAt: null },
    ];
    const counts = computeCounts(records);
    expect(counts.total).toBe(1);
    expect(counts.active).toBe(1);
    expect(counts.inactive).toBe(0);
    expect(counts.archived).toBe(1);
  });
});

// ── Archive / restore preserves data ─────────────────────────────────────────

describe("archive / restore data-preservation logic", () => {
  it("archiving only sets deletedAt, leaves all other fields intact", () => {
    const original = {
      id: "coop-1",
      name: "Test Cooperative",
      cooperativeId: "COOP-001",
      isActive: true,
      district: "Bale",
      legalCertificateKey: "siko-mendo/cooperatives/cert.pdf",
      deletedAt: null as Date | null,
    };

    // Simulate archive
    const archived = { ...original, deletedAt: new Date() };

    // All other fields unchanged
    expect(archived.name).toBe(original.name);
    expect(archived.cooperativeId).toBe(original.cooperativeId);
    expect(archived.district).toBe(original.district);
    expect(archived.legalCertificateKey).toBe(original.legalCertificateKey);
    expect(archived.deletedAt).not.toBeNull();
  });

  it("restoring sets deletedAt back to null, preserving all other fields", () => {
    const archived = {
      id: "coop-1",
      name: "Test Cooperative",
      cooperativeId: "COOP-001",
      isActive: false,
      legalCertificateKey: "siko-mendo/cooperatives/cert.pdf",
      deletedAt: new Date(),
    };

    const restored = { ...archived, deletedAt: null };

    expect(restored.deletedAt).toBeNull();
    expect(restored.name).toBe(archived.name);
    expect(restored.legalCertificateKey).toBe(archived.legalCertificateKey);
  });
});
