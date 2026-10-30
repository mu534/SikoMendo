import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

// The root /{lang} route routes users to where they belong.
export default async function LangRootPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await getServerSession();
  redirect(session ? `/${lang}/dashboard` : `/${lang}/sign-in`);
}
