import cron from 'node-cron';
import { prisma } from './prisma';
import { Bot } from 'grammy';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import {
  calculateDeliverySchedules,
  shouldDeliverNow,
  formatOccurrenceKey,
  formatTelegramBillReminder,
  formatTelegramDebtReminder,
  formatTelegramLoanEmiReminder,
  ObligationDeliveryTarget,
  MAX_DELIVERY_ATTEMPTS,
  evaluateDeliverySuccess,
  evaluateDeliveryFailure,
} from './reminders/delivery-engine';
import { calculateDebtOutstanding } from './finance/finance';

let isStarted = false;

export const lastHydrationMessageMap = new Map<string, number>();
export const LEASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes crash recovery lease timeout (SOL-R002-004)
export const OUTBOUND_SEND_TIMEOUT_MS = 30_000; // 30 seconds strict outbound timeout, well below 5m LEASE_TIMEOUT_MS (SOL-R006-004)
export const DISPATCH_SAFETY_MARGIN_MS = 15_000; // 15 seconds documented safety margin for dispatch and response processing (SOL-R006-004 / R008)

/**
 * ============================================================================
 * SOL-R006-004 & SOL-R008: Telegram Outbound Timeout & Safe Delivery Semantics
 * ============================================================================
 *
 * 1. Bounded Outbound Request Lifetime & Fresh Claim Leases:
 *    Claims acquire leases stamped with the live time of acquisition (via injectable clock),
 *    preventing queued targets from inheriting a stale tick-start timestamp.
 *    The production cron separates the calendar evaluation instant (evalTime) from the live
 *    wall clock (getLiveNow).
 *    Furthermore, pre-dispatch validations verify attempt ownership, authoritative schedule
 *    invariants, and lease validity immediately before initiating any outbound network call.
 *    Outbound requests require remaining lease lifetime >= OUTBOUND_SEND_TIMEOUT_MS + DISPATCH_SAFETY_MARGIN_MS (45s).
 *    If remaining lease is insufficient but unexpired, the lease is atomically renewed before dispatch;
 *    if expired or renewal fails, dispatch is aborted.
 *    Outbound requests are bounded by a 30-second timeout (OUTBOUND_SEND_TIMEOUT_MS) via AbortSignal.
 *
 * 2. Delivery Guarantees in Distributed Systems:
 *    External messaging APIs (like Telegram Bot API) enforce at-least-once delivery semantics;
 *    client-side fencing and bounded requests minimize duplicate dispatch risk but cannot
 *    guarantee exactly-once external delivery across network partitions without provider-side
 *    idempotency keys. Local dispatch exclusivity is strictly protected via fresh claim
 *    timestamps, pre-dispatch ownership validation, schedule revalidation, and atomic optimistic
 *    fencing tokens (attemptCount and lastAttemptAt). Database transactions are never held open
 *    during external network calls.
 *
 * 3. Safe Retry & Fencing Semantics:
 *    To minimize duplicate delivery risk while guaranteeing recovery:
 *    - All state transitions use optimistic concurrency fencing tokens
 *      (attemptCount and lastAttemptAt matching the acquired lease).
 *    - Bounded retry limits: maximum MAX_DELIVERY_ATTEMPTS (3) attempts.
 *    - Exponential retry backoff avoids immediate storming.
 *    - Inline callback actions (e.g. Telegram /paid) are strictly occurrence-idempotent.
 * ============================================================================
 */

export interface ProcessSchedulerTickOptions {
  prismaClient?: any;
  botClient?: any;
  now?: Date;
  clock?: () => Date;
  outboundTimeoutMs?: number;
  beforeDispatch?: (delivery: any) => Promise<void> | void;
}

export interface SchedulerTickResult {
  healthRemindersChecked: number;
  healthRemindersSent: number;
  hydrationSettingsChecked: number;
  hydrationRemindersSent: number;
  obligationsChecked: number;
  debtsChecked?: number;
  loansChecked?: number;
  wealthRemindersSent: number;
}

interface LeaseCheckResult {
  ok: boolean;
  leaseAgeMs: number;
  remainingLeaseMs: number;
  reason?: string;
}

/**
 * Validates exclusive lease ownership and ensures sufficient remaining lease lifetime
 * immediately before initiating an outbound Telegram network call (SOL-R006-004 & SOL-R008).
 *
 * If remaining lease is insufficient for outboundTimeout + safety margin, atomically renews
 * the lease token in the database. If the lease has already expired or renewal fails,
 * aborts dispatch to prevent duplicate sends during concurrent recovery.
 */
async function verifyAndRenewDispatchLease(
  db: any,
  delivery: any,
  getLiveNow: () => Date,
  outboundTimeoutMs: number
): Promise<LeaseCheckResult> {
  const preDispatchTime = getLiveNow();
  const currentLastAttemptAt = delivery.lastAttemptAt
    ? new Date(delivery.lastAttemptAt).getTime()
    : preDispatchTime.getTime();
  const leaseAgeMs = preDispatchTime.getTime() - currentLastAttemptAt;
  const remainingLeaseMs = LEASE_TIMEOUT_MS - leaseAgeMs;
  const minRequiredLeaseMs = outboundTimeoutMs + DISPATCH_SAFETY_MARGIN_MS;

  // 1. Check if lease has already expired
  if (leaseAgeMs >= LEASE_TIMEOUT_MS) {
    return {
      ok: false,
      leaseAgeMs,
      remainingLeaseMs,
      reason: `lease expired (${leaseAgeMs}ms >= ${LEASE_TIMEOUT_MS}ms)`,
    };
  }

  // 2. Ownership check from database if available
  if (typeof db.reminderDelivery?.findUnique === 'function') {
    const currentClaim = await db.reminderDelivery.findUnique({
      where: { id: delivery.id },
      select: { id: true, status: true, attemptCount: true, lastAttemptAt: true },
    });
    if (currentClaim) {
      if (currentClaim.status !== 'SENDING' || currentClaim.attemptCount !== delivery.attemptCount) {
        return {
          ok: false,
          leaseAgeMs,
          remainingLeaseMs,
          reason: `lost ownership (expected SENDING #${delivery.attemptCount}, found ${currentClaim.status} #${currentClaim.attemptCount})`,
        };
      }
      if (
        currentClaim.lastAttemptAt &&
        delivery.lastAttemptAt &&
        new Date(currentClaim.lastAttemptAt).getTime() !== new Date(delivery.lastAttemptAt).getTime()
      ) {
        return {
          ok: false,
          leaseAgeMs,
          remainingLeaseMs,
          reason: 'lost ownership (lastAttemptAt mismatch)',
        };
      }
    }
  }

  // 3. Ensure sufficient lease margin. If remaining lease is insufficient, atomically renew before dispatch
  if (remainingLeaseMs < minRequiredLeaseMs) {
    let renewed = false;
    if (typeof db.reminderDelivery?.updateMany === 'function') {
      const renewRes = await db.reminderDelivery.updateMany({
        where: {
          id: delivery.id,
          status: 'SENDING',
          attemptCount: delivery.attemptCount,
          ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
        },
        data: {
          lastAttemptAt: preDispatchTime,
        },
      });
      if (renewRes && typeof renewRes.count === 'number' && renewRes.count > 0) {
        renewed = true;
        delivery.lastAttemptAt = preDispatchTime;
      }
    } else if (typeof db.reminderDelivery?.update === 'function') {
      await db.reminderDelivery.update({
        where: { id: delivery.id },
        data: { lastAttemptAt: preDispatchTime },
      });
      renewed = true;
      delivery.lastAttemptAt = preDispatchTime;
    }

    if (!renewed) {
      return {
        ok: false,
        leaseAgeMs,
        remainingLeaseMs,
        reason: `insufficient lease (${remainingLeaseMs}ms < ${minRequiredLeaseMs}ms) and atomic renewal failed`,
      };
    }
  }

  return { ok: true, leaseAgeMs, remainingLeaseMs };
}

/**
 * Safe outbound Telegram message sender with strict bounded timeout (SOL-R006-004).
 * Guarantees outbound requests abort long before the 5-minute lease timeout (LEASE_TIMEOUT_MS),
 * preventing dual-tick duplicate sends while a slow request is in flight.
 */
async function sendTelegramMessageWithTimeout(
  bot: any,
  chatId: string | number,
  text: string,
  options?: any,
  timeoutMs: number = OUTBOUND_SEND_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Telegram sendMessage timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  timer.unref?.();

  try {
    const signal = controller.signal;
    return await Promise.race([
      bot.api.sendMessage(chatId, text, { ...options, signal }, signal),
      new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(signal.reason || new Error(`Telegram sendMessage timed out after ${timeoutMs}ms`));
        }, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a single scheduler tick across independent domains:
 * 1. Health / Meal reminders
 * 2. Hydration reminders
 * 3. Wealth & Obligation reminders
 * 4. Personal Debt reminders
 * 5. Loan EMI reminders
 *
 * Each domain is isolated: zero records or an error in one domain never prevents
 * the other domains from processing.
 */
export async function processSchedulerTick(
  options?: ProcessSchedulerTickOptions
): Promise<SchedulerTickResult> {
  const db = options?.prismaClient || prisma;
  const bot = options?.botClient || new Bot(process.env.TELEGRAM_BOT_TOKEN || 'mock');
  const nowOption = options?.now;
  // Fixed calendar reference time for schedule matching (evalTime)
  const calendarNow = nowOption || (options?.clock ? options.clock() : new Date());
  // Live clock for acquisition timestamps, lease age calculations, renewals, and completion tokens
  const getLiveNow: () => Date = options?.clock || (nowOption ? () => nowOption : () => new Date());
  const now = calendarNow;
  const outboundTimeoutMs = options?.outboundTimeoutMs ?? OUTBOUND_SEND_TIMEOUT_MS;

  const result: SchedulerTickResult = {
    healthRemindersChecked: 0,
    healthRemindersSent: 0,
    hydrationSettingsChecked: 0,
    hydrationRemindersSent: 0,
    obligationsChecked: 0,
    debtsChecked: 0,
    loansChecked: 0,
    wealthRemindersSent: 0,
  };

  // --- 1. Health / Meal Reminders ---
  try {
    const activeReminders = await db.reminder.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`[Scheduler] Checking ${activeReminders.length} active reminders...`);
    result.healthRemindersChecked = activeReminders.length;

    for (const reminder of activeReminders) {
      if (!reminder.user.telegramId) continue;

      // Handle legacy and health meal reminders
      if (reminder.category && reminder.time) {
        console.log(`[Scheduler] Reminder: ${reminder.category} at ${reminder.time} for user ${reminder.user.timezone}`);

        const userTimezone = reminder.user.timezone || 'UTC';
        const nowInTz = new TZDate(now, userTimezone);

        // Current time in HH:mm in user's timezone
        const hours = String(nowInTz.getHours()).padStart(2, '0');
        const minutes = String(nowInTz.getMinutes()).padStart(2, '0');
        const currentTimeString = `${hours}:${minutes}`;

        if (currentTimeString === reminder.time) {
          const tzDateString = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(now);
          const [month, day, year] = tzDateString.split('/');
          const tzStart = new TZDate(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0, userTimezone);

          const existingMeal = await db.mealLog.findFirst({
            where: {
              userId: reminder.user.id,
              category: {
                equals: reminder.category,
                mode: 'insensitive',
              },
              createdAt: { gte: tzStart },
            },
          });

          if (!existingMeal) {
            try {
              await sendTelegramMessageWithTimeout(
                bot,
                reminder.user.telegramId,
                `🕒 **Reminder:** It's time for your ${reminder.category}!\n\nSend a photo or type what you're eating to log it.`,
                { parse_mode: 'Markdown' },
                outboundTimeoutMs
              );
              result.healthRemindersSent++;
              console.log(`Sent ${reminder.category} reminder to user ${reminder.user.id}`);
            } catch (telegramErr) {
              console.error(`Failed to send reminder to ${reminder.user.telegramId}:`, telegramErr);
            }
          }
        }
      }
    }
  } catch (healthErr) {
    console.error('[Scheduler] Error processing health/meal reminders:', healthErr);
  }

  // --- 2. Hydration Reminders ---
  try {
    const activeHydrationSettings = await db.hydrationSetting.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`[Scheduler] Checking ${activeHydrationSettings.length} active hydration settings...`);
    result.hydrationSettingsChecked = activeHydrationSettings.length;

    for (const setting of activeHydrationSettings) {
      if (!setting.user.telegramId) continue;

      const userTimezone = setting.user.timezone || 'UTC';
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
              { text: '💧 500ml', callback_data: 'hyd_500' },
            ],
            [
              { text: 'Custom Amount', callback_data: 'hyd_custom' },
            ],
          ];

          try {
            // Delete the previous reminder if it still exists
            const oldMessageId = lastHydrationMessageMap.get(setting.user.id);
            if (oldMessageId && setting.user.telegramId) {
              bot.api.deleteMessage(setting.user.telegramId, oldMessageId).catch(() => {});
            }

            const msg = await sendTelegramMessageWithTimeout(
              bot,
              setting.user.telegramId,
              `💧 **Time to hydrate!**\n\nTake a quick break and drink some water.`,
              {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard },
              },
              outboundTimeoutMs
            );
            result.hydrationRemindersSent++;
            console.log(`Sent hydration reminder to user ${setting.user.id}`);

            // Track the new message
            lastHydrationMessageMap.set(setting.user.id, msg.message_id);

            // Auto-delete after 60 minutes (1 hour)
            const autoDeleteTimer = setTimeout(() => {
              if (setting.user.telegramId && msg.message_id) {
                bot.api.deleteMessage(setting.user.telegramId, msg.message_id).catch(() => {});
              }
            }, 60 * 60 * 1000);
            if (autoDeleteTimer && typeof autoDeleteTimer.unref === 'function') {
              autoDeleteTimer.unref();
            }
          } catch (telegramErr) {
            console.error(`Failed to send hydration reminder to ${setting.user.telegramId}:`, telegramErr);
          }
        }
      }
    }
  } catch (hydErr) {
    console.error('[Scheduler] Error processing hydration reminders:', hydErr);
  }

  // --- 3. Wealth & Obligation Reminders (Unified Engine) ---
  try {
    const activeObligations = await db.obligation.findMany({
      where: { isActive: true, isArchived: false },
      include: { user: true, reminders: true },
    });

    console.log(`[Scheduler] Checking ${activeObligations.length} active obligations...`);
    result.obligationsChecked = activeObligations.length;

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

      const schedules = calculateDeliverySchedules(target, calendarNow);

      for (const sched of schedules) {
        const evalTime = calendarNow;
        const existingDelivery = await db.reminderDelivery.findFirst({
          where: {
            obligationId: ob.id,
            occurrenceKey: sched.occurrenceKey,
            offsetMinutes: sched.offsetMinutes,
            channel: 'TELEGRAM',
          },
        });

        const isClaimExpired = existingDelivery?.status === 'SENDING' &&
          Boolean(existingDelivery?.lastAttemptAt && (evalTime.getTime() - new Date(existingDelivery.lastAttemptAt).getTime() > LEASE_TIMEOUT_MS));

        if (existingDelivery?.status === 'SENDING' && !isClaimExpired) {
          continue;
        }

        const eligibility = shouldDeliverNow({
          scheduledFor: sched.scheduledFor,
          now: evalTime,
          snoozedUntil: existingDelivery?.snoozedUntil,
          isStale: sched.isStale,
          deliveryStatus: (existingDelivery?.status as any) || null,
          attemptCount: existingDelivery?.attemptCount ?? 0,
          lastAttemptAt: existingDelivery?.lastAttemptAt ?? null,
          nextRetryAt: existingDelivery?.nextRetryAt ?? null,
        });

        // SOL-R006-002: Separate lease exclusivity from delivery eligibility.
        // Business eligibility (non-stale, not snoozed, active target) must confirm delivery is eligible.
        if (!eligibility.shouldSend) {
          continue;
        }

        // SOL-R001-008: Exclusively claim delivery attempt before invoking sendMessage
        const claimOperation = async (tx: any) => {
          if (typeof tx.$queryRaw === 'function') {
            await tx.$queryRaw`SELECT id FROM "Obligation" WHERE id = ${ob.id} FOR UPDATE`;
          }

          if (typeof tx.obligation?.findUnique === 'function') {
            const freshOb = await tx.obligation.findUnique({
              where: { id: ob.id },
              select: {
                id: true,
                isActive: true,
                isArchived: true,
                nextDueAt: true,
                reminderOffsetsMin: true,
              }
            });
            if (!freshOb || !freshOb.isActive || freshOb.isArchived || !freshOb.nextDueAt) {
              return null;
            }

            // SOL-R001-008: Revalidate nextDueAt, reminder offsets, and schedule status under target lock
            if (freshOb.nextDueAt.getTime() !== ob.nextDueAt.getTime()) {
              return null;
            }
            const freshOffsets = freshOb.reminderOffsetsMin && freshOb.reminderOffsetsMin.length > 0
              ? freshOb.reminderOffsetsMin
              : [0];
            if (!freshOffsets.includes(sched.offsetMinutes)) {
              return null;
            }
            const freshOccurrenceKey = formatOccurrenceKey(freshOb.nextDueAt);
            if (freshOccurrenceKey !== sched.occurrenceKey) {
              return null;
            }
          }

          let del = await tx.reminderDelivery.findFirst({
            where: {
              obligationId: ob.id,
              occurrenceKey: sched.occurrenceKey,
              offsetMinutes: sched.offsetMinutes,
              channel: 'TELEGRAM',
            },
          });

          const claimAcquisitionTime = getLiveNow();

          if (del) {
            if (del.status === 'SENT' || del.status === 'ACKNOWLEDGED') {
              return null;
            }
            if (del.status === 'SNOOZED' && del.snoozedUntil && new Date(del.snoozedUntil).getTime() > claimAcquisitionTime.getTime()) {
              return null;
            }

            const isDelClaimExpired = del.status === 'SENDING' &&
              Boolean(del.lastAttemptAt && (claimAcquisitionTime.getTime() - new Date(del.lastAttemptAt).getTime() > LEASE_TIMEOUT_MS));

            if (del.status === 'SENDING' && !isDelClaimExpired) {
              return null;
            }

            // SOL-R005-002: If expired lease has exhausted max attempts, mark FAILED and do not renew or resend
            if (isDelClaimExpired && (del.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
              await tx.reminderDelivery.update({
                where: { id: del.id },
                data: {
                  status: 'FAILED',
                  nextRetryAt: null,
                  lastAttemptAt: claimAcquisitionTime,
                },
              });
              return null;
            }

            const recheck = shouldDeliverNow({
              scheduledFor: sched.scheduledFor,
              now: calendarNow,
              snoozedUntil: del.snoozedUntil,
              isStale: sched.isStale,
              deliveryStatus: del.status as any,
              attemptCount: del.attemptCount ?? 0,
              lastAttemptAt: del.lastAttemptAt ?? null,
              nextRetryAt: del.nextRetryAt ?? null,
            });
            // SOL-R006-002: Expired leases may ONLY be renewed if business recheck confirms eligibility.
            // Stale occurrences (> 7 days past due) are suppressed and NOT resent upon lease expiration.
            if (!recheck.shouldSend) {
              return null;
            }

            if ((del.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
              return null;
            }

            // SOL-R003-004 & SOL-R006-004: Increment attemptCount on renewal as fencing token with fresh acquisition time
            const nextAttemptCount = (del.attemptCount || 0) + 1;
            const updated = await tx.reminderDelivery.update({
              where: { id: del.id },
              data: {
                status: 'SENDING',
                attemptCount: nextAttemptCount,
                lastAttemptAt: claimAcquisitionTime,
              },
            });
            return updated;
          }

          // No delivery exists yet: find or create unique reminder for this obligation
          let reminder = ob.reminders?.[0] || (typeof tx.reminder?.findFirst === 'function' ? await tx.reminder.findFirst({
            where: { obligationId: ob.id },
            select: { id: true },
          }) : null);

          if (!reminder && typeof tx.reminder?.create === 'function') {
            reminder = await tx.reminder.create({
              data: {
                userId: ob.userId,
                domain: 'FINANCE',
                type: 'OBLIGATION',
                title: ob.title,
                obligationId: ob.id,
                isActive: true,
              },
            });
          }

          // Evaluate eligibility for brand new delivery claim using calendar evaluation time
          const newEligibility = shouldDeliverNow({
            scheduledFor: sched.scheduledFor,
            now: calendarNow,
            snoozedUntil: null,
            isStale: sched.isStale,
            deliveryStatus: null,
            attemptCount: 0,
            lastAttemptAt: null,
            nextRetryAt: null,
          });
          if (!newEligibility.shouldSend) {
            return null;
          }

          // Create new exclusively claimed delivery with attemptCount: 1 and fresh lastAttemptAt
          del = await tx.reminderDelivery.create({
            data: {
              userId: ob.userId,
              reminderId: reminder.id,
              obligationId: ob.id,
              occurrenceKey: sched.occurrenceKey,
              scheduledFor: sched.scheduledFor,
              offsetMinutes: sched.offsetMinutes,
              channel: 'TELEGRAM',
              status: 'SENDING',
              attemptCount: 1,
              lastAttemptAt: claimAcquisitionTime,
            },
          });
          return del;
        };

        let delivery: any = null;
        try {
          delivery = typeof db.$transaction === 'function'
            ? await db.$transaction(claimOperation)
            : await claimOperation(db);
        } catch {
          // Concurrent constraint or conflict error -> already claimed
          continue;
        }

        if (!delivery) {
          continue;
        }

        if (options?.beforeDispatch) {
          await options.beforeDispatch(delivery);
        }

        // Business & schedule eligibility recheck before dispatch (SOL-R008-002)
        if (typeof db.obligation?.findUnique === 'function') {
          const freshOb = await db.obligation.findUnique({
            where: { id: ob.id },
            select: {
              id: true,
              isActive: true,
              isArchived: true,
              nextDueAt: true,
              reminderOffsetsMin: true,
            },
          });
          if (!freshOb || !freshOb.isActive || freshOb.isArchived || !freshOb.nextDueAt) {
            console.warn(`[Scheduler] Obligation ${ob.id} no longer eligible or missing nextDueAt before dispatch`);
            continue;
          }
          if (freshOb.nextDueAt.getTime() !== ob.nextDueAt.getTime()) {
            console.warn(`[Scheduler] Obligation ${ob.id} nextDueAt changed before dispatch (${ob.nextDueAt.toISOString()} -> ${freshOb.nextDueAt.toISOString()})`);
            continue;
          }
          const freshOffsets = freshOb.reminderOffsetsMin && freshOb.reminderOffsetsMin.length > 0
            ? freshOb.reminderOffsetsMin
            : [0];
          if (!freshOffsets.includes(sched.offsetMinutes)) {
            console.warn(`[Scheduler] Obligation ${ob.id} offset ${sched.offsetMinutes} removed before dispatch`);
            continue;
          }
          const freshOccurrenceKey = formatOccurrenceKey(freshOb.nextDueAt);
          if (freshOccurrenceKey !== sched.occurrenceKey) {
            console.warn(`[Scheduler] Obligation ${ob.id} occurrenceKey changed before dispatch (${sched.occurrenceKey} -> ${freshOccurrenceKey})`);
            continue;
          }
        }
        if (typeof db.obligationOccurrence?.findFirst === 'function') {
          const completedOcc = await db.obligationOccurrence.findFirst({
            where: {
              obligationId: ob.id,
              occurrenceKey: sched.occurrenceKey,
              status: { in: ['COMPLETED', 'COMPLETED_HISTORICAL'] },
            },
            select: { id: true },
          });
          if (completedOcc) {
            console.warn(`[Scheduler] Obligation ${ob.id} occurrence ${sched.occurrenceKey} already completed before dispatch`);
            continue;
          }
        }

        // SOL-R006-004: Validate lease ownership and atomically renew or reject before dispatch
        const leaseVerification = await verifyAndRenewDispatchLease(
          db,
          delivery,
          getLiveNow,
          outboundTimeoutMs
        );
        if (!leaseVerification.ok) {
          console.warn(`[Scheduler] Delivery ${delivery.id} aborted before dispatch: ${leaseVerification.reason}`);
          continue;
        }

        const preEligibility = shouldDeliverNow({
          scheduledFor: sched.scheduledFor,
          now: calendarNow,
          snoozedUntil: delivery.snoozedUntil,
          isStale: sched.isStale,
          deliveryStatus: delivery.status as any,
          attemptCount: (delivery.attemptCount || 1) - 1,
          lastAttemptAt: delivery.lastAttemptAt ?? null,
          nextRetryAt: delivery.nextRetryAt ?? null,
        });
        if (!preEligibility.shouldSend && !preEligibility.reason.includes('Retry')) {
          console.warn(`[Scheduler] Delivery ${delivery.id} no longer eligible before dispatch: ${preEligibility.reason}`);
          continue;
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
          const sent = await sendTelegramMessageWithTimeout(
            bot,
            ob.user.telegramId,
            payload.text,
            {
              parse_mode: 'Markdown',
              reply_markup: payload.reply_markup,
            },
            outboundTimeoutMs
          );

          const sendFinishTime = getLiveNow();
          const claimedAttemptCount = delivery.attemptCount || 1;
          const successState = evaluateDeliverySuccess({
            currentAttemptCount: claimedAttemptCount - 1,
            sentAt: sendFinishTime,
          });

          const updateSuccessData = {
            status: successState.status,
            sentAt: successState.sentAt,
            telegramMessageId: sent.message_id,
            attemptCount: claimedAttemptCount,
            lastAttemptAt: successState.lastAttemptAt,
            nextRetryAt: successState.nextRetryAt,
          };

          let updateRes: any = null;
          if (typeof db.reminderDelivery?.updateMany === 'function') {
            updateRes = await db.reminderDelivery.updateMany({
              where: {
                id: delivery.id,
                status: 'SENDING',
                attemptCount: claimedAttemptCount,
                ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
              },
              data: updateSuccessData,
            });
          } else if (typeof db.reminderDelivery?.update === 'function') {
            updateRes = await db.reminderDelivery.update({
              where: { id: delivery.id },
              data: updateSuccessData,
            });
          }
          if (updateRes && typeof updateRes.count === 'number' && updateRes.count === 0) {
            console.warn(`[Scheduler] Delivery ${delivery.id} was fenced out (0 rows updated)`);
            continue;
          }
          result.wealthRemindersSent++;
          console.log(`[Scheduler] Sent bill reminder ${ob.title} to user ${ob.user.id}`);
        } catch (sendErr: any) {
          const sendFailTime = getLiveNow();
          const claimedAttemptCount = delivery.attemptCount || 1;
          const failureState = evaluateDeliveryFailure({
            currentAttemptCount: claimedAttemptCount - 1,
            failedAt: sendFailTime,
            failureReason: sendErr?.message || 'Send error',
          });

          const updateFailData = {
            status: failureState.status,
            failureReason: failureState.failureReason,
            attemptCount: claimedAttemptCount,
            lastAttemptAt: failureState.lastAttemptAt,
            nextRetryAt: failureState.nextRetryAt,
          };

          if (typeof db.reminderDelivery?.updateMany === 'function') {
            await db.reminderDelivery.updateMany({
              where: {
                id: delivery.id,
                status: 'SENDING',
                attemptCount: claimedAttemptCount,
                ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
              },
              data: updateFailData,
            });
          } else if (typeof db.reminderDelivery?.update === 'function') {
            await db.reminderDelivery.update({
              where: { id: delivery.id },
              data: updateFailData,
            });
          }
          console.error(
            `[Scheduler] Delivery attempt ${failureState.attemptCount}/${MAX_DELIVERY_ATTEMPTS} failed for reminder ${ob.title}:`,
            sendErr?.message
          );
        }
      }
    }
  } catch (wealthErr) {
    console.error('[Scheduler] Error in wealth obligation processing:', wealthErr);
  }

  // --- 4. Personal Debt Reminders ---
  try {
    if (typeof db.personalDebt?.findMany === 'function') {
      const activeDebts = await db.personalDebt.findMany({
        where: {
          status: 'OPEN',
          dueAt: { not: null },
        },
        include: { user: true, transactions: true },
      });

      result.debtsChecked = activeDebts.length;

      for (const debt of activeDebts) {
        if (!debt.user?.telegramId || !debt.dueAt) continue;
        const outstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, debt.transactions || []);
        if (outstanding.lte(0)) continue;

        const target: ObligationDeliveryTarget = {
          id: debt.id,
          userId: debt.userId,
          title: debt.title || `${debt.direction === 'RECEIVABLE' ? 'Lent to' : 'Borrowed from'} ${debt.counterpartyName}`,
          kind: 'DEBT',
          amount: outstanding.toString(),
          nextDueAt: debt.dueAt,
          reminderOffsetsMin: debt.reminderOffsetsMin && debt.reminderOffsetsMin.length > 0 ? debt.reminderOffsetsMin : [0],
          isActive: debt.status === 'OPEN',
          isArchived: debt.status === 'ARCHIVED',
        };

        const schedules = calculateDeliverySchedules(target, calendarNow);

        for (const sched of schedules) {
          const claimOperation = async (tx: any) => {
            if (typeof tx.$queryRaw === 'function') {
              try {
                await tx.$queryRaw`SELECT id FROM "PersonalDebt" WHERE id = ${debt.id} FOR UPDATE`;
              } catch {
                // Ignore if raw lock not supported in mock / test DB
              }
            }

            if (typeof tx.personalDebt?.findUnique === 'function') {
              const currentDebt = await tx.personalDebt.findUnique({
                where: { id: debt.id },
                include: { transactions: true },
              });
              if (!currentDebt || currentDebt.status !== 'OPEN' || !currentDebt.dueAt) {
                return null;
              }

              // SOL-R001-008: Revalidate dueAt, offsets, and schedule identity under lock
              if (currentDebt.dueAt.getTime() !== debt.dueAt.getTime()) {
                return null;
              }
              const freshOffsets = currentDebt.reminderOffsetsMin && currentDebt.reminderOffsetsMin.length > 0
                ? currentDebt.reminderOffsetsMin
                : [0];
              if (!freshOffsets.includes(sched.offsetMinutes)) {
                return null;
              }
              const freshOccurrenceKey = formatOccurrenceKey(currentDebt.dueAt);
              if (freshOccurrenceKey !== sched.occurrenceKey) {
                return null;
              }

              const currentOutstanding = calculateDebtOutstanding(
                currentDebt.direction,
                currentDebt.originalAmount,
                currentDebt.transactions || []
              );
              if (currentOutstanding.lte(0)) {
                return null;
              }
            }

            const claimAcquisitionTime = getLiveNow();

            let reminder = typeof tx.reminder?.findFirst === 'function' ? await tx.reminder.findFirst({
              where: {
                userId: debt.userId,
                domain: 'FINANCE',
                type: 'PERSONAL_DEBT',
                category: debt.id,
              },
            }) : null;

            if (!reminder && typeof tx.reminder?.create === 'function') {
              try {
                reminder = await tx.reminder.create({
                  data: {
                    userId: debt.userId,
                    domain: 'FINANCE',
                    type: 'PERSONAL_DEBT',
                    category: debt.id,
                    title: target.title,
                    isActive: true,
                  },
                });
              } catch {
                reminder = typeof tx.reminder?.findFirst === 'function' ? await tx.reminder.findFirst({
                  where: {
                    userId: debt.userId,
                    domain: 'FINANCE',
                    type: 'PERSONAL_DEBT',
                    category: debt.id,
                  },
                }) : null;
              }
            }

            if (!reminder) return null;

            let del = typeof tx.reminderDelivery?.findFirst === 'function' ? await tx.reminderDelivery.findFirst({
              where: {
                reminderId: reminder.id,
                occurrenceKey: sched.occurrenceKey,
                offsetMinutes: sched.offsetMinutes,
                channel: 'TELEGRAM',
              },
            }) : null;

            if (del) {
              if (del.status === 'SENT') {
                return null;
              }

              const isDelClaimExpired = del.status === 'SENDING' &&
                Boolean(del.lastAttemptAt && (claimAcquisitionTime.getTime() - new Date(del.lastAttemptAt).getTime() > LEASE_TIMEOUT_MS));

              if (del.status === 'SENDING' && !isDelClaimExpired) {
                return null;
              }

              // SOL-R005-002: If expired lease has exhausted max attempts, mark FAILED and do not renew or resend
              if (isDelClaimExpired && (del.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
                await tx.reminderDelivery.update({
                  where: { id: del.id },
                  data: {
                    status: 'FAILED',
                    nextRetryAt: null,
                    lastAttemptAt: claimAcquisitionTime,
                  },
                });
                return null;
              }

              const recheck = shouldDeliverNow({
                scheduledFor: sched.scheduledFor,
                now: calendarNow,
                snoozedUntil: del.snoozedUntil,
                isStale: sched.isStale,
                deliveryStatus: del.status as any,
                attemptCount: del.attemptCount ?? 0,
                lastAttemptAt: del.lastAttemptAt ?? null,
                nextRetryAt: del.nextRetryAt ?? null,
              });
              // SOL-R006-002: Expired leases may ONLY be renewed if business recheck confirms eligibility.
              // Stale occurrences (> 7 days past due) are suppressed and NOT resent upon lease expiration.
              if (!recheck.shouldSend) {
                return null;
              }

              if ((del.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
                return null;
              }

              // SOL-R003-004 & SOL-R006-004: Increment attemptCount on renewal as fencing token with fresh acquisition time
              const nextAttemptCount = (del.attemptCount || 0) + 1;
              const updated = await tx.reminderDelivery.update({
                where: { id: del.id },
                data: {
                  status: 'SENDING',
                  attemptCount: nextAttemptCount,
                  lastAttemptAt: claimAcquisitionTime,
                },
              });
              return updated;
            }

            // SOL-R003-001: Evaluate shouldDeliverNow before creating new delivery claim using calendar evaluation time
            const newEligibility = shouldDeliverNow({
              scheduledFor: sched.scheduledFor,
              now: calendarNow,
              snoozedUntil: null,
              isStale: sched.isStale,
              deliveryStatus: null,
              attemptCount: 0,
              lastAttemptAt: null,
              nextRetryAt: null,
            });
            if (!newEligibility.shouldSend) {
              return null;
            }

            del = await tx.reminderDelivery.create({
              data: {
                userId: debt.userId,
                reminderId: reminder.id,
                occurrenceKey: sched.occurrenceKey,
                scheduledFor: sched.scheduledFor,
                offsetMinutes: sched.offsetMinutes,
                channel: 'TELEGRAM',
                status: 'SENDING',
                attemptCount: 1,
                lastAttemptAt: claimAcquisitionTime,
              },
            });
            return del;
          };

          let delivery: any = null;
          try {
            delivery = typeof db.$transaction === 'function'
              ? await db.$transaction(claimOperation)
              : await claimOperation(db);
          } catch {
            continue;
          }

          if (!delivery) {
            continue;
          }

          if (options?.beforeDispatch) {
            await options.beforeDispatch(delivery);
          }

          // Business & schedule eligibility recheck before dispatch (SOL-R008-002)
          if (typeof db.personalDebt?.findUnique === 'function') {
            const freshDebt = await db.personalDebt.findUnique({
              where: { id: debt.id },
              include: { transactions: true },
            });
            if (!freshDebt || freshDebt.status !== 'OPEN' || !freshDebt.dueAt) {
              console.warn(`[Scheduler] Debt ${debt.id} no longer OPEN or missing dueAt before dispatch`);
              continue;
            }
            if (freshDebt.dueAt.getTime() !== debt.dueAt.getTime()) {
              console.warn(`[Scheduler] Debt ${debt.id} dueAt changed before dispatch (${debt.dueAt.toISOString()} -> ${freshDebt.dueAt.toISOString()})`);
              continue;
            }
            const freshOffsets = freshDebt.reminderOffsetsMin && freshDebt.reminderOffsetsMin.length > 0
              ? freshDebt.reminderOffsetsMin
              : [0];
            if (!freshOffsets.includes(sched.offsetMinutes)) {
              console.warn(`[Scheduler] Debt ${debt.id} offset ${sched.offsetMinutes} removed before dispatch`);
              continue;
            }
            const freshOccurrenceKey = formatOccurrenceKey(freshDebt.dueAt);
            if (freshOccurrenceKey !== sched.occurrenceKey) {
              console.warn(`[Scheduler] Debt ${debt.id} occurrenceKey changed before dispatch (${sched.occurrenceKey} -> ${freshOccurrenceKey})`);
              continue;
            }
            const currentOutstanding = calculateDebtOutstanding(
              freshDebt.direction,
              freshDebt.originalAmount,
              freshDebt.transactions || []
            );
            if (currentOutstanding.lte(0)) {
              console.warn(`[Scheduler] Debt ${debt.id} has no outstanding balance before dispatch`);
              continue;
            }
          }

          // SOL-R006-004: Validate lease ownership and atomically renew or reject before dispatch
          const leaseVerification = await verifyAndRenewDispatchLease(
            db,
            delivery,
            getLiveNow,
            outboundTimeoutMs
          );
          if (!leaseVerification.ok) {
            console.warn(`[Scheduler] Debt delivery ${delivery.id} aborted before dispatch: ${leaseVerification.reason}`);
            continue;
          }

          const preEligibility = shouldDeliverNow({
            scheduledFor: sched.scheduledFor,
            now: calendarNow,
            snoozedUntil: delivery.snoozedUntil,
            isStale: sched.isStale,
            deliveryStatus: delivery.status as any,
            attemptCount: (delivery.attemptCount || 1) - 1,
            lastAttemptAt: delivery.lastAttemptAt ?? null,
            nextRetryAt: delivery.nextRetryAt ?? null,
          });
          if (!preEligibility.shouldSend && !preEligibility.reason.includes('Retry')) {
            console.warn(`[Scheduler] Debt delivery ${delivery.id} no longer eligible before dispatch: ${preEligibility.reason}`);
            continue;
          }

          const payload = formatTelegramDebtReminder({
            debtId: debt.id,
            direction: debt.direction,
            counterpartyName: debt.counterpartyName,
            amount: outstanding.toString(),
            dueDate: debt.dueAt,
            offsetMinutes: sched.offsetMinutes,
            appBaseUrl: process.env.NEXTAUTH_URL || 'https://nutrisnap.app',
          });

          try {
            const sent = await sendTelegramMessageWithTimeout(
              bot,
              debt.user.telegramId,
              payload.text,
              {
                parse_mode: 'Markdown',
                reply_markup: payload.reply_markup,
              },
              outboundTimeoutMs
            );

            const sendFinishTime = getLiveNow();
            const claimedAttemptCount = delivery.attemptCount || 1;
            const successState = evaluateDeliverySuccess({
              currentAttemptCount: claimedAttemptCount - 1,
              sentAt: sendFinishTime,
            });

            const updateSuccessData = {
              status: successState.status,
              sentAt: successState.sentAt,
              telegramMessageId: sent.message_id,
              attemptCount: claimedAttemptCount,
              lastAttemptAt: successState.lastAttemptAt,
              nextRetryAt: successState.nextRetryAt,
            };

            let updateRes: any = null;
            if (typeof db.reminderDelivery?.updateMany === 'function') {
              updateRes = await db.reminderDelivery.updateMany({
                where: {
                  id: delivery.id,
                  status: 'SENDING',
                  attemptCount: claimedAttemptCount,
                  ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
                },
                data: updateSuccessData,
              });
            } else if (typeof db.reminderDelivery?.update === 'function') {
              updateRes = await db.reminderDelivery.update({
                where: { id: delivery.id },
                data: updateSuccessData,
              });
            }
            if (updateRes && typeof updateRes.count === 'number' && updateRes.count === 0) {
              console.warn(`[Scheduler] Debt delivery ${delivery.id} was fenced out (0 rows updated)`);
              continue;
            }
            result.wealthRemindersSent++;
            console.log(`[Scheduler] Sent debt reminder ${debt.id} to user ${debt.user.id}`);
          } catch (sendErr: any) {
            const sendFailTime = getLiveNow();
            const claimedAttemptCount = delivery.attemptCount || 1;
            const failureState = evaluateDeliveryFailure({
              currentAttemptCount: claimedAttemptCount - 1,
              failedAt: sendFailTime,
              failureReason: sendErr?.message || 'Send error',
            });

            const updateFailData = {
              status: failureState.status,
              failureReason: failureState.failureReason,
              attemptCount: claimedAttemptCount,
              lastAttemptAt: failureState.lastAttemptAt,
              nextRetryAt: failureState.nextRetryAt,
            };

            if (typeof db.reminderDelivery?.updateMany === 'function') {
              await db.reminderDelivery.updateMany({
                where: {
                  id: delivery.id,
                  status: 'SENDING',
                  attemptCount: claimedAttemptCount,
                  ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
                },
                data: updateFailData,
              });
            } else if (typeof db.reminderDelivery?.update === 'function') {
              await db.reminderDelivery.update({
                where: { id: delivery.id },
                data: updateFailData,
              });
            }
            console.error(
              `[Scheduler] Delivery attempt ${failureState.attemptCount}/${MAX_DELIVERY_ATTEMPTS} failed for reminder ${debt.id}:`,
              sendErr?.message
            );
          }
        }
      }
    }
  } catch (debtErr) {
    console.error('[Scheduler] Error in debt reminder processing:', debtErr);
  }

  // --- 5. Unlinked Loan EMI Reminders ---
  try {
    if (typeof db.loan?.findMany === 'function') {
      const activeLoans = await db.loan.findMany({
        where: {
          status: 'ACTIVE',
          obligationId: null,
          nextEmiDate: { not: null },
        },
        include: { user: true },
      });

      result.loansChecked = activeLoans.length;

      for (const loan of activeLoans) {
        try {
          if (!loan.user?.telegramId || !loan.nextEmiDate) continue;

          const target: ObligationDeliveryTarget = {
            id: loan.id,
            userId: loan.userId,
            title: loan.name,
            kind: 'EMI',
            amount: loan.emiAmount ? loan.emiAmount.toString() : null,
            nextDueAt: loan.nextEmiDate,
            reminderOffsetsMin: [0],
            isActive: loan.status === 'ACTIVE',
            isArchived: loan.status === 'ARCHIVED',
          };

          const schedules = calculateDeliverySchedules(target, calendarNow);

          for (const sched of schedules) {
            const claimOperation = async (tx: any) => {
              if (typeof tx.$queryRaw === 'function') {
                try {
                  await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loan.id} FOR UPDATE`;
                } catch {
                  // Ignore if raw lock not supported in mock / test DB
                }
              }

              if (typeof tx.loan?.findUnique === 'function') {
                const currentLoan = await tx.loan.findUnique({
                  where: { id: loan.id },
                });
                if (!currentLoan || currentLoan.status !== 'ACTIVE' || !currentLoan.nextEmiDate || currentLoan.obligationId) {
                  return null;
                }

                // SOL-R001-008: Revalidate nextEmiDate and occurrenceKey under lock
                if (currentLoan.nextEmiDate.getTime() !== loan.nextEmiDate.getTime()) {
                  return null;
                }
                const freshOccurrenceKey = formatOccurrenceKey(currentLoan.nextEmiDate);
                if (freshOccurrenceKey !== sched.occurrenceKey) {
                  return null;
                }
              }

              const claimAcquisitionTime = getLiveNow();

              let reminder = typeof tx.reminder?.findFirst === 'function' ? await tx.reminder.findFirst({
                where: {
                  userId: loan.userId,
                  domain: 'FINANCE',
                  type: 'LOAN_EMI',
                  category: loan.id,
                },
              }) : null;

              if (!reminder && typeof tx.reminder?.create === 'function') {
                try {
                  reminder = await tx.reminder.create({
                    data: {
                      userId: loan.userId,
                      domain: 'FINANCE',
                      type: 'LOAN_EMI',
                      category: loan.id,
                      title: loan.name,
                      isActive: true,
                    },
                  });
                } catch {
                  reminder = typeof tx.reminder?.findFirst === 'function' ? await tx.reminder.findFirst({
                    where: {
                      userId: loan.userId,
                      domain: 'FINANCE',
                      type: 'LOAN_EMI',
                      category: loan.id,
                    },
                  }) : null;
                }
              }

              if (!reminder) return null;

              let del = typeof tx.reminderDelivery?.findFirst === 'function' ? await tx.reminderDelivery.findFirst({
                where: {
                  reminderId: reminder.id,
                  occurrenceKey: sched.occurrenceKey,
                  offsetMinutes: sched.offsetMinutes,
                  channel: 'TELEGRAM',
                },
              }) : null;

              if (del) {
                if (del.status === 'SENT') {
                  return null;
                }

                const isDelClaimExpired = del.status === 'SENDING' &&
                  Boolean(del.lastAttemptAt && (claimAcquisitionTime.getTime() - new Date(del.lastAttemptAt).getTime() > LEASE_TIMEOUT_MS));

                if (del.status === 'SENDING' && !isDelClaimExpired) {
                  return null;
                }

                // SOL-R005-002: If expired lease has exhausted max attempts, mark FAILED and do not renew or resend
                if (isDelClaimExpired && (del.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
                  await tx.reminderDelivery.update({
                    where: { id: del.id },
                    data: {
                      status: 'FAILED',
                      nextRetryAt: null,
                      lastAttemptAt: claimAcquisitionTime,
                    },
                  });
                  return null;
                }

                const recheck = shouldDeliverNow({
                  scheduledFor: sched.scheduledFor,
                  now: calendarNow,
                  snoozedUntil: del.snoozedUntil,
                  isStale: sched.isStale,
                  deliveryStatus: del.status as any,
                  attemptCount: del.attemptCount ?? 0,
                  lastAttemptAt: del.lastAttemptAt ?? null,
                  nextRetryAt: del.nextRetryAt ?? null,
                });
                // SOL-R006-002: Expired leases may ONLY be renewed if business recheck confirms eligibility.
                // Stale occurrences (> 7 days past due) are suppressed and NOT resent upon lease expiration.
                if (!recheck.shouldSend) {
                  return null;
                }

                if ((del.attemptCount || 0) >= MAX_DELIVERY_ATTEMPTS) {
                  return null;
                }

                // SOL-R003-004 & SOL-R006-004: Increment attemptCount on renewal as fencing token with fresh acquisition time
                const nextAttemptCount = (del.attemptCount || 0) + 1;
                const updated = await tx.reminderDelivery.update({
                  where: { id: del.id },
                  data: {
                    status: 'SENDING',
                    attemptCount: nextAttemptCount,
                    lastAttemptAt: claimAcquisitionTime,
                  },
                });
                return updated;
              }

              // SOL-R003-001: Evaluate shouldDeliverNow before creating new delivery claim using calendar evaluation time
              const newEligibility = shouldDeliverNow({
                scheduledFor: sched.scheduledFor,
                now: calendarNow,
                snoozedUntil: null,
                isStale: sched.isStale,
                deliveryStatus: null,
                attemptCount: 0,
                lastAttemptAt: null,
                nextRetryAt: null,
              });
              if (!newEligibility.shouldSend) {
                return null;
              }

              del = await tx.reminderDelivery.create({
                data: {
                  userId: loan.userId,
                  reminderId: reminder.id,
                  occurrenceKey: sched.occurrenceKey,
                  scheduledFor: sched.scheduledFor,
                  offsetMinutes: sched.offsetMinutes,
                  channel: 'TELEGRAM',
                  status: 'SENDING',
                  attemptCount: 1,
                  lastAttemptAt: claimAcquisitionTime,
                },
              });
              return del;
            };

            let delivery: any = null;
            try {
              delivery = typeof db.$transaction === 'function'
                ? await db.$transaction(claimOperation)
                : await claimOperation(db);
            } catch {
              continue;
            }

            if (!delivery) {
              continue;
            }

            if (options?.beforeDispatch) {
              await options.beforeDispatch(delivery);
            }

            // Business & schedule eligibility recheck before dispatch (SOL-R008-001 & SOL-R008-002)
            if (typeof db.loan?.findUnique === 'function') {
              const freshLoan = await db.loan.findUnique({
                where: { id: loan.id },
                select: {
                  id: true,
                  status: true,
                  nextEmiDate: true,
                  obligationId: true,
                },
              });
              if (!freshLoan || freshLoan.status !== 'ACTIVE' || freshLoan.obligationId || !freshLoan.nextEmiDate) {
                console.warn(`[Scheduler] Loan ${loan.id} no longer eligible or missing nextEmiDate before dispatch`);
                continue;
              }
              if (freshLoan.nextEmiDate.getTime() !== loan.nextEmiDate.getTime()) {
                console.warn(`[Scheduler] Loan ${loan.id} nextEmiDate changed before dispatch (${loan.nextEmiDate.toISOString()} -> ${freshLoan.nextEmiDate.toISOString()})`);
                continue;
              }
              const freshOccurrenceKey = formatOccurrenceKey(freshLoan.nextEmiDate);
              if (freshOccurrenceKey !== sched.occurrenceKey) {
                console.warn(`[Scheduler] Loan ${loan.id} occurrenceKey changed before dispatch (${sched.occurrenceKey} -> ${freshOccurrenceKey})`);
                continue;
              }
            }

            // SOL-R006-004: Validate lease ownership and atomically renew or reject before dispatch
            const leaseVerification = await verifyAndRenewDispatchLease(
              db,
              delivery,
              getLiveNow,
              outboundTimeoutMs
            );
            if (!leaseVerification.ok) {
              console.warn(`[Scheduler] Loan delivery ${delivery.id} aborted before dispatch: ${leaseVerification.reason}`);
              continue;
            }

            const preEligibility = shouldDeliverNow({
              scheduledFor: sched.scheduledFor,
              now: calendarNow,
              snoozedUntil: delivery.snoozedUntil,
              isStale: sched.isStale,
              deliveryStatus: delivery.status as any,
              attemptCount: (delivery.attemptCount || 1) - 1,
              lastAttemptAt: delivery.lastAttemptAt ?? null,
              nextRetryAt: delivery.nextRetryAt ?? null,
            });
            if (!preEligibility.shouldSend && !preEligibility.reason.includes('Retry')) {
              console.warn(`[Scheduler] Loan delivery ${delivery.id} no longer eligible before dispatch: ${preEligibility.reason}`);
              continue;
            }

            const payload = formatTelegramLoanEmiReminder({
              loanId: loan.id,
              name: loan.name,
              lender: loan.lender,
              emiAmount: loan.emiAmount ? loan.emiAmount.toString() : null,
              dueDate: loan.nextEmiDate,
              offsetMinutes: sched.offsetMinutes,
              appBaseUrl: process.env.NEXTAUTH_URL || 'https://nutrisnap.app',
            });

            try {
              const sent = await sendTelegramMessageWithTimeout(
                bot,
                loan.user.telegramId,
                payload.text,
                {
                  parse_mode: 'Markdown',
                  reply_markup: payload.reply_markup,
                },
                outboundTimeoutMs
              );

              const sendFinishTime = getLiveNow();
              const claimedAttemptCount = delivery.attemptCount || 1;
              const successState = evaluateDeliverySuccess({
                currentAttemptCount: claimedAttemptCount - 1,
                sentAt: sendFinishTime,
              });

              const updateSuccessData = {
                status: successState.status,
                sentAt: successState.sentAt,
                telegramMessageId: sent.message_id,
                attemptCount: claimedAttemptCount,
                lastAttemptAt: successState.lastAttemptAt,
                nextRetryAt: successState.nextRetryAt,
              };

              let updateRes: any = null;
              if (typeof db.reminderDelivery?.updateMany === 'function') {
                updateRes = await db.reminderDelivery.updateMany({
                  where: {
                    id: delivery.id,
                    status: 'SENDING',
                    attemptCount: claimedAttemptCount,
                    ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
                  },
                  data: updateSuccessData,
                });
              } else if (typeof db.reminderDelivery?.update === 'function') {
                updateRes = await db.reminderDelivery.update({
                  where: { id: delivery.id },
                  data: updateSuccessData,
                });
              }
              if (updateRes && typeof updateRes.count === 'number' && updateRes.count === 0) {
                console.warn(`[Scheduler] Loan delivery ${delivery.id} was fenced out (0 rows updated)`);
                continue;
              }
              result.wealthRemindersSent++;
              console.log(`[Scheduler] Sent loan EMI reminder ${loan.id} to user ${loan.user.id}`);
            } catch (sendErr: any) {
              const sendFailTime = getLiveNow();
              const claimedAttemptCount = delivery.attemptCount || 1;
              const failureState = evaluateDeliveryFailure({
                currentAttemptCount: claimedAttemptCount - 1,
                failedAt: sendFailTime,
                failureReason: sendErr?.message || 'Send error',
              });

              const updateFailData = {
                status: failureState.status,
                failureReason: failureState.failureReason,
                attemptCount: claimedAttemptCount,
                lastAttemptAt: failureState.lastAttemptAt,
                nextRetryAt: failureState.nextRetryAt,
              };

              if (typeof db.reminderDelivery?.updateMany === 'function') {
                await db.reminderDelivery.updateMany({
                  where: {
                    id: delivery.id,
                    status: 'SENDING',
                    attemptCount: claimedAttemptCount,
                    ...(delivery.lastAttemptAt ? { lastAttemptAt: delivery.lastAttemptAt } : {}),
                  },
                  data: updateFailData,
                });
              } else if (typeof db.reminderDelivery?.update === 'function') {
                await db.reminderDelivery.update({
                  where: { id: delivery.id },
                  data: updateFailData,
                });
              }
              console.error(
                `[Scheduler] Delivery attempt ${failureState.attemptCount}/${MAX_DELIVERY_ATTEMPTS} failed for reminder ${loan.id}:`,
                sendErr?.message
              );
            }
          }
        } catch (loanTargetErr: any) {
          console.error(`[Scheduler] Error processing loan target ${loan.id}:`, loanTargetErr);
        }
      }
    }
  } catch (loanErr) {
    console.error('[Scheduler] Error in loan reminder processing:', loanErr);
  }

  return result;
}

export function startScheduler() {
  if (isStarted) return;
  isStarted = true;

  console.log('✅ Background Scheduler Started');
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || 'mock');

  // Run every minute at the start of the minute
  cron.schedule('* * * * *', async () => {
    try {
      await processSchedulerTick({ prismaClient: prisma, botClient: bot });
    } catch (err) {
      console.error('Error in cron scheduler:', err);
    }
  });
}
