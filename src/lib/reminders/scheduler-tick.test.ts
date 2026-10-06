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
