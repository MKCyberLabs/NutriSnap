import assert from 'node:assert/strict';
import test from 'node:test';
import { processSchedulerTick } from '../scheduler';
import { Prisma } from '../../../prisma/generated/client';

function createMockBot() {
  const sentMessages: Array<{ chatId: string; text: string; options?: any }> = [];
  const deletedMessages: Array<{ chatId: string; messageId: number }> = [];

  return {
    sentMessages,
    deletedMessages,
    api: {
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { message_id: 1000 + sentMessages.length };
      },
      deleteMessage: async (chatId: string, messageId: number) => {
        deletedMessages.push({ chatId, messageId });
      },
    },
  };
}

test('NSV01-0531: activeReminders = [] does NOT prevent Hydration processing', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-05T10:00:00.000Z'); // Monday 10:00 UTC

  const mockDb = {
    reminder: {
      findMany: async () => [], // ZERO active meal reminders!
    },
    hydrationSetting: {
      findMany: async () => [
        {
          id: 'hyd-1',
          userId: 'usr-1',
          startTime: '09:00',
          endTime: '18:00',
          intervalMinutes: 60,
          activeDays: ['Monday'],
          isActive: true,
          user: { id: 'usr-1', telegramId: 'tg-usr-1', timezone: 'UTC' },
        },
      ],
    },
    obligation: {
      findMany: async () => [],
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.healthRemindersChecked, 0, 'Zero meal reminders checked');
  assert.equal(result.hydrationSettingsChecked, 1, 'Hydration settings must still be checked');
  assert.equal(result.hydrationRemindersSent, 1, 'Hydration reminder must be sent');
  assert.equal(mockBot.sentMessages.length, 1);
  assert.match(mockBot.sentMessages[0].text, /Time to hydrate/);
});

test('NSV01-0532: activeReminders = [] does NOT prevent Wealth/Obligation processing', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-05T09:00:00.000Z');

  let createdDelivery: any = null;
  let updatedDelivery: any = null;

  const mockDb = {
    reminder: {
      findMany: async () => [], // ZERO active meal reminders!
      create: async (args: any) => ({ id: 'rem-created-1', ...args.data }),
    },
    hydrationSetting: {
      findMany: async () => [], // ZERO hydration settings!
    },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-recharge-1',
          userId: 'usr-2',
          title: 'Jio 84-day Recharge',
          kind: 'RECHARGE',
          amount: new Prisma.Decimal('799.00'),
          nextDueAt: new Date('2026-10-05T09:00:00.000Z'),
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-2', telegramId: 'tg-usr-2', timezone: 'Asia/Kolkata' },
          reminders: [],
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null, // No prior delivery
      create: async (args: any) => {
        createdDelivery = { id: 'del-uuid-101', ...args.data };
        return createdDelivery;
      },
      update: async (args: any) => {
        updatedDelivery = { ...createdDelivery, ...args.data };
        return updatedDelivery;
      },
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.healthRemindersChecked, 0, 'Zero meal reminders checked');
  assert.equal(result.obligationsChecked, 1, 'Obligations must still be checked');
  assert.equal(result.wealthRemindersSent, 1, 'Wealth reminder must be sent');
  assert.equal(mockBot.sentMessages.length, 1);
  assert.match(mockBot.sentMessages[0].text, /Jio 84-day Recharge/);
  assert.equal(updatedDelivery.status, 'SENT');
  assert.equal(updatedDelivery.attemptCount, 1);
});

test('NSV01-0533: Zero hydration settings does NOT prevent Wealth processing', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-05T12:00:00.000Z');

  let deliveryUpdated = false;

  const mockDb = {
    reminder: {
      findMany: async () => [],
      create: async (args: any) => ({ id: 'rem-1', ...args.data }),
    },
    hydrationSetting: {
      findMany: async () => [], // ZERO hydration settings!
    },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-bill-1',
          userId: 'usr-3',
          title: 'Electricity Bill',
          kind: 'BILL',
          amount: new Prisma.Decimal('1500.00'),
          nextDueAt: new Date('2026-10-05T12:00:00.000Z'),
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-3', telegramId: 'tg-usr-3', timezone: 'UTC' },
          reminders: [{ id: 'rem-1' }],
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      create: async (args: any) => ({ id: 'del-uuid-102', ...args.data }),
      update: async (args: any) => {
        deliveryUpdated = true;
        return { id: args.where.id, ...args.data };
      },
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.hydrationSettingsChecked, 0);
  assert.equal(result.obligationsChecked, 1);
  assert.equal(result.wealthRemindersSent, 1);
  assert.equal(deliveryUpdated, true);
  assert.equal(mockBot.sentMessages.length, 1);
});

test('NSV01-0534: Zero obligations does NOT break Health or Hydration processing', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-05T13:00:00.000Z');

  const mockDb = {
    reminder: {
      findMany: async () => [
        {
          id: 'meal-rem-1',
          userId: 'usr-4',
          category: 'Lunch',
          time: '13:00',
          isActive: true,
          user: { id: 'usr-4', telegramId: 'tg-usr-4', timezone: 'UTC' },
        },
      ],
    },
    mealLog: {
      findFirst: async () => null, // Has not logged lunch yet
    },
    hydrationSetting: {
      findMany: async () => [
        {
          id: 'hyd-2',
          userId: 'usr-4',
          startTime: '08:00',
          endTime: '20:00',
          intervalMinutes: 60,
          activeDays: ['Monday'],
          isActive: true,
          user: { id: 'usr-4', telegramId: 'tg-usr-4', timezone: 'UTC' },
        },
      ],
    },
    obligation: {
      findMany: async () => [], // ZERO obligations!
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.healthRemindersChecked, 1);
  assert.equal(result.healthRemindersSent, 1);
  assert.equal(result.hydrationSettingsChecked, 1);
  assert.equal(result.hydrationRemindersSent, 1);
  assert.equal(result.obligationsChecked, 0);
  assert.equal(result.wealthRemindersSent, 0);
  assert.equal(mockBot.sentMessages.length, 2);
});

test('NSV01-0535: Domain error isolation prevents one failed domain from halting others', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-05T14:00:00.000Z');

  const mockDb = {
    reminder: {
      findMany: async () => {
        throw new Error('Database connection glitch on Health domain');
      },
    },
    hydrationSetting: {
      findMany: async () => [
        {
          id: 'hyd-3',
          userId: 'usr-5',
          startTime: '09:00',
          endTime: '18:00',
          intervalMinutes: 60,
          activeDays: ['Monday'],
          isActive: true,
          user: { id: 'usr-5', telegramId: 'tg-usr-5', timezone: 'UTC' },
        },
      ],
    },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-3',
          userId: 'usr-5',
          title: 'Broadband Bill',
          kind: 'BILL',
          amount: new Prisma.Decimal('999.00'),
          nextDueAt: new Date('2026-10-05T14:00:00.000Z'),
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-5', telegramId: 'tg-usr-5', timezone: 'UTC' },
          reminders: [{ id: 'rem-broadband' }],
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      create: async (args: any) => ({ id: 'del-uuid-103', ...args.data }),
      update: async (args: any) => ({ id: args.where.id, ...args.data }),
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  // Health domain errored gracefully without throwing
  assert.equal(result.healthRemindersChecked, 0);
  // Hydration and Wealth domains ran and succeeded despite Health domain error!
  assert.equal(result.hydrationSettingsChecked, 1);
  assert.equal(result.hydrationRemindersSent, 1);
  assert.equal(result.obligationsChecked, 1);
  assert.equal(result.wealthRemindersSent, 1);
  assert.equal(mockBot.sentMessages.length, 2);
});

test('NSV01-0536: Existing durable delivery claim and retry behavior preserved across ticks', async () => {
  const failBot = {
    api: {
      sendMessage: async () => {
        throw new Error('Telegram 503 Service Unavailable');
      },
      deleteMessage: async () => {},
    },
  };

  const scheduledFor = new Date('2026-10-05T08:00:00.000Z');
  const tick1Now = new Date('2026-10-05T08:00:00.000Z');

  let persistentDelivery: any = null;
  let createDeliveryCalls = 0;

  const mockDb = {
    reminder: {
      findMany: async () => [],
    },
    hydrationSetting: {
      findMany: async () => [],
    },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-retry-test',
          userId: 'usr-retry',
          title: 'EMI Due',
          kind: 'EMI',
          amount: new Prisma.Decimal('12000.00'),
          nextDueAt: scheduledFor,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-retry', telegramId: 'tg-usr-retry', timezone: 'UTC' },
          reminders: [{ id: 'rem-emi-1' }],
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => persistentDelivery,
      create: async (args: any) => {
        createDeliveryCalls++;
        persistentDelivery = { id: 'del-uuid-claim-1', ...args.data };
        return persistentDelivery;
      },
      update: async (args: any) => {
        persistentDelivery = { ...persistentDelivery, ...args.data };
        return persistentDelivery;
      },
    },
  };

  // --- Tick 1: First attempt at 08:00 fails ---
  await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: failBot,
    now: tick1Now,
  });

  assert.equal(createDeliveryCalls, 1, 'Initial claim created');
  assert.equal(persistentDelivery.status, 'FAILED');
  assert.equal(persistentDelivery.attemptCount, 1);
  assert.ok(persistentDelivery.nextRetryAt);
  // First retry backoff: 5 minutes -> 08:05
  assert.equal(persistentDelivery.nextRetryAt.getTime(), new Date('2026-10-05T08:05:00.000Z').getTime());

  // --- Tick 2: Immediate next minute at 08:01: backoff has NOT elapsed ---
  const tick2Now = new Date('2026-10-05T08:01:00.000Z');
  await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: failBot,
    now: tick2Now,
  });

  assert.equal(createDeliveryCalls, 1, 'No duplicate delivery created on next minute');
  assert.equal(persistentDelivery.attemptCount, 1, 'attemptCount remains 1');

  // --- Tick 3: At 08:05: backoff has elapsed -> retry happens ---
  const tick3Now = new Date('2026-10-05T08:05:00.000Z');
  await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: failBot,
    now: tick3Now,
  });

  assert.equal(createDeliveryCalls, 1, 'Still exactly 1 delivery claim in-place');
  assert.equal(persistentDelivery.status, 'FAILED');
  assert.equal(persistentDelivery.attemptCount, 2, 'attemptCount incremented to 2');
  // Second retry backoff: 15 minutes -> 08:20
  assert.equal(persistentDelivery.nextRetryAt.getTime(), new Date('2026-10-05T08:20:00.000Z').getTime());

  // --- Tick 4: At 08:20: third attempt succeeds ---
  const successBot = createMockBot();
  const tick4Now = new Date('2026-10-05T08:20:00.000Z');
  const tick4Result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: successBot,
    now: tick4Now,
  });

  assert.equal(createDeliveryCalls, 1, 'No new delivery claim created');
  assert.equal(tick4Result.wealthRemindersSent, 1);
  assert.equal(persistentDelivery.status, 'SENT');
  assert.equal(persistentDelivery.attemptCount, 3);
  assert.equal(persistentDelivery.nextRetryAt, null);

  // --- Tick 5: Subsequent run at 08:21 never resends SENT delivery ---
  const tick5Result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: successBot,
    now: new Date('2026-10-05T08:21:00.000Z'),
  });

  assert.equal(tick5Result.wealthRemindersSent, 0, 'SENT delivery never resends');
});

test('V2-6001: Personal Debt due reminder delivers Telegram message and creates delivery record', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-10T10:00:00.000Z');

  let createdReminder: any = null;
  let createdDelivery: any = null;
  let updatedDelivery: any = null;

  const mockDb = {
    reminder: {
      findMany: async () => [],
      findFirst: async () => createdReminder,
      create: async (args: any) => {
        createdReminder = { id: 'rem-debt-1', ...args.data };
        return createdReminder;
      },
    },
    hydrationSetting: {
      findMany: async () => [],
    },
    obligation: {
      findMany: async () => [],
    },
    personalDebt: {
      findMany: async () => [
        {
          id: 'debt-rec-1',
          userId: 'usr-debt-1',
          direction: 'RECEIVABLE',
          counterpartyName: 'Alice Sharma',
          title: 'Lent for travel',
          originalAmount: new Prisma.Decimal('5000.00'),
          dueAt: new Date('2026-10-10T10:00:00.000Z'),
          reminderOffsetsMin: [0],
          status: 'OPEN',
          user: { id: 'usr-debt-1', telegramId: 'tg-debt-1', timezone: 'Asia/Kolkata' },
          transactions: [],
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      create: async (args: any) => {
        createdDelivery = { id: 'del-debt-101', ...args.data };
        return createdDelivery;
      },
      update: async (args: any) => {
        updatedDelivery = { ...createdDelivery, ...args.data };
        return updatedDelivery;
      },
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.debtsChecked, 1, '1 debt checked');
  assert.equal(result.wealthRemindersSent, 1, '1 wealth reminder sent');
  assert.equal(mockBot.sentMessages.length, 1);
  assert.match(mockBot.sentMessages[0].text, /Collect from \*\*Alice Sharma\*\*/);
  assert.match(mockBot.sentMessages[0].text, /5,000\.00/);
  assert.equal(createdReminder?.type, 'PERSONAL_DEBT');
  assert.equal(createdReminder?.category, 'debt-rec-1');
  assert.equal(updatedDelivery?.status, 'SENT');
  assert.equal(updatedDelivery?.attemptCount, 1);
});

test('V2-6001b: Fully settled debt creates NO reminder', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-10T10:00:00.000Z');

  const mockDb = {
    reminder: { findMany: async () => [], findFirst: async () => null },
    hydrationSetting: { findMany: async () => [] },
    obligation: { findMany: async () => [] },
    personalDebt: {
      findMany: async () => [
        {
          id: 'debt-settled-1',
          userId: 'usr-debt-2',
          direction: 'RECEIVABLE',
          counterpartyName: 'Bob',
          originalAmount: new Prisma.Decimal('3000.00'),
          dueAt: new Date('2026-10-10T10:00:00.000Z'),
          reminderOffsetsMin: [0],
          status: 'OPEN',
          user: { id: 'usr-debt-2', telegramId: 'tg-debt-2', timezone: 'UTC' },
          transactions: [
            { type: 'DEBT_COLLECT', amount: new Prisma.Decimal('3000.00') },
          ],
        },
      ],
    },
    reminderDelivery: { findFirst: async () => null },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.debtsChecked, 1);
  assert.equal(result.wealthRemindersSent, 0, 'No reminder for zero outstanding debt');
  assert.equal(mockBot.sentMessages.length, 0);
});

test('V2-6002: Unlinked Loan EMI reminder delivers Telegram message and creates delivery record', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-15T09:00:00.000Z');

  let createdReminder: any = null;
  let createdDelivery: any = null;
  let updatedDelivery: any = null;

  const mockDb = {
    reminder: {
      findMany: async () => [],
      findFirst: async () => createdReminder,
      create: async (args: any) => {
        createdReminder = { id: 'rem-loan-1', ...args.data };
        return createdReminder;
      },
    },
    hydrationSetting: { findMany: async () => [] },
    obligation: { findMany: async () => [] },
    personalDebt: { findMany: async () => [] },
    loan: {
      findMany: async () => [
        {
          id: 'loan-hdfc-1',
          userId: 'usr-loan-1',
          name: 'Home Loan',
          lender: 'HDFC Bank',
          emiAmount: new Prisma.Decimal('28500.00'),
          nextEmiDate: new Date('2026-10-15T09:00:00.000Z'),
          obligationId: null, // Unlinked loan
          status: 'ACTIVE',
          user: { id: 'usr-loan-1', telegramId: 'tg-loan-1', timezone: 'Asia/Kolkata' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      create: async (args: any) => {
        createdDelivery = { id: 'del-loan-101', ...args.data };
        return createdDelivery;
      },
      update: async (args: any) => {
        updatedDelivery = { ...createdDelivery, ...args.data };
        return updatedDelivery;
      },
    },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.loansChecked, 1, '1 loan checked');
  assert.equal(result.wealthRemindersSent, 1, '1 wealth reminder sent');
  assert.equal(mockBot.sentMessages.length, 1);
  assert.match(mockBot.sentMessages[0].text, /Loan EMI Reminder/);
  assert.match(mockBot.sentMessages[0].text, /Home Loan/);
  assert.match(mockBot.sentMessages[0].text, /HDFC Bank/);
  assert.match(mockBot.sentMessages[0].text, /28,500\.00/);
  assert.equal(createdReminder?.type, 'LOAN_EMI');
  assert.equal(createdReminder?.category, 'loan-hdfc-1');
  assert.equal(updatedDelivery?.status, 'SENT');
  assert.equal(updatedDelivery?.attemptCount, 1);
});

test('V2-6004: Deduplication prevents repeat delivery of debt and loan reminders on next tick', async () => {
  const mockBot = createMockBot();
  const tick1Now = new Date('2026-10-15T09:00:00.000Z');
  const tick2Now = new Date('2026-10-15T09:01:00.000Z');

  let persistentDebtDelivery: any = null;
  let persistentLoanDelivery: any = null;

  const mockDb = {
    reminder: {
      findMany: async () => [],
      findFirst: async (args: any) => ({ id: `rem-${args.where.type}` }),
    },
    hydrationSetting: { findMany: async () => [] },
    obligation: { findMany: async () => [] },
    personalDebt: {
      findMany: async () => [
        {
          id: 'debt-dup-1',
          userId: 'usr-dup',
          direction: 'PAYABLE',
          counterpartyName: 'Charlie',
          originalAmount: new Prisma.Decimal('2000.00'),
          dueAt: tick1Now,
          reminderOffsetsMin: [0],
          status: 'OPEN',
          user: { id: 'usr-dup', telegramId: 'tg-dup', timezone: 'UTC' },
          transactions: [],
        },
      ],
    },
    loan: {
      findMany: async () => [
        {
          id: 'loan-dup-1',
          userId: 'usr-dup',
          name: 'Car Loan',
          lender: 'SBI',
          emiAmount: new Prisma.Decimal('8500.00'),
          nextEmiDate: tick1Now,
          obligationId: null,
          status: 'ACTIVE',
          user: { id: 'usr-dup', telegramId: 'tg-dup', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async (args: any) => {
        if (args.where.reminderId === 'rem-PERSONAL_DEBT') return persistentDebtDelivery;
        if (args.where.reminderId === 'rem-LOAN_EMI') return persistentLoanDelivery;
        return null;
      },
      create: async (args: any) => {
        const item = { id: `del-${args.data.reminderId}`, ...args.data };
        if (args.data.reminderId === 'rem-PERSONAL_DEBT') persistentDebtDelivery = item;
        if (args.data.reminderId === 'rem-LOAN_EMI') persistentLoanDelivery = item;
        return item;
      },
      update: async (args: any) => {
        if (args.where.id === 'del-rem-PERSONAL_DEBT') {
          persistentDebtDelivery = { ...persistentDebtDelivery, ...args.data };
          return persistentDebtDelivery;
        }
        if (args.where.id === 'del-rem-LOAN_EMI') {
          persistentLoanDelivery = { ...persistentLoanDelivery, ...args.data };
          return persistentLoanDelivery;
        }
        return { id: args.where.id, ...args.data };
      },
    },
  };

  // --- Tick 1: Both deliver ---
  const result1 = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now: tick1Now,
  });

  assert.equal(result1.wealthRemindersSent, 2, 'Debt and Loan both sent on tick 1');
  assert.equal(mockBot.sentMessages.length, 2);
  assert.equal(persistentDebtDelivery?.status, 'SENT');
  assert.equal(persistentLoanDelivery?.status, 'SENT');

  // --- Tick 2: 1 minute later: Neither resends ---
  const result2 = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now: tick2Now,
  });

  assert.equal(result2.wealthRemindersSent, 0, 'Zero reminders sent on tick 2 (durable dedupe)');
  assert.equal(mockBot.sentMessages.length, 2, 'Total sent messages remained 2');
});

test('SOL-R001-008: Schedule change under target lock invalidates claim and suppresses obsolete send', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-10T10:00:00.000Z');

  const staleDue = new Date('2026-10-10T10:00:00.000Z');
  const advancedDue = new Date('2026-11-10T10:00:00.000Z');

  const mockDb = {
    reminder: { findMany: async () => [] },
    hydrationSetting: { findMany: async () => [] },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-stale-test',
          userId: 'usr-stale',
          title: 'Electricity Bill',
          amount: new Prisma.Decimal('1500.00'),
          dueAt: staleDue,
          nextDueAt: staleDue,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-stale', telegramId: 'tg-stale', timezone: 'UTC' },
          reminders: [],
        },
      ],
      findUnique: async () => ({
        id: 'ob-stale-test',
        nextDueAt: advancedDue,
        isActive: true,
      }),
    },
    reminderDelivery: {
      findFirst: async () => null,
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'ob-stale-test' }],
      obligation: {
        findUnique: async () => ({
          id: 'ob-stale-test',
          nextDueAt: advancedDue,
          isActive: true,
        }),
      },
    }),
    personalDebt: { findMany: async () => [] },
    loan: { findMany: async () => [] },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.wealthRemindersSent, 0, 'Zero reminders sent because schedule was advanced under lock');
  assert.equal(mockBot.sentMessages.length, 0, 'No Telegram messages dispatched');
});

test('SOL-R003-001: Future and stale debt schedules do NOT create SENDING claims, while due schedule creates exactly 1 claim', async () => {
  const now = new Date('2026-10-10T10:00:00.000Z');

  // Case 1: Future schedules (due in 15 days) -> 0 claims
  {
    const mockBot = createMockBot();
    let deliveryCreatedCount = 0;
    const futureDue = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const mockDb = {
      reminder: { findMany: async () => [] },
      hydrationSetting: { findMany: async () => [] },
      obligation: { findMany: async () => [] },
      personalDebt: {
        findMany: async () => [
          {
            id: 'debt-future',
            userId: 'usr-future',
            counterpartyName: 'Future Debt',
            title: 'Future Repayment',
            originalAmount: new Prisma.Decimal('5000.00'),
            dueAt: futureDue,
            status: 'OPEN',
            direction: 'RECEIVABLE',
            user: { id: 'usr-future', telegramId: 'tg-future', timezone: 'UTC' },
            transactions: [],
          },
        ],
      },
      loan: { findMany: async () => [] },
      reminderDelivery: {
        findFirst: async () => null,
      },
      $transaction: async (fn: any) => fn({
        $queryRaw: async () => [],
        personalDebt: {
          findUnique: async () => ({
            id: 'debt-future',
            status: 'OPEN',
            dueAt: futureDue,
            direction: 'RECEIVABLE',
            originalAmount: new Prisma.Decimal('5000.00'),
            transactions: [],
          }),
        },
        reminder: {
          findFirst: async () => ({ id: 'rem-future' }),
          create: async (args: any) => ({ id: 'rem-future', ...args.data }),
        },
        reminderDelivery: {
          findFirst: async () => null,
          create: async (args: any) => {
            deliveryCreatedCount++;
            return { id: 'del-future', ...args.data };
          },
        },
      }),
    };

    const result = await processSchedulerTick({
      prismaClient: mockDb as any,
      botClient: mockBot,
      now,
    });

    assert.equal(result.wealthRemindersSent, 0, 'No reminders sent for future schedule');
    assert.equal(deliveryCreatedCount, 0, 'Zero delivery claims created for future schedule');
    assert.equal(mockBot.sentMessages.length, 0);
  }

  // Case 2: Stale schedules > 7 days old -> 0 claims
  {
    const mockBot = createMockBot();
    let deliveryCreatedCount = 0;
    const staleDue = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const mockDb = {
      reminder: { findMany: async () => [] },
      hydrationSetting: { findMany: async () => [] },
      obligation: { findMany: async () => [] },
      personalDebt: {
        findMany: async () => [
          {
            id: 'debt-stale',
            userId: 'usr-stale',
            counterpartyName: 'Stale Debt',
            title: 'Stale Repayment',
            originalAmount: new Prisma.Decimal('5000.00'),
            dueAt: staleDue,
            status: 'OPEN',
            direction: 'RECEIVABLE',
            user: { id: 'usr-stale', telegramId: 'tg-stale', timezone: 'UTC' },
            transactions: [],
          },
        ],
      },
      loan: { findMany: async () => [] },
      reminderDelivery: {
        findFirst: async () => null,
      },
      $transaction: async (fn: any) => fn({
        $queryRaw: async () => [],
        personalDebt: {
          findUnique: async () => ({
            id: 'debt-stale',
            status: 'OPEN',
            dueAt: staleDue,
            direction: 'RECEIVABLE',
            originalAmount: new Prisma.Decimal('5000.00'),
            transactions: [],
          }),
        },
        reminder: {
          findFirst: async () => ({ id: 'rem-stale' }),
          create: async (args: any) => ({ id: 'rem-stale', ...args.data }),
        },
        reminderDelivery: {
          findFirst: async () => null,
          create: async (args: any) => {
            deliveryCreatedCount++;
            return { id: 'del-stale', ...args.data };
          },
        },
      }),
    };

    const result = await processSchedulerTick({
      prismaClient: mockDb as any,
      botClient: mockBot,
      now,
    });

    assert.equal(result.wealthRemindersSent, 0, 'No reminders sent for stale schedule');
    assert.equal(deliveryCreatedCount, 0, 'Zero delivery claims created for stale schedule');
    assert.equal(mockBot.sentMessages.length, 0);
  }

  // Case 3: Due schedules -> exactly 1 claim
  {
    const mockBot = createMockBot();
    let deliveryCreatedCount = 0;
    const dueTime = now;

    const mockDb = {
      reminder: { findMany: async () => [] },
      hydrationSetting: { findMany: async () => [] },
      obligation: { findMany: async () => [] },
      personalDebt: {
        findMany: async () => [
          {
            id: 'debt-due',
            userId: 'usr-due',
            counterpartyName: 'Due Debt',
            title: 'Due Repayment',
            originalAmount: new Prisma.Decimal('5000.00'),
            dueAt: dueTime,
            status: 'OPEN',
            direction: 'RECEIVABLE',
            user: { id: 'usr-due', telegramId: 'tg-due', timezone: 'UTC' },
            transactions: [],
          },
        ],
      },
      loan: { findMany: async () => [] },
      reminderDelivery: {
        findFirst: async () => null,
        updateMany: async () => ({ count: 1 }),
      },
      $transaction: async (fn: any) => fn({
        $queryRaw: async () => [],
        personalDebt: {
          findUnique: async () => ({
            id: 'debt-due',
            status: 'OPEN',
            dueAt: dueTime,
            direction: 'RECEIVABLE',
            originalAmount: new Prisma.Decimal('5000.00'),
            transactions: [],
          }),
        },
        reminder: {
          findFirst: async () => ({ id: 'rem-due' }),
          create: async (args: any) => ({ id: 'rem-due', ...args.data }),
        },
        reminderDelivery: {
          findFirst: async () => null,
          create: async (args: any) => {
            deliveryCreatedCount++;
            return { id: 'del-due', ...args.data };
          },
        },
      }),
    };

    const result = await processSchedulerTick({
      prismaClient: mockDb as any,
      botClient: mockBot,
      now,
    });

    assert.equal(result.wealthRemindersSent, 1, 'Exactly 1 reminder sent for due schedule');
    assert.equal(deliveryCreatedCount, 1, 'Exactly 1 delivery claim created for due schedule');
    assert.equal(mockBot.sentMessages.length, 1);
  }
});

test('SOL-R003-004: Delivery completion update matches claimedAttemptCount and lastAttemptAt fencing token', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-10T10:00:00.000Z');

  let updatedAttemptCounts: number[] = [];
  let updatedLastAttemptAts: any[] = [];

  const mockDb = {
    reminder: { findMany: async () => [] },
    hydrationSetting: { findMany: async () => [] },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-fencing',
          userId: 'usr-fence',
          title: 'Fencing Test Obligation',
          amount: new Prisma.Decimal('2000.00'),
          dueAt: now,
          nextDueAt: now,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-fence', telegramId: 'tg-fence', timezone: 'UTC' },
          reminders: [{ id: 'rem-fence' }],
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      updateMany: async (args: any) => {
        assert.ok(args.where.attemptCount !== undefined, 'where clause must require attemptCount');
        assert.ok(args.where.lastAttemptAt !== undefined, 'where clause must require lastAttemptAt');
        updatedAttemptCounts.push(args.where.attemptCount);
        updatedLastAttemptAts.push(args.where.lastAttemptAt);
        return { count: 1 };
      },
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'ob-fencing' }],
      obligation: {
        findUnique: async () => ({
          id: 'ob-fencing',
          nextDueAt: now,
          isActive: true,
        }),
      },
      reminder: { findFirst: async () => null },
      reminderDelivery: {
        findFirst: async () => null,
        create: async (args: any) => ({
          id: 'del-fence-1',
          attemptCount: 1,
          lastAttemptAt: now,
          ...args.data,
        }),
      },
    }),
    personalDebt: { findMany: async () => [] },
    loan: { findMany: async () => [] },
  };

  const result = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(result.wealthRemindersSent, 1);
  assert.equal(updatedAttemptCounts.length, 1);
  assert.equal(updatedAttemptCounts[0], 1, 'Completion update matched claimedAttemptCount = 1');
  assert.equal(updatedLastAttemptAts[0], now, 'Completion update matched lastAttemptAt = now');
});

test('SOL-R005-002: Expired delivery leases enforce MAX_DELIVERY_ATTEMPTS across obligation, debt, and loan branches', async () => {
  const now = new Date('2026-10-15T09:00:00.000Z');
  const expiredLastAttempt = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago (> 5m LEASE_TIMEOUT_MS)

  const updatedDeliveries: any[] = [];
  const mockBot = createMockBot();

  // Test 1: Obligation with expired lease at attemptCount = 3 (MAX_DELIVERY_ATTEMPTS)
  const mockDbExhaustedOb = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-exhausted',
          userId: 'usr-ex-ob',
          title: 'Exhausted Obligation',
          kind: 'BILL',
          amount: new Prisma.Decimal('1000.00'),
          nextDueAt: now,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-ex-ob', telegramId: 'tg-ex-ob', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => ({
        id: 'del-ex-ob',
        status: 'SENDING',
        attemptCount: 3,
        lastAttemptAt: expiredLastAttempt,
      }),
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return { id: args.where.id, ...args.data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'ob-exhausted' }],
      obligation: {
        findUnique: async () => ({
          id: 'ob-exhausted',
          nextDueAt: now,
          isActive: true,
          isArchived: false,
        }),
      },
      reminder: { findFirst: async () => ({ id: 'rem-ex-ob' }) },
      reminderDelivery: {
        findFirst: async () => ({
          id: 'del-ex-ob',
          status: 'SENDING',
          attemptCount: 3,
          lastAttemptAt: expiredLastAttempt,
        }),
        update: async (args: any) => {
          updatedDeliveries.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    }),
    personalDebt: { findMany: async () => [] },
    loan: { findMany: async () => [] },
  };

  const resOb = await processSchedulerTick({
    prismaClient: mockDbExhaustedOb as any,
    botClient: mockBot,
    now,
  });

  // Verify obligation expired lease at max attempts is marked FAILED and NOT resent
  assert.equal(resOb.wealthRemindersSent, 0, 'No reminder sent for exhausted obligation');
  assert.equal(mockBot.sentMessages.length, 0);
  const obFinalizeUpdate = updatedDeliveries.find((u) => u.where.id === 'del-ex-ob');
  assert.ok(obFinalizeUpdate, 'Update must be called on expired delivery');
  assert.equal(obFinalizeUpdate.data.status, 'FAILED', 'Must finalize status as FAILED');
  assert.equal(obFinalizeUpdate.data.attemptCount, undefined, 'Must NOT increment attemptCount');

  // Test 2: Debt with expired lease at attemptCount = 3 (MAX_DELIVERY_ATTEMPTS)
  updatedDeliveries.length = 0;
  mockBot.sentMessages.length = 0;

  const mockDbExhaustedDebt = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: { findMany: async () => [] },
    personalDebt: {
      findMany: async () => [
        {
          id: 'debt-exhausted',
          userId: 'usr-ex-debt',
          personName: 'Ravi',
          direction: 'RECEIVABLE',
          originalAmount: new Prisma.Decimal('5000.00'),
          dueAt: now,
          reminderOffsetsMin: [0],
          status: 'OPEN',
          transactions: [],
          user: { id: 'usr-ex-debt', telegramId: 'tg-ex-debt', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return { id: args.where.id, ...args.data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'debt-exhausted' }],
      personalDebt: {
        findUnique: async () => ({
          id: 'debt-exhausted',
          direction: 'RECEIVABLE',
          originalAmount: new Prisma.Decimal('5000.00'),
          dueAt: now,
          status: 'OPEN',
          transactions: [],
        }),
      },
      reminder: { findFirst: async () => ({ id: 'rem-ex-debt' }) },
      reminderDelivery: {
        findFirst: async () => ({
          id: 'del-ex-debt',
          status: 'SENDING',
          attemptCount: 3,
          lastAttemptAt: expiredLastAttempt,
        }),
        update: async (args: any) => {
          updatedDeliveries.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    }),
    loan: { findMany: async () => [] },
  };

  const resDebt = await processSchedulerTick({
    prismaClient: mockDbExhaustedDebt as any,
    botClient: mockBot,
    now,
  });

  assert.equal(resDebt.wealthRemindersSent, 0, 'No reminder sent for exhausted debt');
  assert.equal(mockBot.sentMessages.length, 0);
  const debtFinalizeUpdate = updatedDeliveries.find((u) => u.where.id === 'del-ex-debt');
  assert.ok(debtFinalizeUpdate);
  assert.equal(debtFinalizeUpdate.data.status, 'FAILED');
  assert.equal(debtFinalizeUpdate.data.attemptCount, undefined);

  // Test 3: Loan with expired lease at attemptCount = 3 (MAX_DELIVERY_ATTEMPTS)
  updatedDeliveries.length = 0;
  mockBot.sentMessages.length = 0;

  const mockDbExhaustedLoan = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: { findMany: async () => [] },
    personalDebt: { findMany: async () => [] },
    loan: {
      findMany: async () => [
        {
          id: 'loan-exhausted',
          userId: 'usr-ex-loan',
          name: 'Personal Loan',
          lender: 'SBI',
          emiAmount: new Prisma.Decimal('10000.00'),
          nextEmiDate: now,
          obligationId: null,
          reminderOffsetsMin: [0],
          status: 'ACTIVE',
          user: { id: 'usr-ex-loan', telegramId: 'tg-ex-loan', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return { id: args.where.id, ...args.data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'loan-exhausted' }],
      loan: {
        findUnique: async () => ({
          id: 'loan-exhausted',
          nextEmiDate: now,
          status: 'ACTIVE',
        }),
      },
      reminder: { findFirst: async () => ({ id: 'rem-ex-loan' }) },
      reminderDelivery: {
        findFirst: async () => ({
          id: 'del-ex-loan',
          status: 'SENDING',
          attemptCount: 3,
          lastAttemptAt: expiredLastAttempt,
        }),
        update: async (args: any) => {
          updatedDeliveries.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    }),
  };

  const resLoan = await processSchedulerTick({
    prismaClient: mockDbExhaustedLoan as any,
    botClient: mockBot,
    now,
  });

  assert.equal(resLoan.wealthRemindersSent, 0, 'No reminder sent for exhausted loan');
  assert.equal(mockBot.sentMessages.length, 0);
  const loanFinalizeUpdate = updatedDeliveries.find((u) => u.where.id === 'del-ex-loan');
  assert.ok(loanFinalizeUpdate);
  assert.equal(loanFinalizeUpdate.data.status, 'FAILED');
  assert.equal(loanFinalizeUpdate.data.attemptCount, undefined);

  // Test 4: Expired lease with attemptCount = 2 (< MAX_DELIVERY_ATTEMPTS) IS renewed as attempt 3 and sent
  updatedDeliveries.length = 0;
  mockBot.sentMessages.length = 0;

  const mockDbRenewableOb = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-renewable',
          userId: 'usr-ren-ob',
          title: 'Renewable Obligation',
          kind: 'BILL',
          amount: new Prisma.Decimal('2000.00'),
          nextDueAt: now,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-ren-ob', telegramId: 'tg-ren-ob', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => ({
        id: 'del-ren-ob',
        status: 'SENDING',
        attemptCount: 2,
        lastAttemptAt: expiredLastAttempt,
      }),
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return { id: args.where.id, ...args.data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'ob-renewable' }],
      obligation: {
        findUnique: async () => ({
          id: 'ob-renewable',
          nextDueAt: now,
          isActive: true,
          isArchived: false,
        }),
      },
      reminder: { findFirst: async () => ({ id: 'rem-ren-ob' }) },
      reminderDelivery: {
        findFirst: async () => ({
          id: 'del-ren-ob',
          status: 'SENDING',
          attemptCount: 2,
          lastAttemptAt: expiredLastAttempt,
        }),
        update: async (args: any) => {
          updatedDeliveries.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    }),
    personalDebt: { findMany: async () => [] },
    loan: { findMany: async () => [] },
  };

  const resRenew = await processSchedulerTick({
    prismaClient: mockDbRenewableOb as any,
    botClient: mockBot,
    now,
  });

  assert.equal(resRenew.wealthRemindersSent, 1, 'Renewed reminder is sent');
  assert.equal(mockBot.sentMessages.length, 1);
  const renewUpdate = updatedDeliveries.find((u) => u.where.id === 'del-ren-ob' && u.data.status === 'SENDING');
  assert.ok(renewUpdate);
  assert.equal(renewUpdate.data.attemptCount, 3, 'attemptCount incremented to 3');
});

test('SOL-R006-002: Stale expired delivery suppression (> 7 days past due)', async () => {
  const now = new Date('2026-10-25T10:00:00.000Z');
  // 14 days ago (> 7-day stale threshold)
  const staleDueAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const expiredLastAttempt = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago (> 5m LEASE_TIMEOUT_MS)

  const updatedDeliveries: any[] = [];
  const mockBot = createMockBot();

  // Test 1: Obligation with expired SENDING delivery lease but stale schedule (> 7 days past due)
  const mockDbStaleOb = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-stale-14d',
          userId: 'usr-stale-ob',
          title: 'Stale 14-day Obligation',
          kind: 'BILL',
          amount: new Prisma.Decimal('500.00'),
          nextDueAt: staleDueAt,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-stale-ob', telegramId: 'tg-stale-ob', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => ({
        id: 'del-stale-ob',
        status: 'SENDING',
        attemptCount: 1,
        lastAttemptAt: expiredLastAttempt,
      }),
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return { id: args.where.id, ...args.data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'ob-stale-14d' }],
      obligation: {
        findUnique: async () => ({
          id: 'ob-stale-14d',
          nextDueAt: staleDueAt,
          isActive: true,
          isArchived: false,
        }),
      },
      reminder: { findFirst: async () => ({ id: 'rem-stale-ob' }) },
      reminderDelivery: {
        findFirst: async () => ({
          id: 'del-stale-ob',
          status: 'SENDING',
          attemptCount: 1,
          lastAttemptAt: expiredLastAttempt,
        }),
        update: async (args: any) => {
          updatedDeliveries.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    }),
    personalDebt: { findMany: async () => [] },
    loan: { findMany: async () => [] },
  };

  const resStale = await processSchedulerTick({
    prismaClient: mockDbStaleOb as any,
    botClient: mockBot,
    now,
  });

  // Stale expired delivery must be suppressed: 0 reminders sent, 0 messages sent
  assert.equal(resStale.wealthRemindersSent, 0, 'Stale expired obligation must NOT be resent');
  assert.equal(mockBot.sentMessages.length, 0, 'No Telegram messages should be dispatched for stale occurrence');
  // It should NOT have updated delivery to SENDING (no renewal)
  const sendingUpdate = updatedDeliveries.find((u) => u.where.id === 'del-stale-ob' && u.data.status === 'SENDING');
  assert.equal(sendingUpdate, undefined, 'Stale delivery must not be renewed to SENDING');

  // Test 2: Personal Debt with expired SENDING lease but stale schedule
  const mockDbStaleDebt = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: { findMany: async () => [] },
    personalDebt: {
      findMany: async () => [
        {
          id: 'debt-stale-14d',
          userId: 'usr-stale-debt',
          direction: 'PAYABLE',
          counterpartyName: 'Alice',
          originalAmount: new Prisma.Decimal('1000.00'),
          dueAt: staleDueAt,
          status: 'OPEN',
          reminderOffsetsMin: [0],
          transactions: [],
          user: { id: 'usr-stale-debt', telegramId: 'tg-stale-debt', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => ({
        id: 'del-stale-debt',
        status: 'SENDING',
        attemptCount: 1,
        lastAttemptAt: expiredLastAttempt,
      }),
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return { id: args.where.id, ...args.data };
      },
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'debt-stale-14d' }],
      personalDebt: {
        findUnique: async () => ({
          id: 'debt-stale-14d',
          status: 'OPEN',
          dueAt: staleDueAt,
          reminderOffsetsMin: [0],
          transactions: [],
        }),
      },
      reminder: { findFirst: async () => ({ id: 'rem-stale-debt' }) },
      reminderDelivery: {
        findFirst: async () => ({
          id: 'del-stale-debt',
          status: 'SENDING',
          attemptCount: 1,
          lastAttemptAt: expiredLastAttempt,
        }),
        update: async (args: any) => {
          updatedDeliveries.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
    }),
    loan: { findMany: async () => [] },
  };

  const resStaleDebt = await processSchedulerTick({
    prismaClient: mockDbStaleDebt as any,
    botClient: mockBot,
    now,
  });

  assert.equal(resStaleDebt.wealthRemindersSent, 0, 'Stale expired debt must NOT be resent');
  assert.equal(mockBot.sentMessages.length, 0, 'No Telegram messages should be dispatched for stale debt');
});

test('SOL-R006-004: Bounded outbound send timeout preventing dual-tick duplicate sends', async () => {
  const nowTick1 = new Date('2026-10-15T10:00:00.000Z');
  const updatedDeliveries: any[] = [];

  let abortedSignalReceived = false;

  // Mock bot whose sendMessage hangs until aborted
  const hungMockBot = {
    sentMessages: [] as any[],
    api: {
      sendMessage: async (chatId: string, text: string, options?: any, signal?: AbortSignal) => {
        return new Promise<any>((resolve, reject) => {
          const sig = signal || options?.signal;
          if (sig) {
            sig.addEventListener('abort', () => {
              abortedSignalReceived = true;
              reject(sig.reason || new Error('Request aborted by signal'));
            }, { once: true });
          }
        });
      },
    },
  };

  let deliveryRecord: any = null;

  const mockDb = {
    reminder: { findMany: async () => [] },
    userHydrationSetting: { findMany: async () => [] },
    obligation: {
      findMany: async () => [
        {
          id: 'ob-hang-test',
          userId: 'usr-hang',
          title: 'Hung Message Bill',
          kind: 'BILL',
          amount: new Prisma.Decimal('1200.00'),
          nextDueAt: nowTick1,
          reminderOffsetsMin: [0],
          isActive: true,
          isArchived: false,
          user: { id: 'usr-hang', telegramId: 'tg-hang', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => deliveryRecord,
      create: async (args: any) => {
        deliveryRecord = { id: 'del-hang-test', ...args.data };
        return deliveryRecord;
      },
      update: async (args: any) => {
        deliveryRecord = { ...deliveryRecord, ...args.data };
        updatedDeliveries.push(args);
        return deliveryRecord;
      },
      updateMany: async (args: any) => {
        if (deliveryRecord && deliveryRecord.id === args.where.id) {
          deliveryRecord = { ...deliveryRecord, ...args.data };
          updatedDeliveries.push(args);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'ob-hang-test' }],
      obligation: {
        findUnique: async () => ({
          id: 'ob-hang-test',
          nextDueAt: nowTick1,
          isActive: true,
          isArchived: false,
          reminderOffsetsMin: [0],
        }),
      },
      reminder: {
        findFirst: async () => ({ id: 'rem-hang' }),
        create: async () => ({ id: 'rem-hang' }),
      },
      reminderDelivery: {
        findFirst: async () => deliveryRecord,
        create: async (args: any) => {
          deliveryRecord = { id: 'del-hang-test', ...args.data };
          return deliveryRecord;
        },
        update: async (args: any) => {
          deliveryRecord = { ...deliveryRecord, ...args.data };
          updatedDeliveries.push(args);
          return deliveryRecord;
        },
      },
    }),
    personalDebt: { findMany: async () => [] },
    loan: { findMany: async () => [] },
  };

  // Tick 1: Outbound send times out via bounded timeout (50ms)
  const resTick1 = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: hungMockBot,
    now: nowTick1,
    outboundTimeoutMs: 50, // Short timeout for test
  });

  assert.equal(resTick1.wealthRemindersSent, 0, 'Tick 1 must not count timed out message as sent');
  assert.equal(abortedSignalReceived, true, 'AbortSignal must have been triggered to cancel outbound request');

  // Verify delivery was marked FAILED with retry backoff set
  assert.ok(deliveryRecord);
  assert.equal(deliveryRecord.status, 'FAILED');
  assert.equal(deliveryRecord.attemptCount, 1);
  assert.ok(deliveryRecord.nextRetryAt, 'nextRetryAt must be set for backoff');
  assert.ok(deliveryRecord.nextRetryAt.getTime() > nowTick1.getTime(), 'nextRetryAt must be in the future');

  // Tick 2: Subsequent tick at 2 minutes later (before nextRetryAt)
  const nowTick2 = new Date(nowTick1.getTime() + 2 * 60 * 1000);
  const resTick2 = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: hungMockBot,
    now: nowTick2,
    outboundTimeoutMs: 50,
  });

  // Tick 2 must NOT attempt send because retry backoff is active
  assert.equal(resTick2.wealthRemindersSent, 0, 'Tick 2 must respect retry backoff and not duplicate send');

  // Tick 3: After backoff expires (e.g. 6 minutes later), with responsive bot
  const responsiveMockBot = createMockBot();
  const nowTick3 = new Date(nowTick1.getTime() + 6 * 60 * 1000);
  const resTick3 = await processSchedulerTick({
    prismaClient: mockDb as any,
    botClient: responsiveMockBot,
    now: nowTick3,
    outboundTimeoutMs: 50,
  });

  assert.equal(resTick3.wealthRemindersSent, 1, 'Tick 3 successfully retries after backoff');
  assert.equal(responsiveMockBot.sentMessages.length, 1, 'Exactly one message dispatched on retry');
  assert.equal(deliveryRecord.status, 'SENT');
  assert.equal(deliveryRecord.attemptCount, 2, 'attemptCount incremented to 2 on retry');
});
