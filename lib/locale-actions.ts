"use server";

import { cookies } from "next/headers";
import { getServerSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-utils";

const LOCALES = ["en", "om"] as const;
type Locale = (typeof LOCALES)[number];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persists the user's language preference.
 * - Always sets the NEXT_LOCALE cookie (works for unauthenticated users too).
 * - For authenticated users, also updates user.locale in the database so the
 *   preference survives across devices and sessions.
 */
export async function setLocale(locale: string): Promise<ActionResult<void>> {
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return {
      success: false,
      error: { message: "Invalid locale.", code: "INVALID_LOCALE" },
    };
  }

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    httpOnly: false, // must be readable by client JS for the switcher
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  // Persist to DB for authenticated users
  const session = await getServerSession();
  if (session?.user?.id) {
    try {
      await (prisma.user.update as Function)({
        where: { id: session.user.id },
        data: { locale: locale as Locale },
      });
    } catch {
      // Non-fatal — cookie is already set, DB update failure shouldn't
      // block the language switch.
      console.warn("[setLocale] failed to persist locale to DB:", locale);
    }
  }

  return { success: true, data: undefined };
}
