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

      // --- Hydration Reminders ---
      const activeHydrationSettings = await prisma.hydrationSetting.findMany({
        where: { isActive: true },
        include: { user: true },
      });

      console.log(`[Scheduler] Checking ${activeHydrationSettings.length} active hydration settings...`);

      for (const setting of activeHydrationSettings) {
        if (!setting.user.telegramId) continue;

        const userTimezone = setting.user.timezone || 'UTC';
        const now = new Date();
        
        // Check day of week in user's timezone
        const currentDay = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, weekday: 'long' }).format(now);
        
        if (!setting.activeDays.includes(currentDay)) {
          continue;
        }

        // Current time in user timezone
        const currentTimeString = new Intl.DateTimeFormat('en-GB', { 
          timeZone: userTimezone, 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        }).format(now);

        const currentMinutes = parseInt(currentTimeString.split(':')[0]) * 60 + parseInt(currentTimeString.split(':')[1]);
        const startMinutes = parseInt(setting.startTime.split(':')[0]) * 60 + parseInt(setting.startTime.split(':')[1]);
        const endMinutes = parseInt(setting.endTime.split(':')[0]) * 60 + parseInt(setting.endTime.split(':')[1]);

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          const diffMinutes = currentMinutes - startMinutes;
          if (diffMinutes % setting.intervalMinutes === 0) {
            // Include InlineKeyboard from grammy if not already imported (wait, we must use the already imported Bot, maybe need to import InlineKeyboard? Yes, it's not imported in scheduler.ts)
            // Let's just use raw inline_keyboard array to avoid changing imports, or import it.
            // Wait, we can just use the raw Telegram API format for inline keyboards to avoid needing InlineKeyboard import.
            const inline_keyboard = [
              [
                { text: '👁️ Done', callback_data: 'hyd_done' }
              ]
            ];

            try {
              const msg = await bot.api.sendMessage(
                setting.user.telegramId,
                `👁️ **Time for an eye rest!**\n\nTake a quick break and look away.`,
                { 
                  parse_mode: 'Markdown', 
                  reply_markup: { inline_keyboard } 
                }
              );
              console.log(`Sent eye rest reminder to user ${setting.user.id}`);

              // Auto-delete after 5 minutes
              setTimeout(() => {
                if (setting.user.telegramId && msg.message_id) {
                  bot.api.deleteMessage(setting.user.telegramId, msg.message_id).catch(() => {});
                }
              }, 5 * 60 * 1000);
            } catch (telegramErr) {
              console.error(`Failed to send eye rest reminder to ${setting.user.telegramId}:`, telegramErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in cron scheduler:', err);
    }
  });
}
