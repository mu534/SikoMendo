import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

/**
 * /attendance — redirects each role to their appropriate attendance view.
 *
 * ADMIN       → /attendance/management  (edit controls + bulk marking)
 * HR_OFFICER  → /attendance/monitoring  (org-wide read-only)
 * MANAGER     → /attendance/monitoring  (org-wide read-only)
 * EMPLOYEE    → /attendance/mine        (own attendance only)
 */
export default async function AttendanceRootPage() {
  const session = await requireSession();

  switch (session.user.role) {
    case "ADMIN":
      redirect("/attendance/management");
    case "HR_OFFICER":
    case "MANAGER":
      redirect("/attendance/monitoring");
    default:
      redirect("/attendance/mine");
  }
}
