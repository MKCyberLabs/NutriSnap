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

test('SOL-R003-001: Future and stale debt and unlinked loan schedules do NOT create SENDING claims', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-10T10:00:00.000Z');

  let deliveryCreatedCount = 0;

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
          dueAt: new Date('2026-10-25T10:00:00.000Z'),
          status: 'PENDING',
          direction: 'RECEIVABLE',
          user: { id: 'usr-future', telegramId: 'tg-future', timezone: 'UTC' },
          transactions: [],
        },
      ],
    },
    loan: {
      findMany: async () => [
        {
          id: 'loan-future',
          userId: 'usr-future',
          name: 'Future Loan',
          lender: 'Future Lender',
          emiAmount: new Prisma.Decimal('3000.00'),
          nextEmiDate: new Date('2026-10-25T10:00:00.000Z'),
          obligationId: null,
          status: 'ACTIVE',
          user: { id: 'usr-future', telegramId: 'tg-future', timezone: 'UTC' },
        },
      ],
    },
    reminderDelivery: {
      findFirst: async () => null,
    },
    $transaction: async (fn: any) => fn({
      $queryRaw: async () => [],
      personalDebt: {
        findUnique: async () => ({
          id: 'debt-future',
          status: 'PENDING',
          dueAt: new Date('2026-10-25T10:00:00.000Z'),
        }),
      },
      loan: {
        findUnique: async () => ({
          id: 'loan-future',
          status: 'ACTIVE',
          nextEmiDate: new Date('2026-10-25T10:00:00.000Z'),
          obligationId: null,
        }),
      },
      reminder: { findFirst: async () => null },
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

  assert.equal(result.wealthRemindersSent, 0, 'No reminders sent for future schedules');
  assert.equal(deliveryCreatedCount, 0, 'Zero delivery claims created for future schedules');
  assert.equal(mockBot.sentMessages.length, 0);
});

test('SOL-R003-004: Delivery completion update matches claimedAttemptCount fencing token', async () => {
  const mockBot = createMockBot();
  const now = new Date('2026-10-10T10:00:00.000Z');

  let updatedAttemptCounts: number[] = [];

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
        updatedAttemptCounts.push(args.where.attemptCount);
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
});
