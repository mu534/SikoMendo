import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parseResult = signInSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ message: "Invalid request payload." }, { status: 400 });
  }

  const { email, password } = parseResult.data;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  const accounts = user.accounts as Array<{ providerId: string; password?: string }>;
  const account = accounts.find((a) => a.providerId === "email");

  if (!account?.password) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  const isValidPassword = await bcrypt.compare(password, account.password);
  if (!isValidPassword) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt,
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("host") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  const response = NextResponse.json({ message: "Signed in successfully." });
  response.cookies.set("siko_mendo_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
