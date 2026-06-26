'use server';
import { prisma } from '@/lib/prisma';

export async function fetchUserLogs(userId: string) {
  try {
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
    await prisma.mealLog.delete({ where: { id: logId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete log:", error);
    return { success: false };
  }
}

export async function updateMealLogItems(logId: string, itemsData: any[], newTotals: any) {
  try {
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
