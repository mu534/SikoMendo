import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { runAbsenceDetection } from "@/lib/attendance-jobs";
import { getOrgLocalDateString } from "@/lib/attendance-date";
import { getAttendancePolicy } from "@/features/attendance/policy-queries";
import { utcDateToOrgMinutesSinceMidnight, isWorkingDay, detectionThresholdMinutes } from "@/lib/attendance-policy";

/**
 * POST /api/attendance/jobs/detect
 * GET  /api/attendance/jobs/detect  (Vercel Cron — Vercel sends GET)
 *
 * Tick-based absence detection for morning and/or afternoon sessions.
 * This route is invoked on a short cadence (e.g. every minute via Vercel Cron)
 * and decides which session(s) to run based on the current EAT time vs the
 * configured policy deadlines. The detection logic contains no hardcoded session
 * times — only the cron *cadence* is static.
 *
 * Live (today): loads the policy, computes nowMin (EAT minutes since midnight),
 * and runs detection for each session whose deadline has passed on a working day.
 * Each call is idempotent — subsequent ticks after a session's deadline are no-ops.
 *
 * Backfill (a past/future date in body): when body.date is provided and differs
 * from today's EAT date, bypass the nowMin gate and run BOTH sessions (idempotent).
 * This allows manual back-filling without the wall-clock gate silently zeroing it out.
 *
 * ── Deployment ────────────────────────────────────────────────────────────
 *
 * Set ATTENDANCE_JOB_SECRET in your environment (min 32 chars):
 *   openssl rand -hex 32
 *
 * Set CRON_SECRET to the same value as ATTENDANCE_JOB_SECRET so Vercel injects
 * the Authorization header automatically for cron-invoked routes.
 *
 * vercel.json cron entry:
 *   { "path": "/api/attendance/jobs/detect", "schedule": "* * * * *" }
 *   (* * * * * = every minute — accurate to the configured deadline;
 *    on Vercel Hobby plan use "* /5 * * * *" (every 5 min) or coarser to
 *    stay within the daily execution cap — correctness is unaffected by cadence)
 *
 * ── Idempotency ───────────────────────────────────────────────────────────
 * Running this route multiple times on the same date/session is safe: the job
 * uses createMany with skipDuplicates and the @@unique([employeeId, date, session])
 * DB constraint ensures no duplicate absence records are created.
 */

async function handler(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.ATTENDANCE_JOB_SECRET;
  if (!secret) {
    console.error("[jobs/detect] ATTENDANCE_JOB_SECRET env var is not set.");
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: job secret not set." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ── Date resolution ──────────────────────────────────────────────────────
  let bodyDate: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      bodyDate = body.date;
    }
  } catch {
    // ignore parse errors
  }

  const todayEAT = getOrgLocalDateString();
  const targetDate = bodyDate ?? todayEAT;
  const isBackfill = bodyDate !== null && bodyDate !== todayEAT;

  // ── Run job ──────────────────────────────────────────────────────────────
  try {
    if (isBackfill) {
      // Backfill: bypass the wall-clock gate — run both sessions unconditionally.
      const [morning, afternoon] = await Promise.all([
        runAbsenceDetection(targetDate, "MORNING"),
        runAbsenceDetection(targetDate, "AFTERNOON"),
      ]);
      return NextResponse.json({ ok: true, date: targetDate, morning, afternoon });
    }

    // Live (today): load policy and decide which sessions have passed their
    // detection threshold (deadline + graceMinutes).
    const policy = await getAttendancePolicy();
    const nowMs  = Date.now();
    const nowMin = utcDateToOrgMinutesSinceMidnight(new Date(nowMs));

    if (!isWorkingDay(targetDate, policy)) {
      console.log(`[jobs/detect] ${targetDate} is not a working day — skipping.`);
      return NextResponse.json({
        ok: true,
        date: targetDate,
        skippedNonWorkingDay: true,
      });
    }

    // Detection fires at deadline + graceMinutes so employees in the grace window
    // are not wrongly auto-marked absent before they have a chance to check in.
    const morningThreshold   = detectionThresholdMinutes(policy, "MORNING");
    const afternoonThreshold = detectionThresholdMinutes(policy, "AFTERNOON");

    const results: Record<string, unknown> = {};

    if (nowMin >= morningThreshold) {
      results.morning = await runAbsenceDetection(targetDate, "MORNING");
    }
    if (nowMin >= afternoonThreshold) {
      results.afternoon = await runAbsenceDetection(targetDate, "AFTERNOON");
    }

    return NextResponse.json({ ok: true, date: targetDate, ...results });
  } catch (err) {
    console.error("[jobs/detect] Absence detection failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Vercel Cron sends GET requests; all other callers use POST.
export const GET = handler;
export const POST = handler;
