"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export async function markNotificationRead(id: string) {
  const session = await getServerSession();
  if (!session) return;

  // Scoped to the caller's own notifications — updateMany with a userId match
  // means this silently no-ops rather than erroring if the id isn't theirs.
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await getServerSession();
  if (!session) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");
}
