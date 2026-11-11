import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const LOCALES = ["en", "om"] as const;
const DEFAULT_LOCALE = "en";

export default async function RedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const val = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = LOCALES.includes(val as (typeof LOCALES)[number]) ? val! : DEFAULT_LOCALE;

  // Forward all query params so links like /employees?archived=1 work correctly
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else if (value !== undefined) {
      qs.set(key, value);
    }
  }
  const query = qs.toString();
  redirect(`/${locale}/employees${query ? `?${query}` : ""}`);
}
