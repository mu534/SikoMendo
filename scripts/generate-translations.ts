#!/usr/bin/env tsx
/**
 * scripts/generate-translations.ts
 *
 * Generates draft Afaan Oromoo (om) translations from messages/en.json
 * using the Google Cloud Translation API v2.
 *
 * Usage:
 *   GOOGLE_CLOUD_API_KEY=your_key npx tsx scripts/generate-translations.ts
 *
 * If GOOGLE_CLOUD_API_KEY is not set, the script exits 0 with a warning
 * (graceful no-op so CI/CD pipelines do not fail).
 *
 * ICU placeholder preservation:
 *   {variable} tokens and {count, plural, ...} blocks are replaced with
 *   numbered sentinels (e.g. __PH_0__) before translation and restored
 *   after, so the API cannot corrupt interpolation syntax.
 */

import * as fs from "fs";
import * as path from "path";

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const EN_PATH  = path.join(MESSAGES_DIR, "en.json");
const OM_PATH  = path.join(MESSAGES_DIR, "om.json");
const API_KEY  = process.env.GOOGLE_CLOUD_API_KEY;
const BATCH    = 100; // strings per API request

// ── Graceful no-op when key is absent ────────────────────────────────────────

if (!API_KEY) {
  console.warn(
    "\n⚠️  GOOGLE_CLOUD_API_KEY is not set — skipping translation generation.\n" +
    "   Set the env var and re-run to populate messages/om.json with machine\n" +
    "   translations. See .env.example for instructions.\n"
  );
  process.exit(0);
}

// ── Placeholder helpers ───────────────────────────────────────────────────────

/** Extract ICU placeholders from a string, replace with sentinels. */
function extractPlaceholders(str: string): { sanitized: string; placeholders: string[] } {
  const placeholders: string[] = [];
  // Match {count, plural, ...} blocks (multi-word ICU expressions) first
  let sanitized = str.replace(/\{[^}]+,[^}]+\}/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `__PH_${idx}__`;
  });
  // Then simple {variable} tokens
  sanitized = sanitized.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `__PH_${idx}__`;
  });
  return { sanitized, placeholders };
}

/** Restore placeholders into a translated string. */
function restorePlaceholders(translated: string, placeholders: string[]): string {
  return translated.replace(/__PH_(\d+)__/g, (_, idx) => placeholders[parseInt(idx)] ?? `__PH_${idx}__`);
}

// ── Collect translatable strings ──────────────────────────────────────────────

type StringMap = Map<string, string>;

function collectStrings(obj: unknown, prefix: string, out: StringMap): void {
  if (typeof obj === "string") {
    // Skip metadata and already-translated strings (not starting with TODO:)
    if (!prefix.startsWith("_meta") && obj.startsWith("TODO: ")) {
      out.set(prefix, obj.slice(6)); // strip the "TODO: " prefix to get the English source
    }
  } else if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      collectStrings(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

/** Set a deeply-nested key in an object using dot notation. */
function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: string): void {
  const parts = keyPath.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Google Translate API ──────────────────────────────────────────────────────

async function translateBatch(texts: string[]): Promise<string[]> {
  const body = JSON.stringify({ q: texts, source: "en", target: "om", format: "text" });
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Translate API error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as {
    data: { translations: Array<{ translatedText: string }> };
  };
  return data.data.translations.map((t) => t.translatedText);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8")) as Record<string, unknown>;
  const om = JSON.parse(fs.readFileSync(OM_PATH, "utf8")) as Record<string, unknown>;

  // Collect all strings that still need translation
  const toTranslate: StringMap = new Map();
  collectStrings(om, "", toTranslate);

  if (toTranslate.size === 0) {
    console.log("✅ All strings already translated — nothing to do.");
    process.exit(0);
  }

  console.log(`🔄 Translating ${toTranslate.size} strings to Afaan Oromoo (om)…`);

  const keys = Array.from(toTranslate.keys());
  const sources = Array.from(toTranslate.values());

  // Sanitize placeholders before sending
  const sanitizedSources = sources.map((s) => extractPlaceholders(s).sanitized);
  const placeholderMaps  = sources.map((s) => extractPlaceholders(s).placeholders);

  let translated = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < keys.length; i += BATCH) {
    const batchKeys    = keys.slice(i, i + BATCH);
    const batchTexts   = sanitizedSources.slice(i, i + BATCH);
    const batchPHMaps  = placeholderMaps.slice(i, i + BATCH);

    try {
      const results = await translateBatch(batchTexts);
      for (let j = 0; j < batchKeys.length; j++) {
        const restored = restorePlaceholders(results[j], batchPHMaps[j]);
        setNestedKey(om, batchKeys[j + i] ?? batchKeys[j], restored);
        translated++;
      }
      process.stdout.write(`  ${Math.min(i + BATCH, keys.length)}/${keys.length}\r`);
    } catch (err) {
      console.error(`\n❌ Batch ${Math.floor(i / BATCH) + 1} failed:`, err);
      errors += batchKeys.length;
    }
  }

  // Update metadata
  (om as Record<string, unknown>)["_meta"] = {
    status: "draft",
    lastGenerated: new Date().toISOString(),
  };

  fs.writeFileSync(OM_PATH, JSON.stringify(om, null, 2), "utf8");

  console.log(
    `\n✅ Done: ${translated} translated, ${errors} errors.\n` +
    `   ⚠️  All translations are machine-generated drafts.\n` +
    `   A native Afaan Oromoo speaker must review messages/om.json\n` +
    `   before deploying the Afaan Oromoo locale to production.\n`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
