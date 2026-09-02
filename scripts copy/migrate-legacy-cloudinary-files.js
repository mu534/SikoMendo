/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS Node script, not TS app code */
/**
 * ONE-TIME CLEANUP: locks down documents, leave attachments, and reports
 * that were uploaded to Cloudinary as PUBLIC before the private-delivery
 * fix was applied. New uploads are already private — this script only
 * needs to run once, against files that already existed beforehand.
 *
 * WHAT IT DOES
 * ------------
 * For each Document / LeaveRequest attachment / Report file already in the
 * database, it asks Cloudinary to flip that exact asset's access type from
 * "upload" (public) to "authenticated" (private) IN PLACE — no re-upload,
 * no new URL, no risk of losing the file. This uses Cloudinary's `rename`
 * API with `to_type: "authenticated"` and the same public ID as both the
 * "from" and "to" — a same-ID rename that only changes the access type.
 *
 * SAFETY
 * ------
 * - Defaults to a DRY RUN: it will only print what it *would* do. Pass
 *   --execute to actually make changes.
 * - Already-authenticated assets are skipped (detected via a HEAD-style
 *   lookup first), so it's safe to run more than once.
 * - A failure on one record (wrong resource_type guess, asset already
 *   deleted from Cloudinary, network hiccup) is logged and skipped —
 *   it never stops the whole run or throws away anything.
 *
 * USAGE
 * -----
 *   node scripts/migrate-legacy-cloudinary-files.js            # dry run
 *   node scripts/migrate-legacy-cloudinary-files.js --execute   # do it for real
 *
 * Requires the same environment variables the app already uses:
 * DATABASE_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */

const { PrismaClient } = require("@prisma/client");
const { v2: cloudinary } = require("cloudinary");

const EXECUTE = process.argv.includes("--execute");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

async function isAlreadyAuthenticated(publicId, resourceType) {
  try {
    // A public asset resolves under type "upload"; if this lookup succeeds,
    // it's still public and needs converting. If Cloudinary can't find it
    // under "upload" but the record exists in our DB, it's most likely
    // already authenticated (or resource_type was guessed wrong — either
    // way, nothing to convert here).
    await cloudinary.api.resource(publicId, { resource_type: resourceType, type: "upload" });
    return false;
  } catch {
    return true;
  }
}

async function convert(label, publicId, resourceType) {
  const alreadyDone = await isAlreadyAuthenticated(publicId, resourceType);
  if (alreadyDone) {
    console.log(`  SKIP  ${label} (${publicId}) — already private or not found as public`);
    return "skipped";
  }

  if (!EXECUTE) {
    console.log(`  WOULD CONVERT  ${label} (${publicId}, resource_type=${resourceType})`);
    return "would-convert";
  }

  try {
    await cloudinary.uploader.rename(publicId, publicId, {
      resource_type: resourceType,
      to_type: "authenticated",
      overwrite: true,
      invalidate: true,
    });
    console.log(`  CONVERTED  ${label} (${publicId})`);
    return "converted";
  } catch (error) {
    console.log(`  FAILED  ${label} (${publicId}): ${error.message ?? error}`);
    return "failed";
  }
}

async function main() {
  console.log(EXECUTE ? "Running for real (--execute passed).\n" : "DRY RUN — pass --execute to apply changes.\n");

  const tally = { skipped: 0, "would-convert": 0, converted: 0, failed: 0 };
  const tick = (result) => { tally[result] = (tally[result] ?? 0) + 1; };

  console.log("Employee documents:");
  const documents = await prisma.document.findMany({ select: { id: true, fileKey: true, mimeType: true } });
  for (const doc of documents) {
    const resourceType = doc.mimeType.startsWith("image/") ? "image" : "raw";
    tick(await convert(`Document ${doc.id}`, doc.fileKey, resourceType));
  }

  console.log("\nLeave request attachments:");
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { documentKey: { not: null } },
    select: { id: true, documentKey: true, documentResourceType: true },
  });
  for (const leave of leaveRequests) {
    // Pre-fix rows never recorded a resource type — "raw" is the safer
    // default guess (most leave attachments are PDFs/docs, not images); a
    // wrong guess just means this one gets skipped/failed, never corrupted.
    const resourceType = leave.documentResourceType === "image" ? "image" : "raw";
    tick(await convert(`LeaveRequest ${leave.id}`, leave.documentKey, resourceType));
  }

  console.log("\nGenerated reports:");
  const reports = await prisma.report.findMany({
    where: { fileKey: { not: null } },
    select: { id: true, fileKey: true },
  });
  for (const report of reports) {
    tick(await convert(`Report ${report.id}`, report.fileKey, "raw"));
  }

  console.log("\n--- Summary ---");
  console.log(tally);
  if (!EXECUTE && (tally["would-convert"] ?? 0) > 0) {
    console.log("\nThis was a dry run. Re-run with --execute to actually apply these changes.");
  }
}

main()
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
