import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "om"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
export const LOCALES = routing.locales;
export const DEFAULT_LOCALE: Locale = routing.defaultLocale;
