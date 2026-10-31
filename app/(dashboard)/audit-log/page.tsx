import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const LOCALES = ["en", "om"] as const;
const DEFAULT_LOCALE = "en";

export default async function RedirectPage() {
  const cookieStore = await cookies();
  const val = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = LOCALES.includes(val as (typeof LOCALES)[number]) ? val! : DEFAULT_LOCALE;
  redirect(`/${locale}/audit-log`);
}
