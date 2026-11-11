/**
 * Development-only scheduler for attendance jobs.
 *
 * Replicates the Vercel Cron behaviour locally:
 *   - Runs absence detection every 60 seconds
 *   - Runs absence finalization once at startup (then again on a 1-hour check)
 *
 * This module must only be imported from instrumentation.ts inside the
 * `!process.env.VERCEL` guard. It is never bundled for the client.
 *
 * Uses the same runAbsenceDetection / runAbsenceFinalization functions that
 * the production HTTP route handlers call, so behaviour is identical.
 */

import "server-only";

let started = false;

export function startDevScheduler() {
  // Guard against double-registration (Next.js hot-reload can call register()
  // more than once in dev mode).
  if (started) return;
  started = true;

  console.log("[dev-scheduler] Starting local attendance job scheduler.");

  // Run detection every 60 seconds — mirrors the `* * * * *` Vercel Cron.
  setInterval(() => {
    runDetection().catch((err) => {
      console.error("[dev-scheduler] Detection error:", err);
    });
  }, 60_000);

  // Run finalization once an hour (the Vercel Cron runs it once a day at 16:00
  // UTC; in dev a 1-hour check is good enough for testing).
  setInterval(() => {
    runFinalization().catch((err) => {
      console.error("[dev-scheduler] Finalization error:", err);
    });
  }, 60 * 60_000);

  // Also kick off detection immediately so you don't have to wait 60s after
  // restarting the dev server.
  runDetection().catch((err) => {
    console.error("[dev-scheduler] Initial detection error:", err);
  });
}

async function runDetection() {
  // Dynamic imports so this module is never evaluated at build time.
  const { runAbsenceDetection } = await import("@/lib/attendance-jobs");
  const { getAttendancePolicy } = await import("@/features/attendance/policy-queries");
  const { getOrgLocalDateString } = await import("@/lib/attendance-date");
  const { detectionThresholdMinutes, utcDateToOrgMinutesSinceMidnight, isWorkingDay } =
    await import("@/lib/attendance-policy");

  const policy  = await getAttendancePolicy();
  const today   = getOrgLocalDateString();
  const nowMin  = utcDateToOrgMinutesSinceMidnight(new Date());

  if (!isWorkingDay(today, policy)) return;

  const morningThreshold   = detectionThresholdMinutes(policy, "MORNING");
  const afternoonThreshold = detectionThresholdMinutes(policy, "AFTERNOON");

  if (nowMin >= morningThreshold) {
    await runAbsenceDetection(today, "MORNING");
  }
  if (nowMin >= afternoonThreshold) {
    await runAbsenceDetection(today, "AFTERNOON");
  }
}

async function runFinalization() {
  const { runAbsenceFinalization } = await import("@/lib/attendance-jobs");
  const { getOrgLocalDateString }  = await import("@/lib/attendance-date");
  await runAbsenceFinalization(getOrgLocalDateString());
}
