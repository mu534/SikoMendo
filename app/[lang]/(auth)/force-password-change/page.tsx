import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ForcePasswordChangeForm } from "@/features/auth/force-password-change-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default async function ForcePasswordChangePage() {
  const session = await getServerSession();

  // Not authenticated — send to sign-in.
  if (!session) {
    redirect("/sign-in");
  }

  // Re-read the flag from the DB rather than the (potentially stale) session
  // value, so an admin reset that just happened is reflected immediately
  // without requiring the employee to sign in again.
  const flags = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  // Flag already cleared — nothing to do here, send to dashboard.
  if (!flags?.mustChangePassword) {
    redirect("/dashboard");
  }

  return <ForcePasswordChangeForm />;
}
