import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Siko Mendo Union HRMIS",
    template: "%s | Siko Mendo Union HRMIS",
  },
  description:
    "Human Resource Information Management System for Siko Mendo Union, Bale Robe, Ethiopia.",
};

export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  // Validate the locale — return 404 for unknown values
  if (!routing.locales.includes(lang as "en" | "om")) {
    notFound();
  }

  // Load messages for this locale (next-intl handles the request config)
  const messages = await getMessages();

  return (
    <html lang={lang} className="h-full">
      <body className="h-full antialiased">
        <NextIntlClientProvider locale={lang} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
