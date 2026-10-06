'use server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

async function verifyAuth(userId: string) {
  await requireUser(userId);
}

async function verifyLogOwner(logId: string) {
  const user = await requireUser();

  const log = await prisma.mealLog.findUnique({
    where: { id: logId },
    select: { userId: true }
  });

  if (!log || log.userId !== user.id) {
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
    const logDate = logData.timestamp ? new Date(logData.timestamp) : new Date();
    const createdAt = !isNaN(logDate.getTime()) ? logDate : new Date();

    const newLog = await prisma.mealLog.create({
      data: {
        userId,
        category: logData.category || 'Lunch',
        time: logData.timestamp,
        imagePath: logData.imagePath || null,
        description: logData.description || null,
        totalCalories: Number(logData.totalNutrients?.calories) || 0,
        totalProtein: Number(logData.totalNutrients?.protein) || 0,
        totalCarbs: Number(logData.totalNutrients?.carbs) || 0,
        totalFat: Number(logData.totalNutrients?.fat) || 0,
        totalFiber: Number(logData.totalNutrients?.fiber) || 0,
        totalSatFat: Number(logData.totalNutrients?.saturatedFat) || 0,
        totalSugar: Number(logData.totalNutrients?.sugar) || 0,
        healthInsight: logData.healthInsight || null,
        createdAt,
        items: {
          create: (itemsData || []).map((item: any) => ({
            name: item.name || 'Food Item',
            grams: Number(item.grams) || 0,
            calories: Number(item.calories) || 0,
            protein: Number(item.protein) || 0,
            carbs: Number(item.carbs) || 0,
            fat: Number(item.fat) || 0,
            fiber: Number(item.fiber) || 0,
            saturatedFat: Number(item.saturatedFat) || 0,
            sugar: Number(item.sugar) || 0,
            rating: typeof item.rating === 'number' ? item.rating : 3,
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
          totalCalories: Number(newTotals.calories) || 0,
          totalProtein: Number(newTotals.protein) || 0,
          totalCarbs: Number(newTotals.carbs) || 0,
          totalFat: Number(newTotals.fat) || 0,
          totalFiber: Number(newTotals.fiber) || 0,
          totalSatFat: Number(newTotals.saturatedFat) || 0,
          totalSugar: Number(newTotals.sugar) || 0,
          items: {
            create: (itemsData || []).map((item: any) => ({
              name: item.name || 'Food Item',
              grams: Number(item.grams) || 0,
              calories: Number(item.calories) || 0,
              protein: Number(item.protein) || 0,
              carbs: Number(item.carbs) || 0,
              fat: Number(item.fat) || 0,
              fiber: Number(item.fiber) || 0,
              saturatedFat: Number(item.saturatedFat) || 0,
              sugar: Number(item.sugar) || 0,
              rating: typeof item.rating === 'number' ? item.rating : 3,
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
