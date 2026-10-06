import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { WishlistService } from './wishlist-service';
import { calculateMonthlyTotals } from './finance';
import {
  createAccount,
  getAccounts,
  updateTransaction,
  deleteTransaction,
} from './finance-service';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

const db = new PrismaClient({
  datasourceUrl: TEST_DB_URL,
});

const wishlistService = new WishlistService();

async function getBalance(userId: string, accountId: string): Promise<Decimal> {
  const accounts = await getAccounts(userId, db as any);
  const acc = accounts.find((a: any) => a.id === accountId);
  if (!acc) throw new Error(`Account ${accountId} not found`);
  return new Decimal(acc.currentBalance);
}

async function getMonthlyExpense(userId: string): Promise<Decimal> {
  const txs = await db.financialTransaction.findMany({ where: { userId } });
  return calculateMonthlyTotals(txs).expense;
}

describe('V2-400: Wishlist & Planned Budgeting Test Suite (V2-T060..V2-T071)', () => {
  const userA = `test-wl-user-a-${Date.now()}`;
  const userB = `test-wl-user-b-${Date.now()}`;
  let accountA: any;
  let accountB: any;

  before(async () => {
    await db.user.createMany({
      data: [
        { id: userA, email: `${userA}@example.com`, name: 'User A', password: 'password123' },
        { id: userB, email: `${userB}@example.com`, name: 'User B', password: 'password123' },
      ],
    });

    const resA = await createAccount(
      userA,
      {
        name: 'HDFC Savings',
        type: 'BANK',
        openingBalance: '100000.00',
        currency: 'INR',
      },
      db as any
    );
    accountA = resA.account;

    const resB = await createAccount(
      userB,
      {
        name: 'SBI Savings',
        type: 'BANK',
        openingBalance: '50000.00',
        currency: 'INR',
      },
      db as any
    );
    accountB = resB.account;
  });

  after(async () => {
    await db.wishlistItem.deleteMany({
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

  test('V2-T060 & V2-T061: Create wishlist item causes NO account balance change and NO monthly expense', async () => {
    const balBefore = await getBalance(userA, accountA.id);
    const expenseBefore = await getMonthlyExpense(userA);

    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Sony WH-1000XM5',
        category: 'Electronics',
        targetPrice: '26990.00',
        maxBudget: '28000.00',
        priority: 'HIGH',
        plannedAccountId: accountA.id,
      },
      db as any
    );

    assert.ok(item.id);
    assert.equal(item.name, 'Sony WH-1000XM5');
    assert.equal(item.status, 'WISHLIST');
    assert.equal(new Decimal(item.targetPrice.toString()).toFixed(2), '26990.00');

    const balAfter = await getBalance(userA, accountA.id);
    const expenseAfter = await getMonthlyExpense(userA);

    assert.equal(balAfter.toFixed(2), balBefore.toFixed(2));
    assert.equal(expenseAfter.toFixed(2), expenseBefore.toFixed(2));
  });

  test('V2-T062: Edit target price and max budget', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Mechanical Keyboard',
        category: 'Accessories',
        targetPrice: '8000.00',
        maxBudget: '9000.00',
      },
      db as any
    );

    const updated = await wishlistService.updateWishlistItem(
      userA,
      item.id,
      {
        targetPrice: '7500.00',
        maxBudget: '8500.00',
        notes: 'Waiting for Diwali sale',
      },
      db as any
    );

    assert.equal(new Decimal(updated.targetPrice.toString()).toFixed(2), '7500.00');
    assert.equal(new Decimal(updated.maxBudget!.toString()).toFixed(2), '8500.00');
    assert.equal(updated.notes, 'Waiting for Diwali sale');
  });

  test('V2-T063: Transition wishlist item status to READY', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Ergonomic Chair',
        category: 'Furniture',
        targetPrice: '15000.00',
      },
      db as any
    );

    const updated = await wishlistService.updateWishlistItem(
      userA,
      item.id,
      { status: 'READY' },
      db as any
    );

    assert.equal(updated.status, 'READY');
  });

  test('V2-T064: Mark purchased without transaction creates no expense and does not alter account balance', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Gift Watch',
        category: 'Personal',
        targetPrice: '5000.00',
      },
      db as any
    );

    const balBefore = await getBalance(userA, accountA.id);
    const expenseBefore = await getMonthlyExpense(userA);

    const res = await wishlistService.markPurchased(
      userA,
      item.id,
      {
        actualPrice: '4800.00',
        createExpense: false,
      },
      db as any
    );

    assert.equal(res.item.status, 'PURCHASED');
    assert.equal(new Decimal(res.item.actualPrice!.toString()).toFixed(2), '4800.00');
    assert.equal(res.item.transactionId, null);
    assert.equal(res.alreadyPurchased, false);

    const balAfter = await getBalance(userA, accountA.id);
    const expenseAfter = await getMonthlyExpense(userA);

    assert.equal(balAfter.toFixed(2), balBefore.toFixed(2));
    assert.equal(expenseAfter.toFixed(2), expenseBefore.toFixed(2));
  });

  test('V2-T065 & V2-T067: Mark purchased with expense creates exactly one FinancialTransaction and decrements balance', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Apple iPad Air',
        category: 'Electronics',
        targetPrice: '59900.00',
        plannedAccountId: accountA.id,
      },
      db as any
    );

    const balBefore = await getBalance(userA, accountA.id);
    const expenseBefore = await getMonthlyExpense(userA);

    const res = await wishlistService.markPurchased(
      userA,
      item.id,
      {
        actualPrice: '56900.00',
        accountId: accountA.id,
        createExpense: true,
        note: 'Purchased on festive offer',
      },
      db as any
    );

    assert.equal(res.item.status, 'PURCHASED');
    assert.ok(res.item.transactionId);
    assert.equal(new Decimal(res.item.actualPrice!.toString()).toFixed(2), '56900.00');

    // Verify linked transaction
    const tx = await db.financialTransaction.findUnique({
      where: { id: res.item.transactionId! },
    });
    assert.ok(tx);
    assert.equal(tx!.type, 'EXPENSE');
    assert.equal(new Decimal(tx!.amount.toString()).toFixed(2), '56900.00');
    assert.equal(tx!.accountId, accountA.id);

    // Verify account balance decremented by 56,900
    const balAfter = await getBalance(userA, accountA.id);
    assert.equal(balAfter.toFixed(2), balBefore.minus(56900).toFixed(2));

    // Verify monthly totals incremented by 56,900
    const expenseAfter = await getMonthlyExpense(userA);
    assert.equal(expenseAfter.toFixed(2), expenseBefore.plus(56900).toFixed(2));
  });

  test('V2-T066: Repeat mark purchased is idempotent and does not duplicate expense', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Kindle Paperwhite',
        category: 'Books',
        targetPrice: '14000.00',
      },
      db as any
    );

    const first = await wishlistService.markPurchased(
      userA,
      item.id,
      {
        actualPrice: '13500.00',
        accountId: accountA.id,
        createExpense: true,
      },
      db as any
    );
    assert.equal(first.alreadyPurchased, false);

    const balAfterFirst = await getBalance(userA, accountA.id);

    // Repeated invocation
    const second = await wishlistService.markPurchased(
      userA,
      item.id,
      {
        actualPrice: '13500.00',
        accountId: accountA.id,
        createExpense: true,
      },
      db as any
    );

    assert.equal(second.alreadyPurchased, true);
    assert.equal(second.transactionId, first.transactionId);

    // Balance remains unchanged
    const balAfterSecond = await getBalance(userA, accountA.id);
    assert.equal(balAfterSecond.toFixed(2), balAfterFirst.toFixed(2));
  });

  test('V2-T068: Cross-user wishlist item access and mutation rejected', async () => {
    const itemA = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Secret Item User A',
        category: 'Personal',
        targetPrice: '1000.00',
      },
      db as any
    );

    // User B attempts to access item A
    await assert.rejects(
      async () => await wishlistService.getWishlistItemById(userB, itemA.id, db as any),
      /access denied/i
    );

    // User B attempts to update item A
    await assert.rejects(
      async () => await wishlistService.updateWishlistItem(userB, itemA.id, { targetPrice: '500.00' }, db as any),
      /access denied/i
    );

    // User B attempts to mark purchased item A
    await assert.rejects(
      async () =>
        await wishlistService.markPurchased(
          userB,
          itemA.id,
          { actualPrice: '1000.00', accountId: accountB.id },
          db as any
        ),
      /access denied/i
    );

    // User A cannot link User B's account
    await assert.rejects(
      async () =>
        await wishlistService.createWishlistItem(
          userA,
          {
            name: 'Item with forged account',
            category: 'Gadgets',
            targetPrice: '2000.00',
            plannedAccountId: accountB.id,
          },
          db as any
        ),
      /access denied/i
    );
  });

  test('V2-T069 & V2-T070: Generic transaction edit and delete rejected on wishlist-linked transaction (409 Conflict)', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Noise Cancelling Earbuds',
        category: 'Electronics',
        targetPrice: '10000.00',
      },
      db as any
    );

    const purchaseRes = await wishlistService.markPurchased(
      userA,
      item.id,
      {
        actualPrice: '9500.00',
        accountId: accountA.id,
        createExpense: true,
      },
      db as any
    );

    const txId = purchaseRes.transactionId!;
    assert.ok(txId);

    // Attempt generic update
    await assert.rejects(
      async () =>
        await updateTransaction(
          userA,
          txId,
          { amount: '5000.00' },
          db as any
        ),
      /cannot be modified directly through generic transaction editor/i
    );

    // Attempt generic delete
    await assert.rejects(
      async () => await deleteTransaction(userA, txId, db as any),
      /cannot be deleted directly through generic transaction/i
    );
  });

  test('V2-T071: Wishlist "Unmark as Purchased" atomically deletes linked transaction, restores account balance, and resets status to READY', async () => {
    const item = await wishlistService.createWishlistItem(
      userA,
      {
        name: 'Espresso Machine',
        category: 'Home',
        targetPrice: '25000.00',
      },
      db as any
    );

    const balBefore = await getBalance(userA, accountA.id);

    // Purchase item
    const purchaseRes = await wishlistService.markPurchased(
      userA,
      item.id,
      {
        actualPrice: '24000.00',
        accountId: accountA.id,
        createExpense: true,
      },
      db as any
    );

    const txId = purchaseRes.transactionId!;
    const balPurchased = await getBalance(userA, accountA.id);
    assert.equal(balPurchased.toFixed(2), balBefore.minus(24000).toFixed(2));

    // Reversal flow: unmark purchased
    const reverted = await wishlistService.unmarkPurchased(userA, item.id, 'READY', db as any);

    assert.equal(reverted.status, 'READY');
    assert.equal(reverted.actualPrice, null);
    assert.equal(reverted.purchasedAt, null);
    assert.equal(reverted.transactionId, null);

    // Linked transaction must be deleted
    const deletedTx = await db.financialTransaction.findUnique({
      where: { id: txId },
    });
    assert.equal(deletedTx, null);

    // Balance restored to exactly balBefore
    const balRestored = await getBalance(userA, accountA.id);
    assert.equal(balRestored.toFixed(2), balBefore.toFixed(2));
  });
});
