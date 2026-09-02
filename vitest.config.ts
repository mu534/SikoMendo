import { defineConfig } from "vitest/config";
import path from "node:path";

// Pure-logic unit tests only — no database, no Next.js server runtime.
// See TESTING.md for what's covered and what isn't.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
