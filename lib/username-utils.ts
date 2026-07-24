import "server-only";
import prisma from "@/lib/prisma";

/**
 * Generates a unique username from first + last name.
 * Format: firstname.lastname (lowercased, spaces removed)
 * If taken: firstname.lastname1, firstname.lastname2, ...
 */
export async function generateUsernameFromName(
  firstName: string,
  lastName: string
): Promise<string> {
  const base = `${firstName.trim().toLowerCase().replace(/\s+/g, "")}.${lastName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")}`;

  // Remove any non-alphanumeric except dots, hyphens, underscores
  const sanitized = base.replace(/[^a-z0-9._-]/g, "");

  const exists = await prisma.user.findUnique({ where: { username: sanitized } });
  if (!exists) return sanitized;

  // Try appending numbers until unique
  for (let i = 1; i <= 999; i++) {
    const candidate = `${sanitized}${i}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }

  // Fallback with timestamp suffix
  return `${sanitized}_${Date.now()}`;
}
