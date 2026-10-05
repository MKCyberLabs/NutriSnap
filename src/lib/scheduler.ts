import cron from 'node-cron';
import { prisma } from './prisma';
import { Bot } from 'grammy';
import { TZDate } from '@date-fns/tz';
import { format, startOfDay } from 'date-fns';
import {
  calculateDeliverySchedules,
  shouldDeliverNow,
  formatTelegramBillReminder,
  ObligationDeliveryTarget,
  MAX_DELIVERY_ATTEMPTS,
  evaluateDeliverySuccess,
  evaluateDeliveryFailure,
} from './reminders/delivery-engine';

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
        
        // Handle legacy and health meal reminders
        if (reminder.category && reminder.time) {
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

      // --- 3. Wealth & Obligation Reminders (Unified Engine) ---
      const activeObligations = await prisma.obligation.findMany({
        where: { isActive: true, isArchived: false },
        include: { user: true, reminders: true },
      });

      const now = new Date();
      for (const ob of activeObligations) {
        if (!ob.user.telegramId) continue;

        const target: ObligationDeliveryTarget = {
          id: ob.id,
          userId: ob.userId,
          title: ob.title,
          kind: ob.kind,
          amount: ob.amount ? ob.amount.toString() : null,
          nextDueAt: ob.nextDueAt,
          reminderOffsetsMin: ob.reminderOffsetsMin,
          isActive: ob.isActive,
          isArchived: ob.isArchived,
        };

        const schedules = calculateDeliverySchedules(target, now);

        for (const sched of schedules) {
          const existingDelivery = await prisma.reminderDelivery.findFirst({
            where: {
              obligationId: ob.id,
              occurrenceKey: sched.occurrenceKey,
              offsetMinutes: sched.offsetMinutes,
              channel: 'TELEGRAM',
            },
          });

          const eligibility = shouldDeliverNow({
            scheduledFor: sched.scheduledFor,
            now,
            snoozedUntil: existingDelivery?.snoozedUntil,
            isStale: sched.isStale,
            deliveryStatus: (existingDelivery?.status as any) || null,
            attemptCount: existingDelivery?.attemptCount ?? 0,
            lastAttemptAt: existingDelivery?.lastAttemptAt ?? null,
            nextRetryAt: existingDelivery?.nextRetryAt ?? null,
          });

          if (!eligibility.shouldSend) {
            continue;
          }

          // Atomic claim creation if not already present
          let delivery = existingDelivery;
          if (!delivery) {
            try {
              let reminderId = ob.reminders?.[0]?.id;
              if (!reminderId) {
                const createdReminder = await prisma.reminder.create({
                  data: {
                    userId: ob.userId,
                    domain: 'FINANCE',
                    type: 'OBLIGATION',
                    title: ob.title,
                    obligationId: ob.id,
                    isActive: true,
                  },
                });
                reminderId = createdReminder.id;
              }

              delivery = await prisma.reminderDelivery.create({
                data: {
                  userId: ob.userId,
                  reminderId,
                  obligationId: ob.id,
                  occurrenceKey: sched.occurrenceKey,
                  scheduledFor: sched.scheduledFor,
                  offsetMinutes: sched.offsetMinutes,
                  channel: 'TELEGRAM',
                  status: 'PENDING',
                  attemptCount: 0,
                },
              });
            } catch {
              continue;
            }
          }

          // Deliver via Telegram
          const payload = formatTelegramBillReminder({
            obligationId: ob.id,
            title: ob.title,
            kind: ob.kind,
            amount: ob.amount ? ob.amount.toString() : null,
            nextDueAt: ob.nextDueAt,
            occurrenceKey: sched.occurrenceKey,
            offsetMinutes: sched.offsetMinutes,
            appBaseUrl: process.env.NEXTAUTH_URL || 'https://nutrisnap.app',
          });

          try {
            const sent = await bot.api.sendMessage(ob.user.telegramId, payload.text, {
              parse_mode: 'Markdown',
              reply_markup: payload.reply_markup,
            });

            const successState = evaluateDeliverySuccess({
              currentAttemptCount: delivery.attemptCount || 0,
              sentAt: new Date(),
            });

            await prisma.reminderDelivery.update({
              where: { id: delivery.id },
              data: {
                status: successState.status,
                sentAt: successState.sentAt,
                telegramMessageId: sent.message_id,
                attemptCount: successState.attemptCount,
                lastAttemptAt: successState.lastAttemptAt,
                nextRetryAt: successState.nextRetryAt,
              },
            });
            console.log(`[Scheduler] Sent bill reminder ${ob.title} to user ${ob.user.id}`);
          } catch (sendErr: any) {
            const failureState = evaluateDeliveryFailure({
              currentAttemptCount: delivery.attemptCount || 0,
              failedAt: new Date(),
              failureReason: sendErr?.message || 'Send error',
            });

            await prisma.reminderDelivery.update({
              where: { id: delivery.id },
              data: {
                status: failureState.status,
                failureReason: failureState.failureReason,
                attemptCount: failureState.attemptCount,
                lastAttemptAt: failureState.lastAttemptAt,
                nextRetryAt: failureState.nextRetryAt,
              },
            });
            console.error(
              `[Scheduler] Delivery attempt ${failureState.attemptCount}/${MAX_DELIVERY_ATTEMPTS} failed for reminder ${ob.title}:`,
              sendErr?.message
            );
          }
        }
      }
    } catch (err) {
      console.error('Error in cron scheduler:', err);
    }
  });
}
