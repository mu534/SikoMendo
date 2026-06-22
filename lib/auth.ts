import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function getSessionFromRequest(request?: Request) {
  // Prefer Next.js cookies() helper for server handlers; fall back to request.cookies when available
  let token: string | undefined | null = undefined;

  try {
    // cookies() can be async in some environments
    const store = await cookies();
    token = store.get("siko_mendo_session")?.value;
  } catch (err) {
    // fallback to Request object cookie parsing (parse Cookie header)
    const cookieHeader = request?.headers?.get?.("cookie") ?? null;
    if (cookieHeader) {
      const pairs = cookieHeader.split(";").map((p) => p.trim());
      for (const pair of pairs) {
        const [name, ...rest] = pair.split("=");
        if (name === "siko_mendo_session") {
          token = decodeURIComponent(rest.join("="));
          break;
        }
      }
    }
  }

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export function requireSession(session: Awaited<ReturnType<typeof getSessionFromRequest>>) {
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
