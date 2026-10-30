import { redirect } from "next/navigation";

// /settings redirects to /settings/organization
export default function SettingsPage() {
  redirect("/settings/organization");
}
