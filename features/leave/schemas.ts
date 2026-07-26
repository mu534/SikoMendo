import { z } from "zod";

export const LEAVE_TYPES = ["ANNUAL", "SICK", "EMERGENCY", "MATERNITY", "PATERNITY", "UNPAID"] as const;
export type LeaveTypeValue = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatusValue = (typeof LEAVE_STATUSES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveTypeValue, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  EMERGENCY: "Emergency Leave",
  MATERNITY: "Maternity Leave",
  PATERNITY: "Paternity Leave",
  UNPAID: "Unpaid Leave",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatusValue, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

// ── Submit a leave request ──────────────────────────────────────────────────

export const leaveRequestSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES, { message: "Select a valid leave type." }),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    reason: z.string().trim().min(5, "Please provide a reason (at least 5 characters)."),
  })
  .refine((data) => new Date(`${data.startDate}T00:00:00Z`) <= new Date(`${data.endDate}T00:00:00Z`), {
    message: "Start date cannot be after end date.",
    path: ["endDate"],
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export function leaveRequestFormDataToObject(formData: FormData) {
  const s = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  return {
    leaveType: s("leaveType"),
    startDate: s("startDate"),
    endDate: s("endDate"),
    reason: s("reason"),
  };
}

// ── Approve / reject a leave request ────────────────────────────────────────

export const leaveDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().optional(),
  })
  .refine(
    (data) => data.decision !== "REJECTED" || (data.rejectionReason && data.rejectionReason.length >= 3),
    {
      message: "A rejection reason (at least 3 characters) is required when rejecting a request.",
      path: ["rejectionReason"],
    }
  );

export function leaveDecisionFormDataToObject(formData: FormData) {
  const decision = formData.get("decision");
  const rejectionReason = formData.get("rejectionReason");

  return {
    decision: typeof decision === "string" ? decision : "",
    rejectionReason: typeof rejectionReason === "string" ? rejectionReason.trim() : "",
  };
}

/** Inclusive day count between two calendar dates (e.g. Mon–Fri = 5). */
export function calculateTotalDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}
