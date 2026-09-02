/**
 * Gregorian \u2194 Ethiopian calendar conversion.
 *
 * The Ethiopian calendar has 13 months: 12 of 30 days, plus a short 13th
 * month (Pagume) of 5 days (6 in an Ethiopian leap year). Its leap-year rule
 * follows the Julian calendar (every 4th year, no century exception), which
 * is why the Ethiopian New Year falls on different Gregorian dates
 * (Meskerem 1 = Sept 11, or Sept 12 in the year before a Gregorian leap
 * year) and why that offset will shift again after 2100 (a Gregorian
 * non-leap century year).
 *
 * Both directions convert through the Julian Day Number (JDN) as a common,
 * unambiguous intermediate, rather than doing Gregorian-Ethiopian day-count
 * arithmetic directly \u2014 this is the standard, well-tested approach.
 *
 * Verified against the well-known historical anchor: the Ethiopian
 * Millennium (Meskerem 1, 2000 E.C.) fell on September 12, 2007 (Gregorian)
 * \u2014 see ethiopian-calendar.test.ts.
 */

import { formatDate } from "@/lib/utils";

export type EthiopianDate = { year: number; month: number; day: number };
export type GregorianDate = { year: number; month: number; day: number };

export const ETHIOPIAN_MONTH_NAMES = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
  "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume",
] as const;

// JDN of Meskerem 1, year 1 (Amete Mihret era) \u2014 the standard Ethiopian
// calendar epoch constant used across published implementations.
const JD_EPOCH_OFFSET_AMETE_MIHRET = 1723856;

function gregorianToJDN({ year, month, day }: GregorianDate): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = (jdn - JD_EPOCH_OFFSET_AMETE_MIHRET) % 1461; // 1461 = one 4-year Ethiopian leap cycle
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - JD_EPOCH_OFFSET_AMETE_MIHRET) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

function ethiopianToJDN({ year, month, day }: EthiopianDate): number {
  // Inverse of jdnToEthiopian's decomposition: D = 1461*k + 365*q + n, where
  // k = floor(year / 4), q = year mod 4, and n is the 0-indexed day of year
  // (this uniformly covers the Pagume 6 leap day too, at q=3, n=365 — no
  // special-casing needed, since 365*3 + 365 = 1460, exactly the leap-day
  // boundary jdnToEthiopian expects).
  const k = Math.floor(year / 4);
  const q = year - 4 * k;
  const dayOfYear = 30 * (month - 1) + (day - 1);
  const D = 1461 * k + 365 * q + dayOfYear;
  return D + JD_EPOCH_OFFSET_AMETE_MIHRET;
}

/** Converts a Gregorian calendar date to its Ethiopian calendar equivalent. */
export function gregorianToEthiopian(date: Date | GregorianDate): EthiopianDate {
  const g = date instanceof Date
    ? { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
    : date;
  return jdnToEthiopian(gregorianToJDN(g));
}

/** Converts an Ethiopian calendar date to its Gregorian calendar equivalent. */
export function ethiopianToGregorian(date: EthiopianDate): GregorianDate {
  return jdnToGregorian(ethiopianToJDN(date));
}

/** e.g. "27 Tir 2018 E.C." */
export function formatEthiopianDate(date: Date | GregorianDate): string {
  const e = gregorianToEthiopian(date);
  const monthName = ETHIOPIAN_MONTH_NAMES[e.month - 1] ?? String(e.month);
  return `${e.day} ${monthName} ${e.year} E.C.`;
}

/**
 * Pairs the app's standard Gregorian date format with its Ethiopian
 * equivalent, e.g. "05 Jan 2026 (27 Tir 2018 E.C.)". Matches formatDate's
 * signature (handles null/undefined the same way) so it's a drop-in
 * replacement wherever the Ethiopian date adds real value \u2014 hire dates,
 * dates of birth, leave dates, cooperative registration dates.
 */
export function formatDateWithEthiopian(date: Date | string | null | undefined): string {
  if (!date) return "\u2014";
  const d = new Date(date);
  return `${formatDate(d)} (${formatEthiopianDate(d)})`;
}
