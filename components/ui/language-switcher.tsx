"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { setLocale } from "@/lib/locale-actions";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "om", label: "Afaan Oromoo" },
] as const;

type LocaleCode = (typeof LOCALES)[number]["code"];

/**
 * Language selector dropdown.
 *
 * Renders as a compact trigger (globe icon + current language name + chevron)
 * that opens a dropdown with both language options. Works identically in the
 * authenticated header and the unauthenticated login page.
 *
 * The `variant` prop controls visual treatment:
 *   "header"  — sits on a white header bar (default)
 *   "auth"    — sits on the white right panel of the auth card
 */
export function LanguageSwitcher({
  variant = "header",
}: {
  variant?: "header" | "auth";
}) {
  const t = useTranslations("languageSwitcher");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLabel =
    LOCALES.find((l) => l.code === currentLocale)?.label ?? "English";

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleSelect(code: LocaleCode) {
    if (code === currentLocale) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      await setLocale(code);
      router.replace(pathname, { locale: code });
    });
  }

  // ── Trigger styles ──────────────────────────────────────────────────────────
  const triggerBase =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-wait select-none";

  const triggerVariant =
    variant === "auth"
      ? "border border-ink-900/12 bg-white text-ink-900/70 hover:bg-sand-100 hover:text-ink-900"
      : "text-ink-900/60 hover:bg-sand-100 hover:text-ink-900";

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("label")}
        className={cn(triggerBase, triggerVariant)}
      >
        <Globe
          className="h-3.5 w-3.5 shrink-0 text-brand-600"
          aria-hidden="true"
        />
        {/* Full name on sm+, hidden on xs to save header space */}
        <span className="hidden sm:inline">{currentLabel}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-ink-900/40 transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <>
          {/* Invisible backdrop to close on outside click */}
          <button
            type="button"
            aria-label="Close language selector"
            className="fixed inset-0 z-30 cursor-default"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />

          <div
            role="listbox"
            aria-label={t("label")}
            aria-activedescendant={`lang-opt-${currentLocale}`}
            className={cn(
              // position: open to the right on auth panel, right-aligned in header
              variant === "auth" ? "left-0" : "right-0",
              "absolute top-full z-40 mt-1.5 w-44 origin-top-right rounded-xl border border-ink-900/8 bg-white py-1 shadow-lg shadow-ink-900/8",
              "animate-in fade-in-0 zoom-in-95 duration-100"
            )}
          >
            {LOCALES.map(({ code, label }) => {
              const isActive = code === currentLocale;
              return (
                <button
                  key={code}
                  id={`lang-opt-${code}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(code)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:bg-sand-100",
                    isActive
                      ? "font-medium text-ink-900"
                      : "font-normal text-ink-900/70 hover:bg-sand-100 hover:text-ink-900"
                  )}
                >
                  {/* Checkmark column — keeps labels aligned */}
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {isActive && (
                      <Check
                        className="h-3.5 w-3.5 text-brand-600"
                        aria-hidden="true"
                        strokeWidth={2.5}
                      />
                    )}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
