import { getOccurrenceKey } from '@/lib/recurrence/recurrence';
import { Decimal } from '@/lib/finance/finance';

export const formatOccurrenceKey = getOccurrenceKey;

export interface DeliveryScheduleItem {
  occurrenceKey: string;
  scheduledFor: Date;
  offsetMinutes: number;
  isStale: boolean;
}

export interface ObligationDeliveryTarget {
  id: string;
  userId: string;
  title: string;
  kind: string;
  amount: string | null;
  nextDueAt: Date;
  reminderOffsetsMin: number[];
  isActive: boolean;
  isArchived: boolean;
  snoozedUntil?: Date | null;
}

/**
 * Calculates delivery times for all notification offsets of an obligation.
 * Standard offsets:
 * - 0 = due day / exact time
 * - 1440 = 1 day before (24 hours)
 * - 4320 = 3 days before (72 hours)
 * - 10080 = 7 days before (168 hours)
 */
export function calculateDeliverySchedules(
  obligation: ObligationDeliveryTarget,
  now: Date = new Date(),
  staleThresholdDays: number = 7
): DeliveryScheduleItem[] {
  if (!obligation.isActive || obligation.isArchived) {
    return [];
  }

  const occurrenceKey = formatOccurrenceKey(obligation.nextDueAt);
  const dueTime = obligation.nextDueAt.getTime();
  const nowTime = now.getTime();
  const staleThresholdMs = staleThresholdDays * 24 * 60 * 60 * 1000;

  const offsets = obligation.reminderOffsetsMin.length > 0
    ? obligation.reminderOffsetsMin
    : [0];

  const schedules: DeliveryScheduleItem[] = [];

  for (const offset of offsets) {
    const scheduledTime = dueTime - (offset * 60 * 1000);
    const scheduledFor = new Date(scheduledTime);
    // An occurrence is stale if its scheduled delivery time was more than 7 days ago
    const isStale = (nowTime - scheduledTime) > staleThresholdMs;

    schedules.push({
      occurrenceKey,
      scheduledFor,
      offsetMinutes: offset,
      isStale,
    });
  }

  return schedules;
}

/**
 * Evaluates whether a scheduled delivery should be sent right now.
 * Pure logic enforcing:
 * - Time window eligibility
 * - Snooze suppression (no send before snoozedUntil)
 * - Stale past occurrence suppression (no uncontrolled catch-up storms)
 */
export function shouldDeliverNow(params: {
  scheduledFor: Date;
  now: Date;
  snoozedUntil?: Date | null;
  isStale?: boolean;
  deliveryStatus?: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'SNOOZED' | 'FAILED' | null;
}): { shouldSend: boolean; reason: string } {
  const { scheduledFor, now, snoozedUntil, isStale, deliveryStatus } = params;

  // 1. If already sent or acknowledged, never resend!
  if (deliveryStatus === 'SENT' || deliveryStatus === 'ACKNOWLEDGED') {
    return { shouldSend: false, reason: 'Already delivered or acknowledged' };
  }

  // 2. If snoozed and snooze period is still active, hold delivery
  if (snoozedUntil && snoozedUntil.getTime() > now.getTime()) {
    return { shouldSend: false, reason: 'Snoozed until ' + snoozedUntil.toISOString() };
  }

  // 3. If stale (> 7 days past due without send), suppress catch-up storm
  if (isStale) {
    return { shouldSend: false, reason: 'Suppressed: stale past occurrence' };
  }

  // 4. Must be at or after the scheduled time
  if (now.getTime() < scheduledFor.getTime()) {
    return { shouldSend: false, reason: 'Future scheduled time not yet reached' };
  }

  return { shouldSend: true, reason: 'Eligible for delivery' };
}

/**
 * Generates deterministic delivery claim key matching the database unique constraint:
 * @@unique([reminderId, occurrenceKey, offsetMinutes, channel])
 */
export function generateDeliveryClaimKey(params: {
  targetId: string;
  occurrenceKey: string;
  offsetMinutes: number;
  channel: string;
}): string {
  return `${params.targetId}:${params.occurrenceKey}:${params.offsetMinutes}:${params.channel}`;
}

/**
 * Formats Telegram notification message and inline actions for a bill/obligation reminder.
 */
export function formatTelegramBillReminder(params: {
  obligationId: string;
  title: string;
  kind: string;
  amount?: string | null;
  nextDueAt: Date;
  occurrenceKey: string;
  offsetMinutes: number;
  appBaseUrl?: string;
}) {
  const { obligationId, title, kind, amount, nextDueAt, occurrenceKey, offsetMinutes, appBaseUrl = '' } = params;

  let offsetLabel = 'due today';
  if (offsetMinutes >= 10080) {
    offsetLabel = 'due in 7 days';
  } else if (offsetMinutes >= 4320) {
    offsetLabel = 'due in 3 days';
  } else if (offsetMinutes >= 1440) {
    offsetLabel = 'due tomorrow';
  }

  const formattedAmount = amount ? `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : null;

  const text = `🔔 **${kind} Reminder** (${offsetLabel})\n\n` +
    `**${title}**\n` +
    (formattedAmount ? `Amount: **${formattedAmount}**\n` : '') +
    `Due Date: ${nextDueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
    `Tap below to mark as paid or snooze this notification:`;

  const inlineKeyboard = [
    [
      { text: '✅ Mark Paid', callback_data: `paid_${obligationId}_${occurrenceKey}` },
      { text: '⏰ Snooze 24h', callback_data: `snz_${obligationId}_${occurrenceKey}` }
    ],
    [
      { text: '📱 Open in App', url: `${appBaseUrl || 'https://nutrisnap.app'}/finance` }
    ]
  ];

  return {
    text,
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  };
}
