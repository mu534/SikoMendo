/**
 * Regression test: locale resolution in i18n/request.ts
 *
 * Verifies that the request config returns the correct locale and messages
 * given the value of requestLocale (which in production is set by
 * next-intl/middleware via the X-NEXT-INTL-LOCALE header).
 */
import { describe, it, expect } from "vitest";

// ── Minimal fixtures ─────────────────────────────────────────────────────────

const LOCALES = ["en", "om"] as const;
const DEFAULT_LOCALE = "en";

/**
 * Mirrors the locale-resolution logic in i18n/request.ts so we can test it
 * in isolation without Next.js / next-intl internals.
 */
function resolveLocale(requestLocale: string | undefined): "en" | "om" {
  if (!requestLocale || !LOCALES.includes(requestLocale as (typeof LOCALES)[number])) {
    return DEFAULT_LOCALE;
  }
  return requestLocale as "en" | "om";
}

/**
 * Mirrors the applyFallbacks logic in i18n/request.ts.
 * Replaces "TODO: …" values in target with the corresponding English fallback.
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe("resolveLocale", () => {
  it("returns 'en' when requestLocale is undefined", () => {
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("returns 'en' when requestLocale is an unknown locale", () => {
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale("")).toBe("en");
    expect(resolveLocale("EN")).toBe("en"); // case-sensitive
  });

  it("returns 'en' when requestLocale is 'en'", () => {
    expect(resolveLocale("en")).toBe("en");
  });

  it("returns 'om' when requestLocale is 'om'", () => {
    expect(resolveLocale("om")).toBe("om");
  });
});

describe("applyFallbacks", () => {
  it("replaces TODO values with English fallbacks", () => {
    const om = { greeting: "TODO: Hello" };
    const en = { greeting: "Hello" };
    applyFallbacks(om, en);
    expect(om.greeting).toBe("Hello");
  });

  it("keeps translated values intact", () => {
    const om = { greeting: "Akkam" };
    const en = { greeting: "Hello" };
    applyFallbacks(om, en);
    expect(om.greeting).toBe("Akkam");
  });

  it("recurses into nested objects", () => {
    const om = { common: { save: "TODO: Save", cancel: "Haqi" } };
    const en = { common: { save: "Save", cancel: "Cancel" } };
    applyFallbacks(om, en);
    expect((om.common as Record<string, string>).save).toBe("Save");
    expect((om.common as Record<string, string>).cancel).toBe("Haqi");
  });

  it("does not apply fallback when fallback key is missing", () => {
    const om = { extra: "TODO: Something" } as Record<string, unknown>;
    const en = {} as Record<string, unknown>;
    applyFallbacks(om, en);
    expect(om.extra).toBe("TODO: Something");
  });
});

describe("message file sanity check", () => {
  it("om.json has Afaan Oromoo translations for common keys", async () => {
    // Import the actual message files to verify they load and differ from English
    const omMessages = (await import("../messages/om.json")).default as Record<string, unknown>;
    const enMessages = (await import("../messages/en.json")).default as Record<string, unknown>;

    // Both files must exist and have the common namespace
    expect(omMessages).toBeTruthy();
    expect(enMessages).toBeTruthy();

    const omCommon = omMessages.common as Record<string, string>;
    const enCommon = enMessages.common as Record<string, string>;

    expect(omCommon).toBeTruthy();
    expect(enCommon).toBeTruthy();

    // om.json "save" should differ from English "Save"
    expect(omCommon.save).not.toBe(enCommon.save);
    // Sanity check the known Oromoo translation
    expect(omCommon.save).toBe("Olkaa'i");
  });

  it("resolving 'om' uses om.json (not English)", async () => {
    const locale = resolveLocale("om");
    expect(locale).toBe("om");
    const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
    const common = messages.common as Record<string, string>;
    // Would be "Save" if English was loaded instead
    expect(common.save).toBe("Olkaa'i");
  });

  it("resolving 'en' uses en.json", async () => {
    const locale = resolveLocale("en");
    expect(locale).toBe("en");
    const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
    const common = messages.common as Record<string, string>;
    expect(common.save).toBe("Save");
  });
});
