/**
 * GET /api/backups/[id]
 *
 * Streaming download proxy for encrypted backup files.
 *
 * IMPORTANT: This route streams upstream.body directly to the response.
 * It does NOT buffer with arrayBuffer() — backups can be large (many MB).
 * The existing reports route at /api/reports/[id]/route.ts uses arrayBuffer()
 * and is NOT the model for this route.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { can, type Role } from "@/lib/permissions";
import { resolveEffectiveRole } from "@/lib/employee-access";
import { getSignedFileUrl } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const effectiveRole = await resolveEffectiveRole(session.user.id, session.user.role as Role);
  if (!can(effectiveRole, "MANAGE_BACKUP_RESTORE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const record = await prisma.backupRecord.findUnique({
    where: { id },
    select: {
      publicId: true,
      filename: true,
      cloudinaryUploadStatus: true,
      backupStatus: true,
    },
  });

  if (
    !record ||
    record.cloudinaryUploadStatus !== "UPLOADED" ||
    record.backupStatus === "FAILED"
  ) {
    return NextResponse.json({ error: "Backup not available" }, { status: 400 });
  }

  // Short-lived signed URL — 2 minutes; never exposed to the browser
  const signedUrl = getSignedFileUrl(record.publicId, "raw", 120);
  const upstream = await fetch(signedUrl);

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch backup from storage" },
      { status: 502 }
    );
  }

  // Audit download
  try {
    await prisma.auditLog.create({
      data: {
        action: "BACKUP_DOWNLOAD",
        entity: "BackupRecord",
        entityId: id,
        changes: { filename: record.filename },
        userId: session.user.id,
      },
    });
  } catch {
    // Non-fatal
  }

  // Stream the body directly — do NOT call arrayBuffer()
  // upstream.body is ReadableStream<Uint8Array>
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${record.filename}"`,
      ...(upstream.headers.get("Content-Length")
        ? { "Content-Length": upstream.headers.get("Content-Length")! }
        : {}),
      "Cache-Control": "no-store",
    },
  });
}
