import prisma from "@/lib/prisma";

export async function createSessionForUser(userId: string, durationDays = 30) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
    include: { user: true },
  });

  return session;
}

export async function getSessionByToken(token: string) {
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  return session;
}

export async function deleteSessionByToken(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}
