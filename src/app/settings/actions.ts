'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { z } from 'zod';

const hydrationSettingSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  intervalMinutes: z.number().int().min(1).max(1440),
  activeDays: z.array(z.string()).max(7),
  isActive: z.boolean(),
});

async function verifyAuth(userId: string) {
  await requireUser(userId);
}

async function verifyReminderOwner(id: string) {
  const user = await requireUser();

  const reminder = await prisma.reminder.findUnique({
    where: { id },
    select: { userId: true }
  });

  if (!reminder || reminder.userId !== user.id) {
    throw new Error('Unauthorized');
  }
}


export async function getReminders(userId: string) {
  await verifyAuth(userId);
  return prisma.reminder.findMany({
    where: { userId, domain: 'HEALTH' },
    orderBy: { time: 'asc' }
  });
}

export async function saveReminder(userId: string, category: string, time: string, isActive: boolean = true) {
  await verifyAuth(userId);
  const existing = await prisma.reminder.findFirst({
    where: {
      userId,
      category,
      domain: 'HEALTH'
    }
  });

  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        time,
        timeOfDay: time,
        isActive
      }
    });
  } else {
    await prisma.reminder.create({
      data: {
        userId,
        domain: 'HEALTH',
        type: 'MEAL',
        title: category,
        category,
        mealCategory: category,
        time,
        timeOfDay: time,
        recurrenceType: 'DAILY',
        recurrenceInterval: 1,
        reminderOffsetsMin: [0],
        isActive
      }
    });
  }

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

export async function saveHydrationSetting(userId: string, data: unknown) {
  await verifyAuth(userId);
  const setting = hydrationSettingSchema.parse(data);
  return prisma.hydrationSetting.upsert({
    where: { userId },
    update: setting,
    create: { userId, ...setting }
  });
}
