import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const PUBLIC_PATHS = ["/", "/sign-in", "/api/auth/sign-in", "/api/auth/sign-out"];

export async function proxy(request: NextRequest) {
	const cookie = request.cookies.get("siko_mendo_session")?.value;

  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname === path)) {
    return NextResponse.next();
  }

  if (!cookie) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  const session = await prisma.session.findUnique({
    where: { token: cookie },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
