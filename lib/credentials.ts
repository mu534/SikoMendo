import "server-only";
import crypto from "crypto";
import { z } from "zod";

/** Shared "strong password" rule: 8+ chars, at least one letter and one number. */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

/** Derives the login username from an Employee ID, e.g. "EMP-0025" -> "emp-0025". */
export function usernameFromEmployeeId(employeeId: string): string {
  return employeeId.toLowerCase();
}

// Avoids visually ambiguous characters (0/O, 1/l/I) since this gets printed/copied by hand.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%";
const ALL_CHARS = LETTERS + DIGITS;

function randomChar(charset: string): string {
  return charset[crypto.randomBytes(1)[0] % charset.length];
}

/** Generates a random temporary password that's guaranteed to satisfy strongPasswordSchema. */
export function generateTempPassword(): string {
  // Guarantee at least one letter, one digit, and one symbol, then fill the rest randomly.
  const required = [randomChar(LETTERS), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: 8 }, () => randomChar(ALL_CHARS));
  const chars = [...required, ...rest];

  // Shuffle (Fisher-Yates) so the guaranteed characters aren't always in the same position.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
