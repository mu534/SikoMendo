import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const LOCALES = ["en", "om"] as const;
const DEFAULT_LOCALE = "en";

export default async function RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const val = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = LOCALES.includes(val as (typeof LOCALES)[number]) ? val! : DEFAULT_LOCALE;
  redirect(`/${locale}/employees/${id}`);
}
