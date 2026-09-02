import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Public routes that never require a session. Everything else under the
// matcher below is treated as protected by default — safer than maintaining
// a deny-list that someone forgets to update when a new page is added.
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/offline"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Optimistic check only: confirms a session cookie exists, not that it's
  // still valid or what role it belongs to. Real authentication and
  // role-based authorization happen server-side in lib/session.ts, inside
  // each layout/page/Server Action — see the Data Security guidance this
  // mirrors: https://nextjs.org/docs/app/guides/data-security
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
