import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { runAbsenceDetection } from "@/lib/attendance-jobs";
import { getOrgLocalDateString } from "@/lib/attendance-date";

/**
 * POST /api/attendance/jobs/detect
 * GET  /api/attendance/jobs/detect  (Vercel Cron alias — Vercel sends GET)
 *
 * Stage-1 absence detection for the given date (defaults to today in EAT).
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
 *       { "path": "/api/attendance/jobs/detect", "schedule": "0 7 * * 1-5" }
 *     ]
 *   }
 *   (0 7 UTC = 10:00 EAT — matches the default absenceDetectionTime of 10:00)
 *
 * Railway / external cron:
 *   curl -X POST https://your-domain/api/attendance/jobs/detect \
 *        -H "Authorization: Bearer $ATTENDANCE_JOB_SECRET" \
 *        -H "Content-Type: application/json"
 *
 * Optional body: { "date": "YYYY-MM-DD" } — omit to use today's EAT date.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────
 * Running this route multiple times on the same date is safe: the job uses
 * createMany with skipDuplicates and the @@unique([employeeId, date]) DB
 * constraint ensures no duplicate absence records are created.
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
    const result = await runAbsenceDetection(date);
    return NextResponse.json({ ok: true, date, result });
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
