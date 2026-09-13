"use client";

/**
 * Shared utilities for the CooperativeForm and its section components.
 * Extracted from cooperative-form.tsx so each section can import them
 * independently without circular dependencies.
 */

import type { ElementType } from "react";

// ── Type ──────────────────────────────────────────────────────────────────────

/**
 * All form values for a cooperative. Dates are ISO strings because
 * React Server Components cannot pass Date objects to client components.
 */
export type CooperativeFormValues = {
  cooperativeId?: string;
  name: string;
  cooperativeType: string;
  registrationNumber: string;
  registrationDate: string;
  dateJoinedUnion: string;
  isActive: boolean;
  district: string;
  kebele: string;
  businessType: string;
  registrationFee: number;
  numberOfShares: number;
  pricePerShare: number;
  totalMembers: number;
  maleMembers: number;
  femaleMembers: number;
  fixedAssets: number;
  currentAssets: number;
  description?: string | null;
  location?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts an ISO date string or null to a value suitable for <input type="date">. */
export function toDateInputValue(date?: string | null): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

/** Inline red asterisk for required fields. */
export function RequiredMark() {
  return (
    <span className="ml-0.5 text-red-500" aria-hidden="true">
      *
    </span>
  );
}

/** Section header with icon, used by every Card section in the form. */
export function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: ElementType;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-ink-900/8 pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
    </div>
  );
}
