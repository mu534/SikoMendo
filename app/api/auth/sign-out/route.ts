import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("siko_mendo_session")?.value;

  if (cookie) {
    await prisma.session.deleteMany({ where: { token: cookie } });
  }

  const response = NextResponse.json({ message: "Signed out successfully." });
  response.cookies.set("siko_mendo_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
