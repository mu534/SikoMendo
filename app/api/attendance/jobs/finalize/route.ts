import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { runAbsenceFinalization } from "@/lib/attendance-jobs";
import { getOrgLocalDateString } from "@/lib/attendance-date";

/**
 * POST /api/attendance/jobs/finalize
 * GET  /api/attendance/jobs/finalize  (Vercel Cron alias — Vercel sends GET)
 *
 * Stage-2 absence finalization for the given date (defaults to today in EAT).
 * Secured with ATTENDANCE_JOB_SECRET bearer token — NOT a user session.
 *
 * ── Deployment ────────────────────────────────────────────────────────────
 *
 * Set ATTENDANCE_JOB_SECRET in your environment (min 32 chars):
 *   openssl rand -hex 32
 *
 * Vercel Cron — add to vercel.json (Vercel injects Authorization automatically):
 *   {
 *     "crons": [
 *       { "path": "/api/attendance/jobs/finalize", "schedule": "0 14 * * 1-5" }
 *     ]
 *   }
 *   (0 14 UTC = 17:00 EAT — matches the default workEndTime of 17:00)
 *
 * Railway / external cron:
 *   curl -X POST https://your-domain/api/attendance/jobs/finalize \
 *        -H "Authorization: Bearer $ATTENDANCE_JOB_SECRET" \
 *        -H "Content-Type: application/json"
 *
 * Optional body: { "date": "YYYY-MM-DD" } — omit to use today's EAT date.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────
 * Running this route multiple times on the same date is safe: finalization only
 * targets autoRecorded=true rows with checkIn=null and appends audit log entries
 * without overwriting any existing records.
 */

async function handler(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.ATTENDANCE_JOB_SECRET;
  if (!secret) {
    console.error("[jobs/finalize] ATTENDANCE_JOB_SECRET env var is not set.");
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
  let date: string;
  try {
    const body = await req.json().catch(() => ({}));
    date =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : getOrgLocalDateString();
  } catch {
    date = getOrgLocalDateString();
  }

  // ── Run job ──────────────────────────────────────────────────────────────
  try {
    const result = await runAbsenceFinalization(date);
    return NextResponse.json({ ok: true, date, result });
  } catch (err) {
    console.error("[jobs/finalize] Absence finalization failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Vercel Cron sends GET requests; all other callers use POST.
export const GET = handler;
export const POST = handler;
