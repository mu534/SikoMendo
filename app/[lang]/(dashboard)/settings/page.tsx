import { redirect } from "next/navigation";

// /settings redirects to /settings/organization
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/settings/organization`);
}
