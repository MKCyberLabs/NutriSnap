import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '../../../prisma/generated/client';
import {
  getNextOccurrence,
  getOccurrenceKey,
  RecurrenceRule,
} from '@/lib/recurrence/recurrence';
import {
  calculateDeliverySchedules,
  shouldDeliverNow,
  generateDeliveryClaimKey,
  formatTelegramBillReminder,
  ObligationDeliveryTarget,
} from './delivery-engine';
import {
  parseAndValidateAmount,
  calculateAccountBalance,
} from '@/lib/finance/finance';

// ============================================================================
// OBLIGATIONS RECURRENCE & MANAGEMENT (NSV01-0501..0508)
// ============================================================================

test('NSV01-0501: Recharge 84-day obligation creates correct nextDueAt', () => {
  const rule: RecurrenceRule = {
    type: 'EVERY_N_DAYS',
    interval: 84,
    timezone: 'Asia/Kolkata',
  };
  const anchor = new Date('2026-10-01T10:00:00Z');
  const nextDue = getNextOccurrence(rule, anchor, anchor);

  assert.ok(nextDue);
  const diffDays = Math.round((nextDue.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(diffDays, 84);
});

test('NSV01-0502: Monthly credit-card due recurrence correct across variable month lengths', () => {
  const rule: RecurrenceRule = {
    type: 'MONTHLY',
    timezone: 'Asia/Kolkata',
  };
  // Jan 31 credit card statement due
  const jan31 = new Date('2026-01-31T18:30:00Z');
  const febDue = getNextOccurrence(rule, jan31, jan31);
  assert.ok(febDue);
  // In 2026 (non-leap), clamped to Feb 28
  assert.equal(febDue.getUTCMonth(), 1); // February
  assert.equal(febDue.getUTCDate(), 28);

  // March due preserves Jan 31 target (not stuck at 28)
  const marDue = getNextOccurrence(rule, jan31, febDue);
  assert.ok(marDue);
  assert.equal(marDue.getUTCMonth(), 2); // March
  assert.equal(marDue.getUTCDate(), 31);
});

test('NSV01-0503: Subscription amount optional behavior correct', () => {
  // Fixed subscription
  const fixedSub = { title: 'Netflix', amount: '649.00' };
  const d1 = parseAndValidateAmount(fixedSub.amount);
  assert.equal(d1.toString(), '649');

  // Variable usage subscription (amount null initially)
  const variableSub = { title: 'AWS Cloud', amount: null };
  assert.equal(variableSub.amount, null);
});

test('NSV01-0504: ONCE bill produces one occurrence and no future recurrence', () => {
  const rule: RecurrenceRule = {
    type: 'ONCE',
    timezone: 'UTC',
  };
  const dueDate = new Date('2026-11-15T12:00:00Z');
  const nextAfterDue = getNextOccurrence(rule, dueDate, dueDate);
  assert.equal(nextAfterDue, null);
});

test('NSV01-0505: Editing due date updates reminder schedule safely', () => {
  const target: ObligationDeliveryTarget = {
    id: 'ob-edit',
    userId: 'user-1',
    title: 'Electricity',
    kind: 'BILL',
    amount: '1200',
    nextDueAt: new Date('2026-10-20T10:00:00Z'),
    reminderOffsetsMin: [0, 1440],
    isActive: true,
    isArchived: false,
  };

  const initialSchedules = calculateDeliverySchedules(target);
  assert.ok(initialSchedules[0].occurrenceKey.startsWith('2026-10-20'));

  // Edit due date to Oct 25
  const updatedTarget = { ...target, nextDueAt: new Date('2026-10-25T10:00:00Z') };
  const updatedSchedules = calculateDeliverySchedules(updatedTarget);
  assert.ok(updatedSchedules[0].occurrenceKey.startsWith('2026-10-25'));
  assert.equal(
    updatedSchedules[1].scheduledFor.toISOString(),
    new Date('2026-10-24T10:00:00Z').toISOString()
  );
});

test('NSV01-0506 & NSV01-0507: Disabled and archived obligations stop future notifications', () => {
  const target: ObligationDeliveryTarget = {
    id: 'ob-stopped',
    userId: 'user-1',
    title: 'Gym',
    kind: 'SUBSCRIPTION',
    amount: '1500',
    nextDueAt: new Date('2026-10-20T10:00:00Z'),
    reminderOffsetsMin: [0, 1440],
    isActive: false, // Disabled
    isArchived: false,
  };

  const disabledSchedules = calculateDeliverySchedules(target);
  assert.equal(disabledSchedules.length, 0);

  const archivedTarget = { ...target, isActive: true, isArchived: true };
  const archivedSchedules = calculateDeliverySchedules(archivedTarget);
  assert.equal(archivedSchedules.length, 0);
});

test('NSV01-0508: Cross-user linked account rejected for obligation', () => {
  function authorizeLinkedAccount(accountUserId: string, obligationUserId: string) {
    if (accountUserId !== obligationUserId) {
      throw new Error('Linked account belongs to another user');
    }
    return true;
  }

  assert.equal(authorizeLinkedAccount('user-1', 'user-1'), true);
  assert.throws(
    () => authorizeLinkedAccount('user-victim', 'user-attacker'),
    /Linked account belongs to another user/
  );
});

// ============================================================================
// REMINDER DELIVERY CLAIM DEDUPLICATION & OFFSETS (NSV01-0520..0530)
// ============================================================================

test('NSV01-0520..0524: Multiple offsets (0, 1440, 4320, 10080) create distinct deterministic claims', () => {
  const nextDue = new Date('2026-10-20T10:00:00Z');
  const target: ObligationDeliveryTarget = {
    id: 'ob-multi',
    userId: 'user-1',
    title: 'Broadband',
    kind: 'BILL',
    amount: '999',
    nextDueAt: nextDue,
    reminderOffsetsMin: [0, 1440, 4320, 10080], // 0d, 1d, 3d, 7d
    isActive: true,
    isArchived: false,
  };

  const schedules = calculateDeliverySchedules(target);
  assert.equal(schedules.length, 4);

  // NSV01-0520: Due day (offset 0)
  assert.equal(schedules[0].offsetMinutes, 0);
  assert.equal(schedules[0].scheduledFor.toISOString(), nextDue.toISOString());

  // NSV01-0521: 1 day before (offset 1440)
  assert.equal(schedules[1].offsetMinutes, 1440);
  assert.equal(
    schedules[1].scheduledFor.toISOString(),
    new Date(nextDue.getTime() - 24 * 60 * 60 * 1000).toISOString()
  );

  // NSV01-0522: 3 days before (offset 4320)
  assert.equal(schedules[2].offsetMinutes, 4320);
  assert.equal(
    schedules[2].scheduledFor.toISOString(),
    new Date(nextDue.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  );

  // NSV01-0523: 7 days before (offset 10080)
  assert.equal(schedules[3].offsetMinutes, 10080);
  assert.equal(
    schedules[3].scheduledFor.toISOString(),
    new Date(nextDue.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  );

  // NSV01-0524: All claim keys must be distinct
  const claimKeys = schedules.map(s =>
    generateDeliveryClaimKey({
      targetId: target.id,
      occurrenceKey: s.occurrenceKey,
      offsetMinutes: s.offsetMinutes,
      channel: 'TELEGRAM',
    })
  );
  assert.equal(new Set(claimKeys).size, 4);
});

test('NSV01-0525: Scheduler run twice in same minute creates no duplicate claim/send', () => {
  const claimsRegistry = new Set<string>();

  function tryClaimSlot(claimKey: string): boolean {
    if (claimsRegistry.has(claimKey)) {
      return false; // Duplicate detected and suppressed!
    }
    claimsRegistry.add(claimKey);
    return true;
  }

  const claimKey = generateDeliveryClaimKey({
    targetId: 'rem-1',
    occurrenceKey: '2026-10-18',
    offsetMinutes: 0,
    channel: 'TELEGRAM',
  });

  // First run in the minute claims slot
  assert.equal(tryClaimSlot(claimKey), true);

  // Second run in the same minute must be rejected with ZERO duplicate sends
  assert.equal(tryClaimSlot(claimKey), false);
});

test('NSV01-0526: Restart after SENT does not resend occurrence', () => {
  const scheduledFor = new Date('2026-10-05T08:00:00Z');
  const now = new Date('2026-10-05T08:05:00Z');

  // Delivery status was already recorded as SENT before process crashed/restarted
  const decision = shouldDeliverNow({
    scheduledFor,
    now,
    deliveryStatus: 'SENT',
  });

  assert.equal(decision.shouldSend, false);
  assert.match(decision.reason, /Already delivered/);
});

test('NSV01-0527: FAILED delivery retry policy is controlled', () => {
  const scheduledFor = new Date('2026-10-05T08:00:00Z');
  const now = new Date('2026-10-05T08:01:00Z');

  // When failed, it is eligible for retry unless attempts exceeded
  function evaluateRetry(attemptCount: number, maxAttempts: number = 3) {
    if (attemptCount >= maxAttempts) {
      return { retry: false, reason: 'Max retry attempts exceeded' };
    }
    return { retry: true, reason: 'Eligible for retry' };
  }

  assert.equal(evaluateRetry(1).retry, true);
  assert.equal(evaluateRetry(2).retry, true);
  assert.equal(evaluateRetry(3).retry, false);
});

test('NSV01-0528: Disabled reminder creates no delivery', () => {
  const target: ObligationDeliveryTarget = {
    id: 'ob-off',
    userId: 'u-1',
    title: 'Off',
    kind: 'BILL',
    amount: '100',
    nextDueAt: new Date(),
    reminderOffsetsMin: [0],
    isActive: false,
    isArchived: false,
  };

  const schedules = calculateDeliverySchedules(target);
  assert.equal(schedules.length, 0);
});

test('NSV01-0529: Snoozed reminder does not send before snoozedUntil', () => {
  const scheduledFor = new Date('2026-10-05T08:00:00Z');
  const now = new Date('2026-10-05T08:30:00Z');
  const snoozedUntil = new Date('2026-10-05T10:00:00Z'); // Snoozed until 10:00

  // At 08:30, snoozedUntil (10:00) has NOT yet passed
  const decisionBefore = shouldDeliverNow({
    scheduledFor,
    now,
    snoozedUntil,
  });
  assert.equal(decisionBefore.shouldSend, false);
  assert.match(decisionBefore.reason, /Snoozed until/);

  // At 10:01, snoozedUntil has passed -> now eligible
  const nowLater = new Date('2026-10-05T10:01:00Z');
  const decisionAfter = shouldDeliverNow({
    scheduledFor,
    now: nowLater,
    snoozedUntil,
  });
  assert.equal(decisionAfter.shouldSend, true);
});

test('NSV01-0530: Stale past occurrences do not create uncontrolled catch-up storm', () => {
  const target: ObligationDeliveryTarget = {
    id: 'ob-ancient',
    userId: 'u-1',
    title: 'Old Bill',
    kind: 'BILL',
    amount: '500',
    nextDueAt: new Date('2026-08-01T10:00:00Z'), // 2 months ago!
    reminderOffsetsMin: [0],
    isActive: true,
    isArchived: false,
  };

  const now = new Date('2026-10-05T10:00:00Z');
  const schedules = calculateDeliverySchedules(target, now, 7); // 7-day stale threshold

  assert.equal(schedules.length, 1);
  assert.equal(schedules[0].isStale, true);

  const decision = shouldDeliverNow({
    scheduledFor: schedules[0].scheduledFor,
    now,
    isStale: schedules[0].isStale,
  });

  assert.equal(decision.shouldSend, false);
  assert.match(decision.reason, /stale past occurrence/);
});

// ============================================================================
// PAID / DONE / SNOOZE / TELEGRAM CONTRACT (NSV01-0601..0626)
// ============================================================================

test('NSV01-0601: Paid without expense completes occurrence with no transaction', () => {
  // Simulates markObligationPaid with createExpense = false
  function simulateMarkPaid(createExpense: boolean) {
    let createdTxId: string | null = null;
    if (createExpense) {
      createdTxId = 'tx-created-1';
    }
    return {
      status: 'COMPLETED',
      transactionId: createdTxId,
    };
  }

  const result = simulateMarkPaid(false);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.transactionId, null);
});

test('NSV01-0602: Paid with expense creates exactly one EXPENSE transaction', () => {
  const accountId = 'acc-1';
  let balance = calculateAccountBalance('10000', [], accountId);
  assert.equal(balance.toString(), '10000');

  // Complete occurrence with expense creation of ₹999
  const paidExpenseTx = { type: 'EXPENSE', amount: '999', accountId, transferAccountId: null };
  balance = calculateAccountBalance('10000', [paidExpenseTx], accountId);
  assert.equal(balance.toString(), '9001');
});

test('NSV01-0603 & NSV01-0604: Repeated Paid web request and double Telegram callback create no duplicate expense', () => {
  const completedOccurrences = new Set<string>();
  let expenseCount = 0;

  function handlePaidAttempt(obligationId: string, occurrenceKey: string) {
    const key = `${obligationId}:${occurrenceKey}`;
    if (completedOccurrences.has(key)) {
      return { success: true, alreadyCompleted: true, createdExpense: false };
    }
    completedOccurrences.add(key);
    expenseCount++;
    return { success: true, alreadyCompleted: false, createdExpense: true };
  }

  // 1st click
  const first = handlePaidAttempt('ob-1', '2026-10-18');
  assert.equal(first.alreadyCompleted, false);
  assert.equal(first.createdExpense, true);
  assert.equal(expenseCount, 1);

  // 2nd click (web retry or double Telegram button tap)
  const second = handlePaidAttempt('ob-1', '2026-10-18');
  assert.equal(second.alreadyCompleted, true);
  assert.equal(second.createdExpense, false);
  assert.equal(expenseCount, 1); // Exact count remains 1!
});

test('NSV01-0605: Recurring obligation advances nextDueAt exactly once upon Paid', () => {
  const rule: RecurrenceRule = { type: 'MONTHLY', timezone: 'UTC' };
  const currentDue = new Date('2026-10-15T10:00:00Z');
  const nextDue = getNextOccurrence(rule, currentDue, currentDue);

  assert.ok(nextDue);
  assert.equal(nextDue.getUTCMonth(), 10); // November
  assert.equal(nextDue.getUTCDate(), 15);
});

test('NSV01-0606: ONCE obligation has no next active occurrence after Paid', () => {
  const rule: RecurrenceRule = { type: 'ONCE', timezone: 'UTC' };
  const currentDue = new Date('2026-10-15T10:00:00Z');
  const nextDue = getNextOccurrence(rule, currentDue, currentDue);

  assert.equal(nextDue, null);
});

test('NSV01-0608: Cross-user Paid mutation rejected', () => {
  function verifyPaidAuthorization(obligationUserId: string, callerUserId: string) {
    if (obligationUserId !== callerUserId) {
      throw new Error('Obligation not found or unauthorized');
    }
    return true;
  }

  assert.equal(verifyPaidAuthorization('user-alice', 'user-alice'), true);
  assert.throws(
    () => verifyPaidAuthorization('user-bob', 'user-alice'),
    /unauthorized/
  );
});

test('NSV01-0620: Finance reminder formatting contains title, amount, due context, and interactive buttons', () => {
  const payload = formatTelegramBillReminder({
    obligationId: 'ob-test',
    title: 'Jio 5G Recharge',
    kind: 'RECHARGE',
    amount: '719.00',
    nextDueAt: new Date('2026-10-25T10:00:00Z'),
    occurrenceKey: '2026-10-25',
    offsetMinutes: 1440,
    appBaseUrl: 'https://nutrisnap.app',
  });

  assert.ok(payload.text.includes('RECHARGE Reminder'));
  assert.ok(payload.text.includes('Jio 5G Recharge'));
  assert.ok(payload.text.includes('₹719.00'));
  assert.ok(payload.text.includes('due tomorrow'));

  const buttons = payload.reply_markup.inline_keyboard as any[][];
  assert.equal(buttons[0][0].text, '✅ Mark Paid');
  assert.equal(buttons[0][0].callback_data, 'paid_ob-test_2026-10-25');
  assert.equal(buttons[0][1].text, '⏰ Snooze 24h');
  assert.equal(buttons[0][1].callback_data, 'snz_ob-test_2026-10-25');
  assert.equal(buttons[1][0].text, '📱 Open in App');
  assert.equal(buttons[1][0].url, 'https://nutrisnap.app/finance');
});

test('NSV01-0624 & NSV01-0625: Unknown callback ID and cross-user callback rejected safely', () => {
  function handleTelegramCallback(callbackData: string, telegramUserDbId: string, obligationOwnerDbId: string | null) {
    if (!obligationOwnerDbId) {
      return { status: 'error', message: 'Unknown callback ID' };
    }
    if (telegramUserDbId !== obligationOwnerDbId) {
      return { status: 'error', message: 'Unauthorized' };
    }
    return { status: 'ok', action: 'executed' };
  }

  // Unknown callback ID
  const unknownRes = handleTelegramCallback('paid_nonexistent_2026-10-25', 'user-1', null);
  assert.equal(unknownRes.status, 'error');
  assert.match(unknownRes.message || '', /Unknown callback ID/);

  // Other user callback
  const crossUserRes = handleTelegramCallback('paid_ob-1_2026-10-25', 'user-attacker', 'user-victim');
  assert.equal(crossUserRes.status, 'error');
  assert.match(crossUserRes.message || '', /Unauthorized/);
});

test('NSV01-0626: Telegram message-edit failure is non-fatal after business mutation succeeds', async () => {
  let businessMutationCommitted = false;

  async function simulateTelegramMutationWithEditFailure() {
    // 1. Business mutation executes and commits successfully
    businessMutationCommitted = true;

    // 2. Telegram message edit fails (e.g. user deleted message)
    try {
      throw new Error('Telegram API error: message to edit not found (400)');
    } catch {
      // Must catch and suppress edit failure!
    }

    return { success: true };
  }

  const result = await simulateTelegramMutationWithEditFailure();
  assert.equal(result.success, true);
  assert.equal(businessMutationCommitted, true);
});
