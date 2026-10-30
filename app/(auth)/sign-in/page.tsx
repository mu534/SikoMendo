/**
 * Non-locale sign-in stub.
 *
 * The proxy (proxy.ts) redirects bare /sign-in to /{locale}/sign-in before
 * this page is ever reached. This server-side redirect is a belt-and-suspenders
 * fallback in case a request somehow bypasses the proxy (e.g. direct Server
 * Action calls, missing cookie on first load). It ensures the fully-translated
 * auth route under app/[lang]/(auth)/sign-in/ is always used.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const LOCALES = ["en", "om"] as const;
const DEFAULT_LOCALE = "en";

export default async function SignInRedirectPage() {
  const cookieStore = await cookies();
  const val = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    (LOCALES as readonly string[]).includes(val ?? "") ? val! : DEFAULT_LOCALE;
  redirect(`/${locale}/sign-in`);
}
