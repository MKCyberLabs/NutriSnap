import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { getMoneyOverview, createAccount } from './finance-service';
import { createDebt } from './debt-service';
import { createLoan } from './loan-service';
import { WishlistService } from './wishlist-service';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

const db = new PrismaClient({
  datasourceUrl: TEST_DB_URL,
});

const wishlistService = new WishlistService();

describe('V2-500: Money Overview Read Model Test Suite (V2-5001..V2-5007)', () => {
  const userA = `test-ov-user-a-${Date.now()}`;
  const userB = `test-ov-user-b-${Date.now()}`;
  let accountA: any;

  before(async () => {
    await db.user.createMany({
      data: [
        { id: userA, email: `${userA}@example.com`, name: 'Overview User A', password: 'password123' },
        { id: userB, email: `${userB}@example.com`, name: 'Overview User B', password: 'password123' },
      ],
    });

    const resA = await createAccount(
      userA,
      {
        name: 'Main Bank',
        type: 'BANK',
        openingBalance: '75000.00',
        currency: 'INR',
      },
      db as any
    );
    accountA = resA.account;

    // Create receivable for User A
    await createDebt(
      userA,
      {
        direction: 'RECEIVABLE',
        counterpartyName: 'Rahul',
        originalAmount: '12000.00',
        dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      db as any
    );

    // Create payable for User A
    await createDebt(
      userA,
      {
        direction: 'PAYABLE',
        counterpartyName: 'Priya',
        originalAmount: '4500.00',
        dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      db as any
    );

    // Create loan for User A
    await createLoan(
      userA,
      {
        name: 'Auto Loan',
        lender: 'HDFC',
        loanType: 'VEHICLE',
        openingOutstanding: '350000.00',
        emiAmount: '11500.00',
        dueDay: 10,
        createLinkedObligation: true,
      },
      db as any
    );

    // Create wishlist items for User A
    await wishlistService.createWishlistItem(
      userA,
      {
        name: 'MacBook Pro',
        category: 'Electronics',
        targetPrice: '169900.00',
        priority: 'HIGH',
        status: 'READY',
      },
      db as any
    );

    await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Noise Cancelling Headphones',
        category: 'Gadgets',
        targetPrice: '25000.00',
        priority: 'MEDIUM',
        status: 'WISHLIST',
      },
      db as any
    );

    // Create separate records for User B
    await createDebt(
      userB,
      {
        direction: 'RECEIVABLE',
        counterpartyName: 'Foreign Person',
        originalAmount: '99999.00',
      },
      db as any
    );
  });

  after(async () => {
    await db.wishlistItem.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.loanPayment.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.loan.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.obligationOccurrence.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.obligation.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.personalDebt.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.financialTransaction.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.financialAccount.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [userA, userB] } },
    });
    await db.$disconnect();
  });

  test('V2-5001..V2-5006: Money Overview aggregates liquid balance, debts, loans, and wishlist accurately', async () => {
    const ov = await getMoneyOverview(userA, new Date(), db as any);

    // Liquid balance = 75,000 (opening balance of Main Bank)
    assert.equal(ov.liquidBalance, '75000.00');

    // Debts: Rahul owes 12,000; User A owes Priya 4,500
    assert.equal(ov.receivablesOutstanding, '12000.00');
    assert.equal(ov.payablesOutstanding, '4500.00');

    // Loan: Auto loan 350,000 outstanding, 11,500 monthly EMI
    assert.equal(ov.totalLoanOutstanding, '350000.00');
    assert.equal(ov.monthlyEmiCommitment, '11500.00');
    assert.ok(ov.nextEmi);
    assert.equal(ov.nextEmi?.name, 'Auto Loan');
    assert.equal(ov.nextEmi?.lender, 'HDFC');
    assert.equal(ov.nextEmi?.amount, '11500.00');

    // Wishlist: 169,900 + 25,000 = 194,900 planned; 169,900 ready
    assert.equal(ov.wishlistPlannedTotal, '194900.00');
    assert.equal(ov.wishlistReadyTotal, '169900.00');
    assert.equal(ov.activeWishlistCount, 2);
    assert.equal(ov.highPriorityWishlist.length, 2);
    assert.equal(ov.highPriorityWishlist[0].name, 'MacBook Pro');
    assert.equal(ov.highPriorityWishlist[0].priority, 'HIGH');

    // Debts due soon includes Rahul and Priya
    assert.equal(ov.debtsDueSoon.length, 2);
  });

  test('V2-5007: Overview is strictly scoped to authenticated user and does not leak User B data', async () => {
    const ovA = await getMoneyOverview(userA, new Date(), db as any);
    // User A should NOT see User B's 99,999 debt
    assert.equal(ovA.receivablesOutstanding, '12000.00');

    const ovB = await getMoneyOverview(userB, new Date(), db as any);
    assert.equal(ovB.receivablesOutstanding, '99999.00');
    assert.equal(ovB.payablesOutstanding, '0.00');
    assert.equal(ovB.totalLoanOutstanding, '0.00');
    assert.equal(ovB.wishlistPlannedTotal, '0.00');
  });
});
