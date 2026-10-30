/**
 * Non-locale force-password-change stub.
 *
 * The proxy redirects bare /force-password-change → /{locale}/force-password-change
 * before this is ever reached. This is a belt-and-suspenders fallback.
 * The actual page with session guards and translations lives at
 * app/[lang]/(auth)/force-password-change/page.tsx.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const LOCALES = ["en", "om"] as const;
const DEFAULT_LOCALE = "en";

export default async function ForcePasswordChangeRedirectPage() {
  const cookieStore = await cookies();
  const val = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    (LOCALES as readonly string[]).includes(val ?? "") ? val! : DEFAULT_LOCALE;
  redirect(`/${locale}/force-password-change`);
}
