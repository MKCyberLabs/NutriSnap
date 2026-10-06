import assert from 'node:assert/strict';
import test from 'node:test';
import * as financeService from '../finance/finance-service';
import { normalizeTransactionCategory, Decimal } from '../finance/finance';

test('NSV01-0630: Telegram /expense operates in cookie-free environment', async () => {
  // Simulating Telegram webhook context: no Next.js cookies, no browser session
  const telegramUserId = 'usr-tg-user-123';
  const createdTransactions: any[] = [];

  const mockDb = {
    financialAccount: {
      findMany: async ({ where }: any) => {
        if (where.userId === telegramUserId && where.isActive) {
          return [
            {
              id: 'acc-tg-1',
              name: 'Primary Checking',
              type: 'BANK',
              openingBalance: new Decimal('5000.00'),
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              transactions: createdTransactions,
              transfersTo: [],
            }
          ];
        }
        return [];
      },
      findUnique: async ({ where }: any) => {
        if (where.id === 'acc-tg-1') {
          return { id: 'acc-tg-1', userId: telegramUserId, isActive: true };
        }
        return null;
      }
    },
    financialTransaction: {
      create: async ({ data }: any) => {
        const tx = { id: `tx-${Date.now()}`, ...data };
        createdTransactions.push(tx);
        return tx;
      }
    }
  };

  // 1. Resolve user accounts from telegramUserId (no cookies)
  const accounts = await financeService.getAccounts(telegramUserId, mockDb as any);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].name, 'Primary Checking');

  // 2. Parse and normalize /expense 450 food lunch
  const rawCategory = 'food';
  const normalizedCategory = normalizeTransactionCategory(rawCategory);
  assert.equal(normalizedCategory, 'Food');

  // 3. Record transaction directly via financeService
  const result = await financeService.recordTransaction(telegramUserId, {
    type: 'EXPENSE',
    amount: '450.00',
    category: normalizedCategory,
    accountId: accounts[0].id,
    occurredAt: new Date(),
    note: 'lunch at cafe',
  }, mockDb as any);

  assert.equal(result.success, true);
  assert.equal(result.transaction.amount, '450');
  assert.equal(result.transaction.category, 'Food');
  assert.equal(createdTransactions.length, 1);
});

test('NSV01-0631: Telegram Paid callback idempotency and duplicate suppression', async () => {
  const telegramUserId = 'usr-tg-user-123';
  const obligationId = 'ob-recharge-1';
  const occurrenceKey = '2026-10-15T09:00';

  const occurrences = new Map<string, any>();
  const transactions: any[] = [];
  let obligationCurrentDue = new Date('2026-10-15T09:00:00.000Z');

  const mockDb = {
    obligation: {
      findUnique: async ({ where }: any) => {
        if (where.id === obligationId) {
          return {
            id: obligationId,
            userId: telegramUserId,
            title: 'Airtel Prepaid',
            kind: 'RECHARGE',
            amount: new Decimal('719.00'),
            accountId: 'acc-tg-1',
            dueAt: new Date('2026-10-15T09:00:00.000Z'),
            nextDueAt: obligationCurrentDue,
            recurrenceType: 'EVERY_N_DAYS',
            recurrenceInterval: 84,
            isActive: true,
          };
        }
        return null;
      },
      update: async ({ data }: any) => {
        if (data.nextDueAt) obligationCurrentDue = data.nextDueAt;
        return { id: obligationId, nextDueAt: obligationCurrentDue };
      }
    },
    financialAccount: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'acc-tg-1') return { id: 'acc-tg-1', userId: telegramUserId };
        return null;
      }
    },
    obligationOccurrence: {
      findUnique: async ({ where }: any) => {
        const key = `${where.obligationId_occurrenceKey.obligationId}:${where.obligationId_occurrenceKey.occurrenceKey}`;
        return occurrences.get(key) || null;
      },
      create: async ({ data }: any) => {
        const occ = { id: `occ-${Date.now()}`, ...data };
        occurrences.set(`${data.obligationId}:${data.occurrenceKey}`, occ);
        return occ;
      }
    },
    financialTransaction: {
      create: async ({ data }: any) => {
        const tx = { id: `tx-${Date.now()}`, ...data };
        transactions.push(tx);
        return tx;
      }
    },
    reminderDelivery: {
      updateMany: async () => ({ count: 1 })
    },
    user: {
      findUnique: async () => ({ timezone: 'UTC' })
    },
    $transaction: async (fn: any) => fn(mockDb)
  };

  // First callback invocation: marks paid, creates 1 expense, advances nextDueAt by 84 days
  const firstResult = await financeService.markObligationPaid(telegramUserId, {
    obligationId,
    occurrenceKey,
    createExpense: true,
  }, mockDb as any);

  assert.equal(firstResult.success, true);
  assert.equal(firstResult.alreadyCompleted, false);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount.toString(), '719');
  assert.equal(transactions[0].category, 'Recharge');

  // Verify next due is advanced 84 days: Oct 15 + 84 days = Jan 7, 2027
  const expectedNextDue = new Date('2027-01-07T09:00:00.000Z');
  assert.equal(firstResult.nextDueAt, expectedNextDue.toISOString());

  // Second callback invocation (repeated click / network retry): idempotent, no second expense
  const secondResult = await financeService.markObligationPaid(telegramUserId, {
    obligationId,
    occurrenceKey,
    createExpense: true,
  }, mockDb as any);

  assert.equal(secondResult.success, true);
  assert.equal(secondResult.alreadyCompleted, true);
  assert.equal(transactions.length, 1, 'Duplicate callback MUST NOT create a second expense transaction');
  assert.equal(secondResult.nextDueAt, expectedNextDue.toISOString(), 'Next due must remain unchanged on repeat');
});

test('NSV01-0632: Telegram Paid callback cross-user rejection', async () => {
  const victimUserId = 'usr-victim-1';
  const attackerUserId = 'usr-attacker-2';
  const obligationId = 'ob-victim-1';

  const mockDb = {
    obligation: {
      findUnique: async ({ where }: any) => {
        if (where.id === obligationId) {
          return {
            id: obligationId,
            userId: victimUserId,
            title: 'Victim Electricity Bill',
            nextDueAt: new Date(),
          };
        }
        return null;
      }
    }
  };

  // Attacker attempts to mark victim's obligation as paid via callback
  await assert.rejects(
    async () => {
      await financeService.markObligationPaid(attackerUserId, {
        obligationId,
        occurrenceKey: '2026-10-15T09:00',
      }, mockDb as any);
    },
    /Obligation not found or unauthorized/,
    'Telegram callback on foreign obligation must be rejected'
  );
});
