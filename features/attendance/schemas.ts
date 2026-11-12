import { z } from "zod";

const optionalTime = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null)); // "HH:mm" or null to clear

export const attendanceEntrySchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1), // "YYYY-MM-DD"
  status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED", "ON_LEAVE", "HOLIDAY"]),
  session: z.enum(["MORNING", "AFTERNOON"]).optional(),
  checkIn: optionalTime,
  checkOut: optionalTime,
  notes: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
});

export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;

export function attendanceFormDataToObject(formData: FormData) {
  return {
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    status: formData.get("status"),
    session: formData.get("session") || undefined,
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    notes: formData.get("notes"),
  };
}

/**
 * Combines a "YYYY-MM-DD" date with an "HH:mm" time into a Date, or null.
 *
 * The input time is interpreted as EAT (Africa/Addis_Ababa, UTC+3) so that
 * a manually entered "08:00" is stored as 05:00 UTC — matching how live
 * check-in timestamps are stored. Without the +03:00 suffix the runtime
 * would treat the time as UTC, causing a 3-hour drift in evaluateSessionCheckIn.
 */
export function combineDateAndTime(dateStr: string, time: string | null): Date | null {
  if (!time) return null;
  return new Date(`${dateStr}T${time}:00+03:00`);
}
