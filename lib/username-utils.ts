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

/**
 * Generates a random, hard-to-guess temporary password.
 * Guarantees at least one lowercase, one uppercase, one digit, and one
 * symbol, then fills the rest randomly and shuffles. Ambiguous-looking
 * characters (0/O, 1/l/I) are excluded so it's easy to read and retype.
 */
export function generateSecurePassword(length = 12): string {
  const lowers = "abcdefghjkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_+=";
  const all = lowers + uppers + digits + symbols;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  const required = [pick(lowers), pick(uppers), pick(digits), pick(symbols)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => pick(all));

  const combined = [...required, ...rest];

  // Fisher-Yates shuffle so the required characters aren't always up front.
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}
