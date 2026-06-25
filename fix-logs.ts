import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const badLogs = await prisma.mealLog.findMany({
    where: { category: "Meal" }
  });

  console.log(`Found ${badLogs.length} bad logs.`);

  for (const log of badLogs) {
    const now = new Date();
    const hour = now.getHours();
    let category = "Snacks";
    if (hour >= 5 && hour < 11) category = "Breakfast";
    else if (hour >= 11 && hour < 15) category = "Lunch";
    else if (hour >= 17 && hour < 22) category = "Dinner";

    await prisma.mealLog.update({
      where: { id: log.id },
      data: {
        category,
        time: log.createdAt.toISOString() // use the original DB creation time as the ISO string
      }
    });
    console.log(`Updated log ${log.id} to ${category} with full ISO time.`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
