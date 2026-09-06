import "server-only";
import prisma from "@/lib/prisma";

export type OrgSettings = {
  id: string;
  orgName: string;
  tagline: string;
  location: string;
  logoUrl: string | null;
  logoKey: string | null;
  updatedAt: Date;
};

const DEFAULTS: OrgSettings = {
  id: "singleton",
  orgName: "Siko Mendo Union",
  tagline: "Union HRMIS",
  location: "Bale Robe, Ethiopia",
  logoUrl: null,
  logoKey: null,
  updatedAt: new Date(0),
};

/**
 * Reads the single org_settings row, returning safe defaults when the row
 * doesn't exist yet (before any admin has saved settings).
 *
 * Uses $queryRaw so this works even when the Prisma client cache is stale
 * (i.e. the client hasn't been regenerated since the migration ran).
 */
export async function getOrgSettings(): Promise<OrgSettings> {
  try {
    const rows = await prisma.$queryRaw<OrgSettings[]>`
      SELECT id, "orgName", tagline, location, "logoUrl", "logoKey", "updatedAt"
      FROM org_settings
      WHERE id = 'singleton'
      LIMIT 1
    `;
    return rows[0] ?? DEFAULTS;
  } catch {
    // Table doesn't exist yet or any other DB error — return defaults
    return DEFAULTS;
  }
}
