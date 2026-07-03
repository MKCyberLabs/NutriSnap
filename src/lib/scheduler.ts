import cron from 'node-cron';
import { prisma } from './prisma';
import { Bot } from 'grammy';
import { TZDate } from '@date-fns/tz';
import { format, startOfDay } from 'date-fns';

let isStarted = false;

const lastHydrationMessageMap = new Map<string, number>();

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
        
        // Current time in HH:mm in user's timezone
        const hours = String(nowInTz.getHours()).padStart(2, '0');
        const minutes = String(nowInTz.getMinutes()).padStart(2, '0');
        const currentTimeString = `${hours}:${minutes}`;

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
        const nowInTz = new TZDate(now, userTimezone);
        
        // Check day of week in user's timezone using date-fns formatting
        const currentDay = format(nowInTz, 'EEEE');
        
        if (!setting.activeDays.includes(currentDay)) {
          continue;
        }

        // Current time in user timezone (HH:mm)
        const hours = String(nowInTz.getHours()).padStart(2, '0');
        const minutes = String(nowInTz.getMinutes()).padStart(2, '0');
        const currentTimeString = `${hours}:${minutes}`;

        const currentMinutes = parseInt(currentTimeString.split(':')[0]) * 60 + parseInt(currentTimeString.split(':')[1]);
        const startMinutes = parseInt(setting.startTime.split(':')[0]) * 60 + parseInt(setting.startTime.split(':')[1]);
        const endMinutes = parseInt(setting.endTime.split(':')[0]) * 60 + parseInt(setting.endTime.split(':')[1]);

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          const diffMinutes = currentMinutes - startMinutes;
          if (diffMinutes % setting.intervalMinutes === 0) {
            const inline_keyboard = [
              [
                { text: '💧 250ml', callback_data: 'hyd_250' },
                { text: '💧 500ml', callback_data: 'hyd_500' }
              ],
              [
                { text: 'Custom Amount', callback_data: 'hyd_custom' }
              ]
            ];

            try {
              // Delete the previous reminder if it still exists
              const oldMessageId = lastHydrationMessageMap.get(setting.user.id);
              if (oldMessageId && setting.user.telegramId) {
                bot.api.deleteMessage(setting.user.telegramId, oldMessageId).catch(() => {});
              }

              const msg = await bot.api.sendMessage(
                setting.user.telegramId,
                `💧 **Time to hydrate!**\n\nTake a quick break and drink some water.`,
                { 
                  parse_mode: 'Markdown', 
                  reply_markup: { inline_keyboard } 
                }
              );
              console.log(`Sent hydration reminder to user ${setting.user.id}`);
              
              // Track the new message
              lastHydrationMessageMap.set(setting.user.id, msg.message_id);

              // Auto-delete after 60 minutes (1 hour)
              setTimeout(() => {
                if (setting.user.telegramId && msg.message_id) {
                  bot.api.deleteMessage(setting.user.telegramId, msg.message_id).catch(() => {});
                }
              }, 60 * 60 * 1000);
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
