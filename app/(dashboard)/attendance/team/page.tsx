import { redirect } from "next/navigation";

/**
 * /attendance/team — legacy route, now consolidates to /attendance/monitoring.
 * Both HR Officer and Manager use the unified monitoring view.
 */
export default function TeamAttendancePage() {
  redirect("/attendance/monitoring");
}
