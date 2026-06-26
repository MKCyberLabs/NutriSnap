'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getReminders(userId: string) {
  return prisma.reminder.findMany({
    where: { userId },
    orderBy: { time: 'asc' }
  });
}

export async function saveReminder(userId: string, category: string, time: string, isActive: boolean = true) {
  const existing = await prisma.reminder.findFirst({
    where: { userId, category }
  });

  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: { time, isActive }
    });
  } else {
    await prisma.reminder.create({
      data: { userId, category, time, isActive }
    });
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function toggleReminder(id: string, isActive: boolean) {
  await prisma.reminder.update({
    where: { id },
    data: { isActive }
  });
  revalidatePath('/settings');
  return { success: true };
}

export async function deleteReminder(id: string) {
  await prisma.reminder.delete({
    where: { id }
  });
  revalidatePath('/settings');
  return { success: true };
}

export async function getUserTimezone(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  return user?.timezone || 'UTC';
}

export async function updateTimezone(userId: string, timezone: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { timezone }
  });
  revalidatePath('/settings');
  return { success: true };
}
