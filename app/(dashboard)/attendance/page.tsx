import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";

/**
 * /attendance — redirects to the appropriate sub-route based on role.
 *
 * Admin → /attendance/management (with access to all sub-routes)
 * HR Officer → /attendance/monitoring
 * Manager → /attendance/team
 * Employee → /attendance/mine
 *
 * All roles can reach /attendance/mine directly.
 */
export default async function AttendanceRootPage() {
  const session = await requireSession();
  const role = session.user.role;

  if (can(role, "MANAGE_ATTENDANCE")) {
    redirect("/attendance/management");
  }

  if (role === "HR_OFFICER") {
    redirect("/attendance/monitoring");
  }

  if (role === "MANAGER") {
    redirect("/attendance/team");
  }

  // EMPLOYEE (and any other role)
  redirect("/attendance/mine");
}
