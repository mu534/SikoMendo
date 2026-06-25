import { z } from "zod";

const optionalTime = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null)); // "HH:mm" or null to clear

export const attendanceEntrySchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1), // "YYYY-MM-DD"
  status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"]),
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
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    notes: formData.get("notes"),
  };
}

/** Combines a "YYYY-MM-DD" date with an "HH:mm" time into a Date, or null. */
export function combineDateAndTime(dateStr: string, time: string | null): Date | null {
  if (!time) return null;
  return new Date(`${dateStr}T${time}:00`);
}
