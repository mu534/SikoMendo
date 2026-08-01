import "server-only";
import prisma from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  await prisma.notification.create({ data: { userId, type, title, message } });
}
