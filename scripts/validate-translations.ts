#!/usr/bin/env tsx
/**
 * scripts/validate-translations.ts
 *
 * Validates that messages/om.json has the same key structure as messages/en.json
 * and checks for broken ICU placeholders in translated strings.
 *
 * Exit codes:
 *   0 — structure matches (TODO: entries are acceptable, they fall back at runtime)
 *   1 — structural mismatch (missing or extra keys)
 */

import * as fs from "fs";
import * as path from "path";

const EN_PATH = path.join(process.cwd(), "messages", "en.json");
const OM_PATH = path.join(process.cwd(), "messages", "om.json");

type Report = {
  missing: string[];
  extra: string[];
  todoCount: number;
  brokenPlaceholders: string[];
  total: number;
  translated: number;
};

// ── Key collection ────────────────────────────────────────────────────────────

function collectLeafKeys(obj: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof obj === "string") {
    if (!prefix.startsWith("_meta")) out.set(prefix, obj);
  } else if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      collectLeafKeys(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

// ── Placeholder extraction ────────────────────────────────────────────────────

function extractPlaceholderNames(str: string): Set<string> {
  const names = new Set<string>();
  // Simple {variable} tokens
  for (const m of str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) {
    names.add(m[1]);
  }
  // ICU plural first argument: {count, plural, ...} → extract "count"
  for (const m of str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*plural/g)) {
    names.add(m[1]);
  }
  return names;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function validate(): Report {
  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8")) as unknown;
  const om = JSON.parse(fs.readFileSync(OM_PATH, "utf8")) as unknown;

  const enKeys = new Map<string, string>();
  const omKeys = new Map<string, string>();
  collectLeafKeys(en, "", enKeys);
  collectLeafKeys(om, "", omKeys);

  const missing = [...enKeys.keys()].filter((k) => !omKeys.has(k));
  const extra   = [...omKeys.keys()].filter((k) => !enKeys.has(k));

  let todoCount = 0;
  let translated = 0;
  const brokenPlaceholders: string[] = [];

  for (const [key, enValue] of enKeys) {
    const omValue = omKeys.get(key);
    if (!omValue) continue;

    if (omValue.startsWith("TODO: ")) {
      todoCount++;
    } else {
      translated++;
      // Check placeholder parity
      const enPH = extractPlaceholderNames(enValue);
      const omPH = extractPlaceholderNames(omValue);
      for (const ph of enPH) {
        if (!omPH.has(ph)) {
          brokenPlaceholders.push(`${key}: missing {${ph}} in om translation`);
        }
      }
    }
  }

  return {
    missing,
    extra,
    todoCount,
    brokenPlaceholders,
    total: enKeys.size,
    translated,
  };
}

const report = validate();

// ── Output ────────────────────────────────────────────────────────────────────

const pct = report.total > 0
  ? Math.round((report.translated / report.total) * 100)
  : 0;

console.log("\n📊 Translation Coverage Report");
console.log(`   Total keys    : ${report.total}`);
console.log(`   Translated    : ${report.translated} (${pct}%)`);
console.log(`   Untranslated  : ${report.todoCount} (TODO: placeholders — fall back to English)`);

let hasErrors = false;

if (report.missing.length > 0) {
  hasErrors = true;
  console.log(`\n❌ Missing keys in om.json (${report.missing.length}):`);
  report.missing.slice(0, 20).forEach((k) => console.log(`   - ${k}`));
  if (report.missing.length > 20) console.log(`   … and ${report.missing.length - 20} more`);
}

if (report.extra.length > 0) {
  console.log(`\n⚠️  Extra keys in om.json not in en.json (${report.extra.length}):`);
  report.extra.slice(0, 10).forEach((k) => console.log(`   - ${k}`));
}

if (report.brokenPlaceholders.length > 0) {
  hasErrors = true;
  console.log(`\n❌ Broken ICU placeholders (${report.brokenPlaceholders.length}):`);
  report.brokenPlaceholders.slice(0, 20).forEach((m) => console.log(`   - ${m}`));
}

if (!hasErrors) {
  console.log("\n✅ Structure matches — no missing keys or broken placeholders.\n");
  process.exit(0);
} else {
  console.log("\n❌ Validation failed — fix missing keys or broken placeholders.\n");
  process.exit(1);
}
