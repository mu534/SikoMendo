import { z } from "zod";

// ── Onboarding ─────────────────────────────────────────────────────────────

export const completeOnboardingSchema = z.object({
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

export function completeOnboardingFormDataToObject(formData: FormData) {
  return { notes: String(formData.get("notes") ?? "") };
}

// ── Offboarding ────────────────────────────────────────────────────────────

export const OFFBOARDING_REASONS = [
  "RESIGNATION",
  "RETIREMENT",
  "CONTRACT_END",
  "TERMINATION",
  "OTHER",
] as const;

export type OffboardingReasonValue = (typeof OFFBOARDING_REASONS)[number];

export const OFFBOARDING_REASON_LABELS: Record<OffboardingReasonValue, string> = {
  RESIGNATION:   "Resignation",
  RETIREMENT:    "Retirement",
  CONTRACT_END:  "Contract End",
  TERMINATION:   "Termination",
  OTHER:         "Other",
};

export const startOffboardingSchema = z.object({
  reason: z.enum(OFFBOARDING_REASONS, { required_error: "Select a reason." }),
  lastWorkingDate: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export type StartOffboardingInput = z.infer<typeof startOffboardingSchema>;

export const completeOffboardingSchema = z.object({
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export type CompleteOffboardingInput = z.infer<typeof completeOffboardingSchema>;

export function startOffboardingFormDataToObject(formData: FormData) {
  return {
    reason: String(formData.get("reason") ?? ""),
    lastWorkingDate: String(formData.get("lastWorkingDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export function completeOffboardingFormDataToObject(formData: FormData) {
  return { notes: String(formData.get("notes") ?? "") };
}

// ── Status helpers ──────────────────────────────────────────────────────────

/** Human-readable label for every EmploymentStatus value. */
export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  ONBOARDING:  "Onboarding",
  ACTIVE:      "Active",
  ON_LEAVE:    "On Leave",
  RESIGNED:    "Resigned",
  RETIRED:     "Retired",
  SUSPENDED:   "Suspended",
  TERMINATED:  "Terminated",
  INACTIVE:    "Inactive",
};

/** Maps EmploymentStatus → Badge tone for visual feedback. */
export const EMPLOYMENT_STATUS_TONES: Record<string, "success" | "warning" | "danger" | "neutral" | "brand"> = {
  ONBOARDING:  "brand",
  ACTIVE:      "success",
  ON_LEAVE:    "warning",
  RESIGNED:    "neutral",
  RETIRED:     "neutral",
  SUSPENDED:   "danger",
  TERMINATED:  "danger",
  INACTIVE:    "neutral",
};
