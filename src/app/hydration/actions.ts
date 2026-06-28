'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getHydrationLogs(userId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const logs = await prisma.hydrationLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
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
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const logs = await prisma.hydrationLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: end
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyWaterGoal: true }
  });
  return user?.dailyWaterGoal ?? 2750;
}

export async function saveUserDailyWaterGoal(userId: string, goal: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { dailyWaterGoal: goal }
  });
  revalidatePath('/hydration');
  revalidatePath('/settings');
  return { success: true };
}
