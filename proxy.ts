import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// ── next-intl middleware ──────────────────────────────────────────────────────
// Handles locale detection, sets the X-NEXT-INTL-LOCALE request header (which
// is how next-intl's `requestLocale` / `getTranslations()` receives the locale
// in server components), and redirects bare paths like `/dashboard` → `/en/dashboard`.
const intlMiddleware = createMiddleware(routing);

// ── Locale configuration ──────────────────────────────────────────────────────

const LOCALES = ["en", "om"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

function isValidLocale(val: string | undefined): val is Locale {
  return LOCALES.includes(val as Locale);
}

// ── Public paths (locale-stripped) ────────────────────────────────────────────
// These never require a session check. Everything else is protected.
//
// /force-password-change is here so the proxy never redirect-loops it to
// /sign-in — the page itself has a session guard.
const PUBLIC_PATHS = new Set([
  "/",
  "/sign-in",
  "/offline",
  "/force-password-change",
]);

// ── Proxy ─────────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Step 1: Detect whether the path already has a valid locale prefix ──────
  const pathnameLocale = LOCALES.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );

  if (!pathnameLocale) {
    // No locale prefix — intlMiddleware will redirect to the locale-prefixed
    // equivalent using the cookie / accept-language negotiation.
    return intlMiddleware(request);
  }

  // ── Step 2: Strip the locale prefix to get the bare path ──────────────────
  const pathWithoutLocale =
    pathname === `/${pathnameLocale}`
      ? "/"
      : pathname.slice(`/${pathnameLocale}`.length);

  // ── Step 3: Allow public paths through (but still run intlMiddleware so
  //            the X-NEXT-INTL-LOCALE header is always set) ──────────────────
  if (PUBLIC_PATHS.has(pathWithoutLocale)) {
    return intlMiddleware(request);
  }

  // ── Step 4: Session check ─────────────────────────────────────────────────
  // Optimistic cookie check only — real auth happens server-side in each
  // layout/page/Server Action (see lib/session.ts).
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signInUrl = new URL(
      `/${pathnameLocale}/sign-in`,
      request.url
    );
    signInUrl.searchParams.set("redirectTo", pathWithoutLocale);
    return NextResponse.redirect(signInUrl);
  }

  // ── Step 5: Authenticated request — run intlMiddleware to set the locale
  //            header, then forward ──────────────────────────────────────────
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
