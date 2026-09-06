"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { withPermission, type ActionResult } from "@/lib/action-utils";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";
import { z } from "zod";
import { getOrgSettings } from "./queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const orgSettingsSchema = z.object({
  orgName: z.string().trim().min(1, "Organisation name is required"),
  tagline: z.string().trim().min(1, "Tagline is required"),
  location: z.string().trim().min(1, "Location is required"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLogoFile(formData: FormData): File | null {
  const file = formData.get("logo");
  return file instanceof File && file.size > 0 ? file : null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Updates organisation name, tagline, location, and optionally replaces the logo.
 * Restricted to MANAGE_SETTINGS (ADMIN only).
 */
export async function updateOrgSettings(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<null>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_SETTINGS", async () => {
    const parsed = orgSettingsSchema.safeParse({
      orgName:  formData.get("orgName"),
      tagline:  formData.get("tagline"),
      location: formData.get("location"),
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    // Handle logo upload
    const logoFile = getLogoFile(formData);
    let logoUrl: string | null = null;
    let logoKey: string | null = null;

    if (logoFile) {
      // Delete old logo from Cloudinary if one exists
      const existing = await getOrgSettings();
      if (existing.logoKey) {
        await deleteFromCloudinary(existing.logoKey, "image");
      }

      const asset = await uploadToCloudinary(logoFile, "siko-mendo/org", {
        resourceType: "image",
      });
      logoUrl = asset.url;
      logoKey = asset.publicId;
    }

    // Upsert the singleton row — uses raw SQL so this works with the stale
    // generated client before `prisma generate` has been re-run.
    if (logoFile) {
      await prisma.$executeRaw`
        INSERT INTO org_settings (id, "orgName", tagline, location, "logoUrl", "logoKey", "updatedAt")
        VALUES ('singleton', ${parsed.data.orgName}, ${parsed.data.tagline}, ${parsed.data.location}, ${logoUrl}, ${logoKey}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          "orgName"  = EXCLUDED."orgName",
          tagline    = EXCLUDED.tagline,
          location   = EXCLUDED.location,
          "logoUrl"  = EXCLUDED."logoUrl",
          "logoKey"  = EXCLUDED."logoKey",
          "updatedAt" = NOW()
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO org_settings (id, "orgName", tagline, location, "updatedAt")
        VALUES ('singleton', ${parsed.data.orgName}, ${parsed.data.tagline}, ${parsed.data.location}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          "orgName"  = EXCLUDED."orgName",
          tagline    = EXCLUDED.tagline,
          location   = EXCLUDED.location,
          "updatedAt" = NOW()
      `;
    }

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "OrgSettings",
        entityId: "singleton",
        changes: { orgName: parsed.data.orgName, logoChanged: Boolean(logoFile) },
        userId: session!.user.id,
      },
    });

    revalidatePath("/settings/organization");
    revalidatePath("/settings");
    // Revalidate everywhere the sidebar renders (it reads org settings server-side)
    revalidatePath("/", "layout");
    return null;
  });
}

/**
 * Removes the current organisation logo, reverting to the default icon.
 */
export async function removeOrgLogo(): Promise<ActionResult<null>> {
  const session = await getServerSession();

  return withPermission(session, "MANAGE_SETTINGS", async () => {
    const existing = await getOrgSettings();
    if (existing.logoKey) {
      await deleteFromCloudinary(existing.logoKey, "image");
    }

    await prisma.$executeRaw`
      UPDATE org_settings
      SET "logoUrl" = NULL, "logoKey" = NULL, "updatedAt" = NOW()
      WHERE id = 'singleton'
    `;

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "OrgSettings",
        entityId: "singleton",
        changes: { logoRemoved: true },
        userId: session!.user.id,
      },
    });

    revalidatePath("/settings/organization");
    revalidatePath("/", "layout");
    return null;
  });
}
