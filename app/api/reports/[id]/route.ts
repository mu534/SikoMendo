import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getSignedFileUrl } from "@/lib/cloudinary";
import prisma from "@/lib/prisma";

/**
 * GET /api/reports/[id]
 *
 * Proxies the report file from Cloudinary to the browser with the correct
 * Content-Type and Content-Disposition headers so it downloads (and opens)
 * as a proper PDF or CSV file.
 *
 * Why proxy instead of redirecting to the Cloudinary URL directly?
 * Cloudinary authenticated assets don't include Content-Disposition by
 * default, so the browser either tries to render the raw bytes inline or
 * downloads a file with a Cloudinary-generated name. Proxying lets us set
 * the exact headers the browser needs to open the file correctly.
 *
 * Access rules (mirrors the history page):
 *   ADMIN / HR_OFFICER → any report
 *   Everyone else      → only reports they generated
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "VIEW_REPORTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // ── Load report record ────────────────────────────────────────────────────
  const report = await prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      format: true,
      fileKey: true,
      fileUrl: true,
      fileResourceType: true,
      generatedById: true,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Non-admin/HR users can only download their own reports
  const ORG_WIDE_ROLES = new Set(["ADMIN", "HR_OFFICER"]);
  if (!ORG_WIDE_ROLES.has(session.user.role) && report.generatedById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!report.fileKey) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  // ── Fetch from Cloudinary ─────────────────────────────────────────────────
  const resourceType = report.fileResourceType === "image" ? "image" : "raw";
  const signedUrl = getSignedFileUrl(report.fileKey, resourceType, 120);

  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch report from storage" },
      { status: 502 }
    );
  }

  const body = await upstream.arrayBuffer();

  // ── Build a clean filename ────────────────────────────────────────────────
  const safeTitle = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const ext = report.format === "CSV" ? "csv" : "pdf";
  const fileName = `${safeTitle}.${ext}`;

  // ── MIME type and Content-Disposition ─────────────────────────────────────
  const contentType =
    report.format === "CSV"
      ? "text/csv; charset=utf-8"
      : "application/pdf";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // `attachment` forces a download dialog with the correct filename
      // regardless of whether the browser can render the format.
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
