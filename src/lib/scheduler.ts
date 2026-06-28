import cron from 'node-cron';
import { prisma } from './prisma';
import { Bot } from 'grammy';
import { TZDate } from '@date-fns/tz';
import { format, startOfDay } from 'date-fns';

let isStarted = false;

export function startScheduler() {
  if (isStarted) return;
  isStarted = true;

  console.log('✅ Background Scheduler Started');
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || 'mock');

  // Run every minute at the start of the minute
  cron.schedule('* * * * *', async () => {
    try {
      const activeReminders = await prisma.reminder.findMany({
        where: { isActive: true },
        include: { user: true },
      });

      console.log(`[Scheduler] Checking ${activeReminders.length} active reminders...`);

      if (activeReminders.length === 0) return;

      for (const reminder of activeReminders) {
        if (!reminder.user.telegramId) continue;
        
        console.log(`[Scheduler] Reminder: ${reminder.category} at ${reminder.time} for user ${reminder.user.timezone}`);

        const userTimezone = reminder.user.timezone || 'UTC';
        const nowInTz = new TZDate(new Date(), userTimezone);
        
        // Current time in HH:mm in user's timezone using native Intl API
        const currentTimeString = new Intl.DateTimeFormat('en-GB', { 
          timeZone: userTimezone, 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }).format(new Date());

        if (currentTimeString === reminder.time) {
          // It is exactly the minute of the reminder.
          // Check if they already logged this category today
          const tzDateString = new Intl.DateTimeFormat('en-US', { 
            timeZone: userTimezone, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          }).format(new Date());
          const [month, day, year] = tzDateString.split('/');
          const tzStart = new TZDate(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0, userTimezone);
          
          const existingMeal = await prisma.mealLog.findFirst({
            where: {
              userId: reminder.user.id,
              category: {
                equals: reminder.category,
                mode: 'insensitive' // In case 'Breakfast' vs 'breakfast'
              },
              createdAt: { gte: tzStart }
            }
          });

          if (!existingMeal) {
            // Send reminder
            try {
              await bot.api.sendMessage(
                reminder.user.telegramId,
                `🕒 **Reminder:** It's time for your ${reminder.category}!\n\nSend a photo or type what you're eating to log it.`,
                { parse_mode: 'Markdown' }
              );
              console.log(`Sent ${reminder.category} reminder to user ${reminder.user.id}`);
            } catch (telegramErr) {
              console.error(`Failed to send reminder to ${reminder.user.telegramId}:`, telegramErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in cron scheduler:', err);
    }
  });
}
