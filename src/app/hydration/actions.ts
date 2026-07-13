'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { TZDate } from '@date-fns/tz';
import { startOfDay, endOfDay } from 'date-fns';
import { cookies } from 'next/headers';

async function verifyAuth(userId: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('nutrisnap_session_id')?.value;
  if (!sessionId || sessionId !== userId) {
    throw new Error('Unauthorized');
  }
}

async function verifyLogOwner(logId: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('nutrisnap_session_id')?.value;
  if (!sessionId) throw new Error('Unauthorized');

  const log = await prisma.hydrationLog.findUnique({
    where: { id: logId },
    select: { userId: true }
  });

  if (!log || log.userId !== sessionId) {
    throw new Error('Unauthorized');
  }
}


export async function getHydrationLogs(userId: string, date: Date) {
  await verifyAuth(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone || 'UTC';
  
  // Use TZDate to compute the start and end of the day in the user's timezone
  const localDate = new TZDate(date, tz);
  const dayStart = startOfDay(localDate);
  const dayEnd = endOfDay(localDate);

  const logs = await prisma.hydrationLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: dayStart,
        lte: dayEnd
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return logs.map((log: any) => ({
    id: log.id,
    amountMl: log.amountMl,
    drinkType: log.drinkType || 'Water',
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function getWeeklyHydrationData(userId: string, startDate: Date, endDate: Date) {
  await verifyAuth(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone || 'UTC';

  const localStart = new TZDate(startDate, tz);
  const localEnd = new TZDate(endDate, tz);
  const weekStart = startOfDay(localStart);
  const weekEnd = endOfDay(localEnd);

  const logs = await prisma.hydrationLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: weekStart,
        lte: weekEnd
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  return logs.map((log: any) => ({
    id: log.id,
    amountMl: log.amountMl,
    drinkType: log.drinkType || 'Water',
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function logHydration(userId: string, amountMl: number, drinkType: string = 'Water') {
  await verifyAuth(userId);
  await prisma.hydrationLog.create({
    data: {
      userId,
      amountMl,
      drinkType
    }
  });
  revalidatePath('/hydration');
  return { success: true };
}

export async function deleteHydrationLog(logId: string) {
  try {
    await verifyLogOwner(logId);
    await prisma.hydrationLog.delete({ where: { id: logId } });
    revalidatePath('/hydration');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete hydration log:', error);
    return { success: false };
  }
}

export async function updateHydrationLog(logId: string, amountMl: number, drinkType: string) {
  try {
    await verifyLogOwner(logId);
    await prisma.hydrationLog.update({
      where: { id: logId },
      data: { amountMl, drinkType }
    });
    revalidatePath('/hydration');
    return { success: true };
  } catch (error) {
    console.error('Failed to update hydration log:', error);
    return { success: false };
  }
}

export async function getUserDailyWaterGoal(userId: string): Promise<number> {
  await verifyAuth(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyWaterGoal: true }
  });
  return user?.dailyWaterGoal ?? 2750;
}

export async function saveUserDailyWaterGoal(userId: string, goal: number) {
  await verifyAuth(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { dailyWaterGoal: goal }
  });
  revalidatePath('/hydration');
  revalidatePath('/settings');
  return { success: true };
}
