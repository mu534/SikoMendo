import prisma from "@/lib/prisma";

export async function getAllUsers(limit = 50, offset = 0) {
  const users = await prisma.user.findMany({
    include: {
      accounts: {
        select: {
          id: true,
          providerId: true,
          accountId: true,
          accessToken: true,
          refreshToken: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    skip: offset,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const total = await prisma.user.count();

  return { users, total, limit, offset };
}

export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      accounts: {
        select: {
          id: true,
          providerId: true,
          accountId: true,
          accessToken: true,
          refreshToken: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function getUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        select: {
          id: true,
          providerId: true,
          accountId: true,
          accessToken: true,
          refreshToken: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}
