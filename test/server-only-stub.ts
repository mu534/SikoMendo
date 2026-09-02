// "server-only" is a Next.js build-time guard: it throws when a module that
// imports it gets bundled into client-side code. It only matters inside
// Next's webpack build — in plain Node (which is what Vitest runs under),
// there's nothing to guard against, so this stub replaces it for tests via
// the alias in vitest.config.ts.
export {};
