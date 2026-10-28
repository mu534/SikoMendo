/**
 * lib/phone-et.ts
 *
 * Verified Ethiopian mobile operator prefix data and phone-number utilities.
 *
 * Sources:
 *  - Wikipedia "Telephone numbers in Ethiopia"
 *    https://en.wikipedia.org/wiki/Telephone_numbers_in_Ethiopia
 *    (Mobile numbers start with 9 for Ethio telecom and 7 for Safaricom)
 *  - AfricaCallShop operator prefix list (2024)
 *    https://www.africallshop.com/blog/251-country-code-ethiopia/
 *  - Safaricom ET prefix confirmation
 *    https://www.africallshop.com/blog/safaricom-ethiopia/
 *
 * IMPORTANT: Number portability is in effect in Ethiopia. A number's prefix
 * identifies its original operator at the time of issue — not necessarily its
 * current operator. Prefix selection in the UI is for user guidance only; it
 * does NOT guarantee the number is active or belongs to that operator today.
 */

export type OperatorId = "ETHIO_TELECOM" | "SAFARICOM" | "OTHER";

export type PrefixEntry = {
  /** The 3-digit prefix as it appears in a local number (e.g. "091"). */
  prefix:   string;
  /** Formatted display label shown in the dropdown. */
  label:    string;
  /**
   * Number of subscriber digits AFTER the prefix.
   * Ethiopian mobile: prefix = 3 digits (0+2-digit NDC), then 7 subscriber digits = 10 local digits total.
   * Example: 091 | 234 5678 → 7 subscriber digits.
   */
  subscriberDigits: number;
};

export type OperatorEntry = {
  id:       OperatorId;
  label:    string;
  prefixes: PrefixEntry[];
};

/**
 * Ethio telecom verified prefixes.
 * NDC range: 91–97 (9X series).
 * Sources confirm: 091, 092, 093, 094, 096, 097.
 * 095 and 098 are not confirmed in current sources; not included.
 */
const ETHIO_TELECOM_PREFIXES: PrefixEntry[] = [
  { prefix: "091", label: "091", subscriberDigits: 7 },
  { prefix: "092", label: "092", subscriberDigits: 7 },
  { prefix: "093", label: "093", subscriberDigits: 7 },
  { prefix: "094", label: "094", subscriberDigits: 7 },
  { prefix: "096", label: "096", subscriberDigits: 7 },
  { prefix: "097", label: "097", subscriberDigits: 7 },
];

/**
 * Safaricom Ethiopia verified prefixes.
 * Sources confirm: 071, 072, 090.
 * 070 is cited in some sources but less consistently; excluded to avoid false positives.
 */
const SAFARICOM_PREFIXES: PrefixEntry[] = [
  { prefix: "071", label: "071", subscriberDigits: 7 },
  { prefix: "072", label: "072", subscriberDigits: 7 },
  { prefix: "090", label: "090", subscriberDigits: 7 },
];

export const OPERATORS: OperatorEntry[] = [
  {
    id:       "ETHIO_TELECOM",
    label:    "Ethio telecom",
    prefixes: ETHIO_TELECOM_PREFIXES,
  },
  {
    id:       "SAFARICOM",
    label:    "Safaricom Ethiopia",
    prefixes: SAFARICOM_PREFIXES,
  },
  {
    id:       "OTHER",
    label:    "Other / International",
    prefixes: [], // free-text entry
  },
];

/** Flat map from prefix string → operator id, for quick lookup during normalization. */
const PREFIX_TO_OPERATOR = new Map<string, OperatorId>(
  OPERATORS.flatMap((op) =>
    op.prefixes.map((p) => [p.prefix, op.id] as [string, OperatorId])
  )
);

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalizes an Ethiopian mobile phone number to E.164 format (+251XXXXXXXXX).
 *
 * Accepted input formats (spaces, hyphens, parentheses and dots stripped):
 *   09XXXXXXXX     → +2519XXXXXXXX   (local Ethio telecom, 10 digits)
 *   07XXXXXXXX     → +2517XXXXXXXX   (local Safaricom, 10 digits)
 *   9XXXXXXXX      → +2519XXXXXXXX   (bare NDC+subscriber, 9 digits)
 *   7XXXXXXXX      → +2517XXXXXXXX   (bare NDC+subscriber, 9 digits)
 *   2519XXXXXXXX   → +2519XXXXXXXX   (without leading +)
 *   2517XXXXXXXX   → +2517XXXXXXXX
 *   +2519XXXXXXXX  → +2519XXXXXXXX   (already E.164)
 *   +2517XXXXXXXX  → +2517XXXXXXXX
 *
 * Returns null for unrecognized formats.
 */
export function normalizeEthiopianPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-().+]/g, "");

  // Already has country code (with or without leading +)
  // Matches 251 followed by 7 or 9, then 8 more digits = 12 digits total
  const intlMatch = stripped.match(/^(?:\+?251)([79]\d{8})$/);
  if (intlMatch) return `+251${intlMatch[1]}`;

  // Local format: 0 followed by 7 or 9, then 8 more digits = 10 digits
  const localMatch = stripped.match(/^0([79]\d{8})$/);
  if (localMatch) return `+251${localMatch[1]}`;

  // Bare NDC+subscriber: 7 or 9 followed by 8 more digits = 9 digits
  const bareMatch = stripped.match(/^([79]\d{8})$/);
  if (bareMatch) return `+251${bareMatch[1]}`;

  return null;
}

/**
 * Returns true when the value is a valid Ethiopian mobile or international number.
 * For Ethiopian mobile numbers, validates prefix is 9 or 7 series.
 * For Other/International, accepts any non-empty normalized string.
 */
export function isValidPhone(raw: string): boolean {
  return normalizeEthiopianPhone(raw) !== null;
}

/**
 * Attempts to detect the operator from a stored normalized number (+251XXXXXXXXX).
 * Returns the OperatorId, or "OTHER" if unrecognized.
 */
export function detectOperator(normalized: string): OperatorId {
  // Extract NDC: digits 4-6 of "+251XXXXXXXXX" → chars at index 4,5,6
  // e.g. "+251912345678" → "091"
  if (!normalized.startsWith("+251") || normalized.length !== 13) return "OTHER";
  const twoDigitNdc = normalized.slice(4, 6); // e.g. "91", "71"
  const prefix = `0${twoDigitNdc}`;           // e.g. "091", "071"
  return PREFIX_TO_OPERATOR.get(prefix) ?? "OTHER";
}

/**
 * Extracts the local prefix from a normalized number, if recognized.
 * e.g. "+251912345678" → "091"
 */
export function extractPrefix(normalized: string): string | null {
  if (!normalized.startsWith("+251") || normalized.length !== 13) return null;
  const twoDigitNdc = normalized.slice(4, 6);
  const prefix = `0${twoDigitNdc}`;
  return PREFIX_TO_OPERATOR.has(prefix) ? prefix : null;
}

/**
 * Extracts the subscriber digits from a normalized number.
 * e.g. "+251912345678" → "2345678"  (7 digits after the 3-digit prefix 091)
 */
export function extractSubscriberDigits(normalized: string): string {
  if (!normalized.startsWith("+251") || normalized.length !== 13) return "";
  // +251 (4) + NDC 2 digits = subscriber starts at index 6, length 7
  return normalized.slice(6); // 7 digits
}

/**
 * Validates that an international / Other number starts with + and a country code.
 * Basic sanity check only — does not verify number plans for other countries.
 */
export function isValidInternationalPhone(raw: string): boolean {
  const stripped = raw.replace(/[\s\-().]/g, "");
  // Must start with + then 7–15 digits (E.164 max is 15 digits total)
  return /^\+\d{7,15}$/.test(stripped);
}

/**
 * Normalizes an international / Other number: strips spaces/hyphens/parens,
 * ensures it starts with +.
 */
export function normalizeInternationalPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (/^\+\d{7,15}$/.test(stripped)) return stripped;
  return null;
}
