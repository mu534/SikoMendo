import { clsx, type ClassValue } from "clsx";

/** Merges conditional class names. Tailwind classes are simple enough here that we don't need tailwind-merge. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(date)
  );
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const PAGE_SIZE = 10;

export function parsePageParam(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseStringParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
