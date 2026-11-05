import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveEffectiveRole } from "@/lib/employee-access";
import type { Role } from "@/lib/permissions";

/**
 * /attendance — redirects each role to their appropriate attendance view.
 *
 * ADMIN            → /attendance/management  (edit controls + bulk marking)
 * HR_OFFICER       → /attendance/monitoring  (org-wide read-only)
 * MANAGER          → /attendance/monitoring  (org-wide read-only)
 * DEPT_MANAGER (HR dept) → /attendance/monitoring  (same as HR_OFFICER)
 * DEPT_MANAGER (other)   → /attendance/mine  (own attendance only)
 * EMPLOYEE         → /attendance/mine        (own attendance only)
 */
export default async function AttendanceRootPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await requireSession();

  const effectiveRole = await resolveEffectiveRole(
    session.user.id,
    session.user.role as Role
  );

  switch (effectiveRole) {
    case "ADMIN":
      redirect(`/${lang}/attendance/management`);
    case "HR_OFFICER":
    case "MANAGER":
      redirect(`/${lang}/attendance/monitoring`);
    default:
      redirect(`/${lang}/attendance/mine`);
  }
}
