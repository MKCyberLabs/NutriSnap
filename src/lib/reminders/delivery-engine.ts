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

export const MAX_DELIVERY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MINUTES = [5, 15]; // attempt 1 failure -> +5m; attempt 2 failure -> +15m; attempt 3 -> max reached

/**
 * Calculates next retry time for a failed delivery attempt.
 * - attemptCount: total attempts made so far (1 after first failure, 2 after second, 3 after third)
 * - fromDate: timestamp of the failed attempt
 * Returns Date of next eligible retry, or null if maximum attempts have been reached.
 */
export function calculateNextRetryAt(
  attemptCount: number,
  fromDate: Date = new Date(),
  backoffMinutes: number[] = RETRY_BACKOFF_MINUTES,
  maxAttempts: number = MAX_DELIVERY_ATTEMPTS
): Date | null {
  if (attemptCount >= maxAttempts) {
    return null;
  }
  const delayMin = backoffMinutes[attemptCount - 1] ?? backoffMinutes[backoffMinutes.length - 1];
  return new Date(fromDate.getTime() + delayMin * 60 * 1000);
}

export function evaluateDeliveryFailure(params: {
  currentAttemptCount: number;
  failedAt?: Date;
  failureReason?: string;
  maxAttempts?: number;
  backoffMinutes?: number[];
}): {
  status: 'FAILED';
  attemptCount: number;
  lastAttemptAt: Date;
  nextRetryAt: Date | null;
  failureReason: string;
  canRetry: boolean;
} {
  const {
    currentAttemptCount,
    failedAt = new Date(),
    failureReason = 'Send error',
    maxAttempts = MAX_DELIVERY_ATTEMPTS,
    backoffMinutes = RETRY_BACKOFF_MINUTES,
  } = params;

  const newAttemptCount = currentAttemptCount + 1;
  const nextRetryAt = calculateNextRetryAt(newAttemptCount, failedAt, backoffMinutes, maxAttempts);

  return {
    status: 'FAILED',
    attemptCount: newAttemptCount,
    lastAttemptAt: failedAt,
    nextRetryAt,
    failureReason,
    canRetry: nextRetryAt !== null,
  };
}

export function evaluateDeliverySuccess(params: {
  currentAttemptCount: number;
  sentAt?: Date;
}): {
  status: 'SENT';
  attemptCount: number;
  lastAttemptAt: Date;
  nextRetryAt: null;
  sentAt: Date;
} {
  const { currentAttemptCount, sentAt = new Date() } = params;
  return {
    status: 'SENT',
    attemptCount: currentAttemptCount + 1,
    lastAttemptAt: sentAt,
    nextRetryAt: null,
    sentAt,
  };
}

export interface ShouldDeliverNowParams {
  scheduledFor: Date;
  now: Date;
  snoozedUntil?: Date | null;
  isStale?: boolean;
  deliveryStatus?: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'SNOOZED' | 'FAILED' | null;
  attemptCount?: number;
  lastAttemptAt?: Date | null;
  nextRetryAt?: Date | null;
  maxAttempts?: number;
}

/**
 * Evaluates whether a scheduled delivery should be sent right now.
 * Pure logic enforcing:
 * - Time window eligibility
 * - Snooze suppression (no send before snoozedUntil)
 * - Stale past occurrence suppression (no uncontrolled catch-up storms)
 * - Durable bounded retry policy with backoff and max 3 attempts
 */
export function shouldDeliverNow(params: ShouldDeliverNowParams): { shouldSend: boolean; reason: string } {
  const {
    scheduledFor,
    now,
    snoozedUntil,
    isStale,
    deliveryStatus,
    attemptCount = 0,
    lastAttemptAt,
    nextRetryAt,
    maxAttempts = MAX_DELIVERY_ATTEMPTS,
  } = params;

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

  // 4. If delivery previously failed, enforce durable bounded retry policy
  if (deliveryStatus === 'FAILED') {
    if (attemptCount >= maxAttempts) {
      return {
        shouldSend: false,
        reason: `Max retry attempts reached (${attemptCount}/${maxAttempts})`,
      };
    }

    if (nextRetryAt && now.getTime() < nextRetryAt.getTime()) {
      return {
        shouldSend: false,
        reason: `Retry backoff active until ${nextRetryAt.toISOString()}`,
      };
    }

    if (!nextRetryAt && lastAttemptAt) {
      const calculatedRetryAt = calculateNextRetryAt(attemptCount, lastAttemptAt, RETRY_BACKOFF_MINUTES, maxAttempts);
      if (calculatedRetryAt && now.getTime() < calculatedRetryAt.getTime()) {
        return {
          shouldSend: false,
          reason: `Retry backoff active until ${calculatedRetryAt.toISOString()}`,
        };
      }
    }
  }

  // 5. Must be at or after the scheduled time
  if (now.getTime() < scheduledFor.getTime()) {
    return { shouldSend: false, reason: 'Future scheduled time not yet reached' };
  }

  return {
    shouldSend: true,
    reason: deliveryStatus === 'FAILED' ? 'Eligible for retry' : 'Eligible for delivery',
  };
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

/**
 * Formats Telegram notification message for a personal debt reminder.
 */
export function formatTelegramDebtReminder(params: {
  debtId: string;
  direction: string;
  counterpartyName: string;
  amount: string;
  dueDate: Date;
  offsetMinutes: number;
  appBaseUrl?: string;
}) {
  const { debtId, direction, counterpartyName, amount, dueDate, offsetMinutes, appBaseUrl = '' } = params;

  let offsetLabel = 'due today';
  if (offsetMinutes >= 10080) {
    offsetLabel = 'due in 7 days';
  } else if (offsetMinutes >= 4320) {
    offsetLabel = 'due in 3 days';
  } else if (offsetMinutes >= 1440) {
    offsetLabel = 'due tomorrow';
  }

  const isReceivable = direction === 'RECEIVABLE';
  const actionTitle = isReceivable ? 'Collect Money' : 'Repay Money';
  const actionSummary = isReceivable
    ? `Collect from **${counterpartyName}**`
    : `Repay to **${counterpartyName}**`;

  const text = `🤝 **${actionTitle} Reminder** (${offsetLabel})\n\n` +
    `${actionSummary}\n` +
    `Outstanding: **₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n` +
    `Due Date: ${dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
    `Track and record this in NutriSnap:`;

  const inlineKeyboard = [
    [
      { text: '📱 View in App', url: `${appBaseUrl || 'https://nutrisnap.app'}/finance/debts` }
    ]
  ];

  return {
    text,
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  };
}

/**
 * Formats Telegram notification message for a loan EMI reminder.
 */
export function formatTelegramLoanEmiReminder(params: {
  loanId: string;
  name: string;
  lender: string;
  emiAmount?: string | null;
  dueDate: Date;
  offsetMinutes: number;
  appBaseUrl?: string;
}) {
  const { loanId, name, lender, emiAmount, dueDate, offsetMinutes, appBaseUrl = '' } = params;

  let offsetLabel = 'due today';
  if (offsetMinutes >= 10080) {
    offsetLabel = 'due in 7 days';
  } else if (offsetMinutes >= 4320) {
    offsetLabel = 'due in 3 days';
  } else if (offsetMinutes >= 1440) {
    offsetLabel = 'due tomorrow';
  }

  const formattedAmount = emiAmount
    ? `₹${parseFloat(emiAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : null;

  const text = `🏦 **Loan EMI Reminder** (${offsetLabel})\n\n` +
    `**${name}** (${lender})\n` +
    (formattedAmount ? `Monthly EMI: **${formattedAmount}**\n` : '') +
    `Due Date: ${dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
    `Keep your instalments up to date:`;

  const inlineKeyboard = [
    [
      { text: '📱 View Loan in App', url: `${appBaseUrl || 'https://nutrisnap.app'}/finance/loans` }
    ]
  ];

  return {
    text,
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  };
}
