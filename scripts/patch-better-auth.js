/**
 * Removes the "dev-source" export condition from better-auth and its sub-packages.
 *
 * better-auth ships a custom "dev-source" condition that points to raw TypeScript
 * source files. Turbopack resolves this condition in development and tries to
 * compile the entire better-auth source tree, which causes an infinite compile hang.
 * Removing the condition forces Turbopack to fall through to the "default" (dist) entry.
 *
 * This script runs automatically via the "postinstall" npm hook so it re-applies
 * after every `npm install`.
 */

const fs = require("fs");
const path = require("path");

const packages = [
  "better-auth",
  "@better-auth/core",
  "@better-auth/utils",
  "@better-auth/prisma-adapter",
  "@better-auth/drizzle-adapter",
  "@better-auth/kysely-adapter",
  "@better-auth/memory-adapter",
  "@better-auth/mongo-adapter",
];

let totalRemoved = 0;

for (const pkg of packages) {
  const pkgPath = path.join(__dirname, "..", "node_modules", pkg, "package.json");
  if (!fs.existsSync(pkgPath)) continue;

  const original = fs.readFileSync(pkgPath, "utf8");
  const json = JSON.parse(original);
  let changed = 0;

  if (json.exports && typeof json.exports === "object") {
    for (const key of Object.keys(json.exports)) {
      const entry = json.exports[key];
      if (entry && typeof entry === "object" && "dev-source" in entry) {
        delete entry["dev-source"];
        changed++;
      }
    }
  }

  if (changed > 0) {
    fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + "\n");
    console.log(`  patched ${pkg}: removed ${changed} dev-source entries`);
    totalRemoved += changed;
  }
}

if (totalRemoved > 0) {
  console.log(`patch-better-auth: removed ${totalRemoved} dev-source entries total`);
} else {
  console.log("patch-better-auth: nothing to patch");
}
