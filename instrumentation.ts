/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * In DEVELOPMENT: starts a 1-minute interval that replicates the Vercel Cron
 * behaviour for the absence detection job. This means auto-absent records are
 * created locally without needing to manually trigger the endpoint.
 *
 * In PRODUCTION: Vercel Cron calls /api/attendance/jobs/detect every minute,
 * so this block is skipped entirely (VERCEL env var is set by Vercel).
 *
 * The interval calls the detection logic directly (no HTTP round-trip) so it
 * works even before the HTTP server is fully ready.
 */
export async function register() {
  // Only run the in-process scheduler in Node.js runtime (not edge) and
  // only when not on Vercel (Vercel Cron handles production).
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    !process.env.VERCEL
  ) {
    // Lazy-import to avoid bundling server-only modules into the edge runtime.
    const { startDevScheduler } = await import("./lib/dev-scheduler");
    startDevScheduler();
  }
}
