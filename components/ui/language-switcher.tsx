"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { setLocale } from "@/lib/locale-actions";
import { useTransition } from "react";

const LOCALES = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "om", label: "Afaan Oromoo", shortLabel: "OM" },
] as const;

type LocaleCode = (typeof LOCALES)[number]["code"];

/**
 * Language switcher button group.
 *
 * compact=true  → shows short labels (EN / OM), suitable for the header
 * compact=false → shows full labels (English / Afaan Oromoo), for the login page
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("languageSwitcher");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSwitch(newLocale: LocaleCode) {
    if (newLocale === currentLocale) return;
    startTransition(async () => {
      await setLocale(newLocale);
      // Navigate to the same page in the new locale
      router.replace(pathname, { locale: newLocale });
    });
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-ink-900/10 bg-white p-0.5"
      role="group"
      aria-label={t("label")}
    >
      {LOCALES.map(({ code, label, shortLabel }) => {
        const isActive = code === currentLocale;
        return (
          <button
            key={code}
            type="button"
            disabled={isPending}
            onClick={() => handleSwitch(code)}
            aria-label={t("switchTo", { language: label })}
            aria-pressed={isActive}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
              isActive
                ? "bg-brand-600 text-white shadow-sm"
                : "text-ink-900/60 hover:text-ink-900 hover:bg-sand-100",
              isPending ? "opacity-50 cursor-wait" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {compact ? shortLabel : label}
          </button>
        );
      })}
    </div>
  );
}
