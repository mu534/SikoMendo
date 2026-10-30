import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-ink-900/10 lg:grid-cols-[1.2fr_1fr]">
        {/* ── Left branding panel ── */}
        <div className="relative hidden overflow-hidden bg-brand-900 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_45%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-100">
              {t("orgBadge")}
            </div>
            <h1 className="font-display mt-10 text-4xl font-semibold leading-tight tracking-tight">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-brand-100/80">
              {t("heroSubtitle")}
            </p>
          </div>
          <p className="relative text-sm text-brand-100/60">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
          {/* Language switcher — above the form */}
          <div className="mb-6 self-end">
            <LanguageSwitcher variant="auth" />
          </div>
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
