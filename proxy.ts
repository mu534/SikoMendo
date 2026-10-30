import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// ── Locale configuration ──────────────────────────────────────────────────────

const LOCALES = ["en", "om"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

function isValidLocale(val: string | undefined): val is Locale {
  return LOCALES.includes(val as Locale);
}

/** Detect locale from cookie, falling back to the default. */
function getLocaleFromRequest(request: NextRequest): Locale {
  const cookieVal = request.cookies.get(LOCALE_COOKIE)?.value;
  return isValidLocale(cookieVal) ? cookieVal : DEFAULT_LOCALE;
}

// ── Public routes (without locale prefix) ─────────────────────────────────────
// These paths never require a session. Everything else is protected.
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
    // No locale prefix — redirect to the locale-prefixed equivalent.
    // Detect locale from cookie, defaulting to "en".
    const locale = getLocaleFromRequest(request);
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(newUrl);
  }

  // ── Step 2: Strip the locale prefix to get the bare path ──────────────────
  const pathWithoutLocale =
    pathname === `/${pathnameLocale}`
      ? "/"
      : pathname.slice(`/${pathnameLocale}`.length);

  // ── Step 3: Allow public paths through without session check ──────────────
  if (PUBLIC_PATHS.has(pathWithoutLocale)) {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
