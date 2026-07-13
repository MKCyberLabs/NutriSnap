'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

async function verifyAuth(userId: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('nutrisnap_session_id')?.value;
  if (!sessionId || sessionId !== userId) {
    throw new Error('Unauthorized');
  }
}

async function verifyReminderOwner(id: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('nutrisnap_session_id')?.value;
  if (!sessionId) throw new Error('Unauthorized');

  const reminder = await prisma.reminder.findUnique({
    where: { id },
    select: { userId: true }
  });

  if (!reminder || reminder.userId !== sessionId) {
    throw new Error('Unauthorized');
  }
}


export async function getReminders(userId: string) {
  await verifyAuth(userId);
  return prisma.reminder.findMany({
    where: { userId },
    orderBy: { time: 'asc' }
  });
}

export async function saveReminder(userId: string, category: string, time: string, isActive: boolean = true) {
  await verifyAuth(userId);
  await prisma.reminder.upsert({
    where: {
      userId_category: {
        userId,
        category
      }
    },
    update: {
      time,
      isActive
    },
    create: {
      userId,
      category,
      time,
      isActive
    }
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function toggleReminder(id: string, isActive: boolean) {
  await verifyReminderOwner(id);
  await prisma.reminder.update({
    where: { id },
    data: { isActive }
  });
  revalidatePath('/settings');
  return { success: true };
}

export async function deleteReminder(id: string) {
  await verifyReminderOwner(id);
  await prisma.reminder.delete({
    where: { id }
  });
  revalidatePath('/settings');
  return { success: true };
}

export async function getUserTimezone(userId: string) {
  await verifyAuth(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  return user?.timezone || 'UTC';
}

export async function updateTimezone(userId: string, timezone: string) {
  await verifyAuth(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { timezone }
  });
  revalidatePath('/settings');
  return { success: true };
}

export async function getHydrationSetting(userId: string) {
  await verifyAuth(userId);
  return prisma.hydrationSetting.findUnique({
    where: { userId }
  });
}

export async function saveHydrationSetting(userId: string, data: any) {
  await verifyAuth(userId);
  return prisma.hydrationSetting.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data }
  });
}
