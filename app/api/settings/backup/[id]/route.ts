import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getSignedFileUrl } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";

/**
 * GET /api/settings/backup/[id]
 *
 * Fetches the backup file from Cloudinary and proxies it to the browser
 * with explicit Content-Type and Content-Disposition headers so it downloads
 * as a readable JSON file rather than binary garbage.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Authorization ─────────────────────────────────────────────────────────
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "MANAGE_SETTINGS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // ── Fetch backup record ───────────────────────────────────────────────────
  const rows = await prisma.$queryRaw<
    Array<{ fileKey: string | null; status: string; createdAt: Date }>
  >`SELECT "fileKey", status, "createdAt" FROM backup_log WHERE id = ${id} LIMIT 1`;

  if (!rows.length) {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }

  const { fileKey, status, createdAt } = rows[0];

  if (status !== "COMPLETE" || !fileKey) {
    return NextResponse.json({ error: "Backup is not ready" }, { status: 400 });
  }

  // ── Generate signed Cloudinary URL and proxy the file ────────────────────
  const signedUrl = getSignedFileUrl(fileKey, "raw", 60); // 60-second window

  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch backup from storage" },
      { status: 502 }
    );
  }

  const body = await upstream.arrayBuffer();
  const dateStr = createdAt.toISOString().slice(0, 10);
  const fileName = `siko-mendo-backup-${dateStr}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      // Tell the browser exactly what this is and force a download with the
      // correct filename — this is what makes it human-readable.
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(body.byteLength),
      // No caching — each download generates a fresh signed URL
      "Cache-Control": "no-store",
    },
  });
}
