import type { Metadata } from "next";
import { ForcePasswordChangeForm } from "@/features/auth/force-password-change-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default function ForcePasswordChangePage() {
  return <ForcePasswordChangeForm />;
}
