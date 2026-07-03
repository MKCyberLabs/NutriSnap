'use server';
import { prisma } from '@/lib/prisma';
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

  const log = await prisma.mealLog.findUnique({
    where: { id: logId },
    select: { userId: true }
  });

  if (!log || log.userId !== sessionId) {
    throw new Error('Unauthorized');
  }
}


export async function fetchUserLogs(userId: string) {
  try {
    await verifyAuth(userId);
    const logs = await prisma.mealLog.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    return logs.map((log: any) => ({
      id: log.id,
      category: log.category,
      timestamp: log.time,
      imagePath: log.imagePath,
      healthInsight: log.healthInsight,
      totalNutrients: {
        calories: log.totalCalories,
        protein: log.totalProtein,
        carbs: log.totalCarbs,
        fat: log.totalFat,
        fiber: log.totalFiber,
        saturatedFat: log.totalSatFat,
        sugar: log.totalSugar
      },
      items: log.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        grams: item.grams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        saturatedFat: item.saturatedFat,
        sugar: item.sugar,
        rating: item.rating
      }))
    }));
  } catch (error) {
    console.error("Failed to fetch user logs:", error);
    return [];
  }
}

export async function saveMealLog(userId: string, logData: any, itemsData: any[]) {
  try {
    await verifyAuth(userId);
    const newLog = await prisma.mealLog.create({
      data: {
        userId,
        category: logData.category,
        time: logData.timestamp,
        imagePath: logData.imagePath,
        totalCalories: logData.totalNutrients.calories,
        totalProtein: logData.totalNutrients.protein,
        totalCarbs: logData.totalNutrients.carbs,
        totalFat: logData.totalNutrients.fat,
        totalFiber: logData.totalNutrients.fiber,
        totalSatFat: logData.totalNutrients.saturatedFat,
        totalSugar: logData.totalNutrients.sugar,
        healthInsight: logData.healthInsight,
        items: {
          create: itemsData.map((item: any) => ({
            name: item.name,
            grams: item.grams,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            saturatedFat: item.saturatedFat,
            sugar: item.sugar,
            rating: item.rating
          }))
        }
      },
      include: { items: true }
    });
    return { success: true, log: newLog };
  } catch (error) {
    console.error("Failed to save meal log:", error);
    return { success: false };
  }
}

export async function deleteMealLog(logId: string) {
  try {
    await verifyLogOwner(logId);
    await prisma.mealLog.delete({ where: { id: logId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete log:", error);
    return { success: false };
  }
}

export async function updateMealLogItems(logId: string, itemsData: any[], newTotals: any) {
  try {
    await verifyLogOwner(logId);
    await prisma.$transaction([
      prisma.foodItem.deleteMany({ where: { mealLogId: logId } }),
      prisma.mealLog.update({
        where: { id: logId },
        data: {
          totalCalories: newTotals.calories,
          totalProtein: newTotals.protein,
          totalCarbs: newTotals.carbs,
          totalFat: newTotals.fat,
          totalFiber: newTotals.fiber,
          totalSatFat: newTotals.saturatedFat,
          totalSugar: newTotals.sugar,
          items: {
            create: itemsData.map((item: any) => ({
              name: item.name,
              grams: item.grams,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              fiber: item.fiber,
              saturatedFat: item.saturatedFat,
              sugar: item.sugar,
              rating: item.rating
            }))
          }
        }
      })
    ]);
    return { success: true };
  } catch (error) {
    console.error("Failed to update meal log items:", error);
    return { success: false };
  }
}
