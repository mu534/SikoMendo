#!/usr/bin/env tsx
/**
 * scripts/generate-translations.ts
 *
 * AI-assisted Afaan Oromoo translation workflow.
 *
 * APPROACH: No paid API required. This script works with any AI assistant
 * (ChatGPT, Claude, Gemini, etc.) that you can use for free in a browser.
 *
 * ── How to use ────────────────────────────────────────────────────────────────
 *
 * STEP 1 — Generate prompts (one per namespace):
 *   npx tsx scripts/generate-translations.ts --export
 *
 *   Creates  .agents/tasks/i18n-implementation/prompts/
 *   with one .txt file per namespace (nav, auth, dashboard, employees, …).
 *   Each file contains a ready-to-paste prompt for ChatGPT / Claude.
 *
 * STEP 2 — Translate each namespace:
 *   - Open ChatGPT (chat.openai.com) or Claude (claude.ai) — both are free.
 *   - Paste the contents of each .txt prompt file.
 *   - Copy the JSON block the AI returns.
 *   - Save it as  .agents/tasks/i18n-implementation/responses/<namespace>.json
 *
 * STEP 3 — Apply the responses back to om.json:
 *   npx tsx scripts/generate-translations.ts --apply
 *
 *   Reads every .json file from the responses/ folder, validates the keys
 *   and ICU placeholders, and writes approved translations into messages/om.json.
 *   Strings that are still TODO: are left untouched.
 *
 * STEP 4 — Validate coverage:
 *   npx tsx scripts/validate-translations.ts
 *
 * ── Notes ─────────────────────────────────────────────────────────────────────
 * - Already-translated strings (not starting with "TODO: ") are never overwritten.
 * - The script preserves ICU placeholders: {variable} and {count, plural, ...}
 *   are highlighted in the prompt so the AI knows to keep them exactly.
 * - Always have a native Afaan Oromoo speaker review the output before deployment.
 */

import * as fs from "fs";
import * as path from "path";

const MESSAGES_DIR  = path.join(process.cwd(), "messages");
const EN_PATH       = path.join(MESSAGES_DIR, "en.json");
const OM_PATH       = path.join(MESSAGES_DIR, "om.json");
const PROMPTS_DIR   = path.join(process.cwd(), ".agents", "tasks", "i18n-implementation", "prompts");
const RESPONSES_DIR = path.join(process.cwd(), ".agents", "tasks", "i18n-implementation", "responses");

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectNamespaces(
  obj: unknown,
  depth = 0
): Record<string, Record<string, string>> {
  // Returns top-level namespaces as flat key→value maps.
  // Nested objects within a namespace are flattened with dot notation.
  const result: Record<string, Record<string, string>> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [ns, value] of Object.entries(obj as Record<string, unknown>)) {
      if (ns.startsWith("_")) continue; // skip _meta
      const flat: Record<string, string> = {};
      flattenLeaves(value, "", flat);
      if (Object.keys(flat).length > 0) result[ns] = flat;
    }
  }
  return result;
}

function flattenLeaves(obj: unknown, prefix: string, out: Record<string, string>): void {
  if (typeof obj === "string") {
    out[prefix] = obj;
  } else if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flattenLeaves(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

function setNestedKey(obj: Record<string, unknown>, keyPath: string, value: string): void {
  const parts = keyPath.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function extractPlaceholderNames(str: string): string[] {
  const names = new Set<string>();
  for (const m of str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) names.add(m[1]);
  for (const m of str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*plural/g)) names.add(m[1]);
  return [...names];
}

// ── --export: generate prompt files ──────────────────────────────────────────

function exportPrompts(): void {
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });

  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8")) as Record<string, unknown>;
  const om = JSON.parse(fs.readFileSync(OM_PATH, "utf8")) as Record<string, unknown>;

  const enNS = collectNamespaces(en);
  const omNS = collectNamespaces(om);

  let totalNS = 0;
  let totalStrings = 0;

  for (const [ns, enStrings] of Object.entries(enNS)) {
    // Only include strings that still need translation in om.json
    const omStrings = omNS[ns] ?? {};
    const needsTranslation: Record<string, string> = {};
    for (const [key, enVal] of Object.entries(enStrings)) {
      const omVal = omStrings[key] ?? "";
      if (omVal.startsWith("TODO: ") || omVal === "") {
        needsTranslation[key] = enVal;
      }
    }
    if (Object.keys(needsTranslation).length === 0) continue;

    // Build the prompt
    const jsonBlock = JSON.stringify(needsTranslation, null, 2);
    const placeholderWarnings: string[] = [];
    for (const [key, val] of Object.entries(needsTranslation)) {
      const phs = extractPlaceholderNames(val);
      if (phs.length > 0) {
        placeholderWarnings.push(`  "${key}" uses: ${phs.map((p) => `{${p}}`).join(", ")}`);
      }
    }

    const prompt = [
      `Translate the following JSON values from English to Afaan Oromoo (also called Oromo, Latin script).`,
      ``,
      `Rules:`,
      `1. Return ONLY a valid JSON object with the same keys as the input.`,
      `2. Do NOT translate the keys — only translate the string values.`,
      `3. Keep ALL placeholder tokens EXACTLY as they appear: {variable}, {count}, {name}, etc.`,
      `   These are code variables that will break the app if changed or removed.`,
      `4. Keep ALL ICU plural syntax EXACTLY as-is: {count, plural, one {# item} other {# items}}`,
      `   Only translate the human-readable words inside (e.g. "item" → "wantoota").`,
      `5. Use natural, everyday Afaan Oromoo — not overly formal or literal.`,
      `6. This is a Human Resource management system used in Ethiopia. Use appropriate HR terminology.`,
      ``,
      ...(placeholderWarnings.length > 0
        ? [
            `⚠️  These keys contain placeholders that MUST be preserved exactly:`,
            ...placeholderWarnings,
            ``,
          ]
        : []),
      `Namespace: ${ns}`,
      `Strings to translate (${Object.keys(needsTranslation).length} total):`,
      ``,
      `\`\`\`json`,
      jsonBlock,
      `\`\`\``,
      ``,
      `Return ONLY the translated JSON object, no explanation.`,
    ].join("\n");

    const outFile = path.join(PROMPTS_DIR, `${ns}.txt`);
    fs.writeFileSync(outFile, prompt, "utf8");
    totalNS++;
    totalStrings += Object.keys(needsTranslation).length;
  }

  console.log(`\n✅ Exported ${totalNS} prompt files (${totalStrings} strings total)`);
  console.log(`   Prompt files: ${PROMPTS_DIR}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Open each .txt file in ${PROMPTS_DIR}`);
  console.log(`  2. Paste the contents into ChatGPT (chat.openai.com) or Claude (claude.ai)`);
  console.log(`  3. Copy the JSON response and save it as:`);
  console.log(`     ${RESPONSES_DIR}/<namespace>.json`);
  console.log(`  4. Run: npx tsx scripts/generate-translations.ts --apply`);
}

// ── --apply: apply AI responses to om.json ───────────────────────────────────

function applyResponses(): void {
  if (!fs.existsSync(RESPONSES_DIR)) {
    console.error(`❌ Responses directory not found: ${RESPONSES_DIR}`);
    console.error(`   Run --export first, translate the prompts, then save responses there.`);
    process.exit(1);
  }

  const responseFiles = fs.readdirSync(RESPONSES_DIR).filter((f) => f.endsWith(".json"));
  if (responseFiles.length === 0) {
    console.error(`❌ No .json files found in ${RESPONSES_DIR}`);
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8")) as Record<string, unknown>;
  const om = JSON.parse(fs.readFileSync(OM_PATH, "utf8")) as Record<string, unknown>;
  const enNS = collectNamespaces(en);

  let applied = 0;
  let skipped = 0;
  let broken = 0;

  for (const file of responseFiles) {
    const ns = path.basename(file, ".json");
    const filePath = path.join(RESPONSES_DIR, file);

    let response: Record<string, string>;
    try {
      response = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
    } catch {
      console.warn(`  ⚠️  Skipping ${file} — invalid JSON`);
      continue;
    }

    const enStrings = enNS[ns] ?? {};

    for (const [flatKey, omVal] of Object.entries(response)) {
      if (typeof omVal !== "string") continue;

      // Validate placeholder parity
      const enVal = enStrings[flatKey] ?? "";
      const enPH = extractPlaceholderNames(enVal);
      const omPH = extractPlaceholderNames(omVal);
      const missingPH = enPH.filter((p) => !omPH.includes(p));

      if (missingPH.length > 0) {
        console.warn(`  ⚠️  ${ns}.${flatKey}: missing placeholders {${missingPH.join("}, {")}} — skipping`);
        broken++;
        continue;
      }

      // Only write if the key currently has a TODO: value (don't overwrite reviewed strings)
      const fullKey = `${ns}.${flatKey}`;
      const omNS = collectNamespaces(om);
      const currentVal = (omNS[ns] ?? {})[flatKey] ?? "";
      if (!currentVal.startsWith("TODO: ") && currentVal !== "") {
        skipped++;
        continue;
      }

      setNestedKey(om, fullKey, omVal);
      applied++;
    }

    console.log(`  ✅ ${ns} — ${Object.keys(response).length} strings processed`);
  }

  // Update metadata
  (om as Record<string, unknown>)["_meta"] = {
    status: "draft",
    lastGenerated: new Date().toISOString(),
  };

  fs.writeFileSync(OM_PATH, JSON.stringify(om, null, 2), "utf8");

  console.log(`\n📊 Summary:`);
  console.log(`   Applied  : ${applied}`);
  console.log(`   Skipped  : ${skipped} (already translated)`);
  console.log(`   Rejected : ${broken} (broken placeholders — fix manually)`);
  console.log(`\n⚠️  All translations are AI-generated drafts.`);
  console.log(`   Have a native Afaan Oromoo speaker review messages/om.json`);
  console.log(`   before deploying to production.\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const arg = process.argv[2];

if (arg === "--export") {
  exportPrompts();
} else if (arg === "--apply") {
  applyResponses();
} else {
  console.log(`
Usage:
  npx tsx scripts/generate-translations.ts --export   Generate prompt files for AI translation
  npx tsx scripts/generate-translations.ts --apply    Apply AI responses to messages/om.json

See the file header for the full workflow.
`);
  process.exit(0);
}
