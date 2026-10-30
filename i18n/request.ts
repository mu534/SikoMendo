import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is provided by next-intl when used with app/[lang]/
  let locale = await requestLocale;

  // Fallback to default if locale is undefined or not supported
  if (!locale || !routing.locales.includes(locale as "en" | "om")) {
    locale = routing.defaultLocale;
  }

  // Load the messages for the requested locale
  const messages = (
    await import(`../messages/${locale}.json`)
  ).default as Record<string, unknown>;

  // For the Afaan Oromoo locale, fall back to English for any value that
  // starts with "TODO: " (untranslated placeholder) so users never see
  // placeholder text in production.
  if (locale === "om") {
    const enMessages = (
      await import("../messages/en.json")
    ).default as Record<string, unknown>;
    applyFallbacks(messages, enMessages);
  }

  return {
    locale,
    messages,
  };
});

/**
 * Recursively replace any string value starting with "TODO: " in the target
 * object with the corresponding value from the fallback (English) object.
 */
function applyFallbacks(
  target: Record<string, unknown>,
  fallback: Record<string, unknown>
): void {
  for (const key of Object.keys(target)) {
    const tv = target[key];
    const fv = fallback[key];

    if (typeof tv === "string" && tv.startsWith("TODO: ") && typeof fv === "string") {
      target[key] = fv;
    } else if (
      tv !== null &&
      typeof tv === "object" &&
      !Array.isArray(tv) &&
      fv !== null &&
      typeof fv === "object" &&
      !Array.isArray(fv)
    ) {
      applyFallbacks(
        tv as Record<string, unknown>,
        fv as Record<string, unknown>
      );
    }
  }
}
