import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '../../../prisma/generated/client';
import * as financeService from '../finance/finance-service';
import { getOccurrenceKey } from '../recurrence/recurrence';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('NSV01-1101..1116: Real PostgreSQL-backed Health + Wealth Acceptance Scenario', async () => {
  const testPrisma = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    // 0. Setup isolated test user
    const testUser = await testPrisma.user.create({
      data: {
        id: `usr-acc-${Date.now()}`,
        email: `acc-${Date.now()}@nutrisnap.test`,
        name: 'Acceptance Tester',
        password: 'secure-test-password',
        timezone: 'Asia/Kolkata',
        dailyCaloriesGoal: 2200,
        dailyWaterGoal: 3000,
      }
    });

    const userId = testUser.id;

    // --- Step 1: Create Bank account with ₹10,000 opening balance ---
    const bankRes = await financeService.createAccount(userId, {
      name: 'HDFC Salary Bank',
      type: 'BANK',
      openingBalance: '10000.00',
    }, testPrisma);
    assert.equal(bankRes.success, true);
    const bankId = bankRes.account.id;

    // --- Step 2: Create Cash account with ₹1,000 opening balance ---
    const cashRes = await financeService.createAccount(userId, {
      name: 'Wallet Cash',
      type: 'CASH',
      openingBalance: '1000.00',
    }, testPrisma);
    assert.equal(cashRes.success, true);
    const cashId = cashRes.account.id;

    // --- Step 3: Record ₹5,000 income to Bank ---
    const incomeRes = await financeService.recordTransaction(userId, {
      type: 'INCOME',
      amount: '5000.00',
      category: 'Salary',
      accountId: bankId,
      occurredAt: new Date('2026-10-01T10:00:00.000Z'),
      note: 'October consulting payout',
    }, testPrisma);
    assert.equal(incomeRes.success, true);

    // --- Step 4: Record ₹500 Food expense from Bank ---
    const expenseRes = await financeService.recordTransaction(userId, {
      type: 'EXPENSE',
      amount: '500.00',
      category: 'Food',
      accountId: bankId,
      occurredAt: new Date('2026-10-02T13:00:00.000Z'),
      note: 'Healthy lunch meal',
    }, testPrisma);
    assert.equal(expenseRes.success, true);

    // --- Step 5: Transfer ₹1,000 Bank → Cash ---
    const transferRes = await financeService.recordTransaction(userId, {
      type: 'TRANSFER',
      amount: '1000.00',
      category: 'Transfer',
      accountId: bankId,
      transferAccountId: cashId,
      occurredAt: new Date('2026-10-03T15:00:00.000Z'),
      note: 'ATM withdrawal',
    }, testPrisma);
    assert.equal(transferRes.success, true);

    // Verify derived balances in database
    const accounts = await financeService.getAccounts(userId, testPrisma);
    const bankAcc = accounts.find((a: any) => a.id === bankId);
    const cashAcc = accounts.find((a: any) => a.id === cashId);

    // Bank: 10,000 + 5,000 - 500 - 1,000 = 13,500
    assert.equal(bankAcc.currentBalance, '13500');
    // Cash: 1,000 + 1,000 = 2,000
    assert.equal(cashAcc.currentBalance, '2000');

    // Verify monthly totals: Transfer must NOT alter income or expense totals
    let summary = await financeService.getMonthlyFinanceSummary(
      userId,
      new Date('2026-10-05T12:00:00.000Z'),
      testPrisma
    );
    assert.equal(summary.income, '5000');
    assert.equal(summary.expense, '500');
    assert.equal(summary.totalBalance, '15500'); // 13,500 + 2,000
    assert.equal(summary.categoryBreakdown['Food'], '500');

    // --- Step 6 & 7: Create Airtel Recharge obligation ₹719 anchored to known date with 84-day recurrence ---
    const rechargeAnchor = new Date('2026-10-15T09:00:00.000Z');
    const obligationRes = await financeService.createObligation(userId, {
      title: 'Airtel 84-Day Recharge',
      kind: 'RECHARGE',
      amount: '719.00',
      accountId: bankId,
      dueAt: rechargeAnchor,
      recurrenceType: 'EVERY_N_DAYS',
      recurrenceInterval: 84,
      reminderOffsetsMin: [10080, 1440, 0], // 7 days (10080m), 1 day (1440m), due day (0m)
      notes: 'Main 5G mobile pack',
    }, testPrisma);

    assert.equal(obligationRes.success, true);
    const obligationId = obligationRes.obligation.id;

    // Verify obligation stored in DB
    const dbObligation = await testPrisma.obligation.findUnique({
      where: { id: obligationId },
    });
    assert.ok(dbObligation);
    assert.equal(dbObligation.amount?.toString(), '719');
    assert.equal(dbObligation.nextDueAt.toISOString(), rechargeAnchor.toISOString());

    // --- Step 8 & 9: Evaluate scheduler & delivery idempotency in DB ---
    const occurrenceKey = getOccurrenceKey(rechargeAnchor, testUser.timezone);

    // Create linked reminder for this obligation
    const reminder = await testPrisma.reminder.create({
      data: {
        userId,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        title: 'Airtel 84-Day Recharge',
        obligationId,
        recurrenceType: 'EVERY_N_DAYS',
        recurrenceInterval: 84,
        reminderOffsetsMin: [10080, 1440, 0],
        isActive: true,
      }
    });

    // Create delivery for 7-day offset
    const del1 = await testPrisma.reminderDelivery.create({
      data: {
        userId,
        reminderId: reminder.id,
        obligationId,
        occurrenceKey,
        scheduledFor: new Date('2026-10-08T09:00:00.000Z'),
        offsetMinutes: 10080,
        channel: 'TELEGRAM',
        status: 'SENT',
        sentAt: new Date(),
      }
    });
    assert.ok(del1.id);

    // Duplicate attempt for the same reminder, occurrenceKey, offsetMinutes, and channel must be rejected by unique constraint
    await assert.rejects(
      async () => {
        await testPrisma.reminderDelivery.create({
          data: {
            userId,
            reminderId: reminder.id,
            obligationId,
            occurrenceKey,
            scheduledFor: new Date('2026-10-08T09:00:00.000Z'),
            offsetMinutes: 10080,
            channel: 'TELEGRAM',
            status: 'PENDING',
          }
        });
      },
      /Unique constraint failed/
    );

    // --- Step 10 & 11: Mark recharge Paid with expense creation ---
    const paidResult1 = await financeService.markObligationPaid(userId, {
      obligationId,
      occurrenceKey,
      createExpense: true,
      accountId: bankId,
    }, testPrisma);

    assert.equal(paidResult1.success, true);
    assert.equal(paidResult1.alreadyCompleted, false);
    assert.ok(paidResult1.transactionId);

    // Verify exactly one ₹719 expense was created
    const rechargeExpenses = await testPrisma.financialTransaction.findMany({
      where: { obligationId, type: 'EXPENSE' }
    });
    assert.equal(rechargeExpenses.length, 1);
    assert.equal(rechargeExpenses[0].amount.toString(), '719');
    assert.equal(rechargeExpenses[0].category, 'Recharge');

    // --- Step 12: Repeat Paid callback (must be idempotent: no duplicate expense) ---
    const paidResult2 = await financeService.markObligationPaid(userId, {
      obligationId,
      occurrenceKey,
      createExpense: true,
      accountId: bankId,
    }, testPrisma);

    assert.equal(paidResult2.success, true);
    assert.equal(paidResult2.alreadyCompleted, true);
    assert.equal(paidResult2.transactionId, paidResult1.transactionId);

    // Verify STILL exactly one ₹719 expense exists in DB
    const rechargeExpensesAfterRepeat = await testPrisma.financialTransaction.findMany({
      where: { obligationId, type: 'EXPENSE' }
    });
    assert.equal(rechargeExpensesAfterRepeat.length, 1, 'Duplicate paid must NOT create second expense');

    // --- Step 13: Verify next due date = previous occurrence + 84 days ---
    // Oct 15, 2026 + 84 days = Jan 7, 2027
    const expectedNextDue = new Date('2027-01-07T09:00:00.000Z');
    const updatedObligation = await testPrisma.obligation.findUnique({
      where: { id: obligationId }
    });
    assert.ok(updatedObligation);
    assert.equal(
      updatedObligation.nextDueAt.toISOString(),
      expectedNextDue.toISOString(),
      'Next due date must be exactly +84 days'
    );

    // --- Step 14: Verify Today shows updated monthly expense and upcoming next recharge ---
    summary = await financeService.getMonthlyFinanceSummary(
      userId,
      new Date('2026-10-05T12:00:00.000Z'),
      testPrisma
    );
    // 500 (Food) + 719 (Recharge) = 1219
    assert.equal(summary.expense, '1219');
    assert.equal(summary.income, '5000');
    assert.equal(summary.categoryBreakdown['Food'], '500');
    assert.equal(summary.categoryBreakdown['Recharge'], '719');

    // Verify bank account updated balance: 13,500 - 719 = 12,781
    const finalAccounts = await financeService.getAccounts(userId, testPrisma);
    const finalBank = finalAccounts.find((a: any) => a.id === bankId);
    assert.equal(finalBank.currentBalance, '12781');

    // Cleanup test data
    await testPrisma.user.delete({ where: { id: userId } });
  } finally {
    await testPrisma.$disconnect();
  }
});
