import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
import * as financeService from './finance-service';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('V2-100: Safe Update Foundation Suite (V2-T080..V2-T089 & Authorization Negatives)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const userA = await db.user.create({
      data: {
        id: `usr-a-${timestamp}`,
        email: `usra-${timestamp}@test.local`,
        name: 'User Alpha',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userB = await db.user.create({
      data: {
        id: `usr-b-${timestamp}`,
        email: `usrb-${timestamp}@test.local`,
        name: 'User Beta',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    // -------------------------------------------------------------------------
    // V2-T080: Account metadata update
    // -------------------------------------------------------------------------
    const acc1Res = await financeService.createAccount(userA.id, {
      name: 'Initial Bank Name',
      type: 'BANK',
      institution: 'Old Bank',
      openingBalance: '1000.00',
    }, db);
    assert.equal(acc1Res.success, true);
    const acc1Id = acc1Res.account.id;

    const updateAccRes = await financeService.updateAccount(userA.id, acc1Id, {
      name: 'Updated Bank Name',
      institution: 'New Bank Corp',
      creditLimit: '50000.00',
    }, db);
    assert.equal(updateAccRes.success, true);
    assert.equal(updateAccRes.account.name, 'Updated Bank Name');
    assert.equal(updateAccRes.account.institution, 'New Bank Corp');
    assert.equal(updateAccRes.account.creditLimit, '50000');

    // -------------------------------------------------------------------------
    // V2-T081a: openingBalance editable when zero posted transactions exist
    // -------------------------------------------------------------------------
    const updateObZeroRes = await financeService.updateAccount(userA.id, acc1Id, {
      openingBalance: '2500.00',
    }, db);
    assert.equal(updateObZeroRes.success, true);
    assert.equal(updateObZeroRes.account.openingBalance, '2500');

    // Post 1 transaction to acc1
    const tx1Res = await financeService.recordTransaction(userA.id, {
      type: 'INCOME',
      amount: '500.00',
      category: 'Salary',
      accountId: acc1Id,
      occurredAt: new Date(),
    }, db);
    assert.equal(tx1Res.success, true);
    const tx1Id = tx1Res.transaction.id;

    // -------------------------------------------------------------------------
    // V2-T081b: openingBalance edit rejected when >= 1 transaction exists
    // -------------------------------------------------------------------------
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userA.id, acc1Id, {
          openingBalance: '5000.00',
        }, db);
      },
      /Opening balance cannot be modified after transactions have been posted/
    );

    // -------------------------------------------------------------------------
    // V2-T082: Standalone expense edit recalculates account
    // -------------------------------------------------------------------------
    const exp1Res = await financeService.recordTransaction(userA.id, {
      type: 'EXPENSE',
      amount: '300.00',
      category: 'Food',
      accountId: acc1Id,
      occurredAt: new Date(),
    }, db);
    assert.equal(exp1Res.success, true);
    const exp1Id = exp1Res.transaction.id;

    // Before edit: opening 2500 + income 500 - expense 300 = 2700
    let accounts = await financeService.getAccounts(userA.id, db);
    let targetAcc = accounts.find((a: any) => a.id === acc1Id);
    assert.equal(targetAcc.currentBalance, '2700');

    // Update expense to 600
    const editExpRes = await financeService.updateTransaction(userA.id, exp1Id, {
      amount: '600.00',
    }, db);
    assert.equal(editExpRes.success, true);

    // After edit: opening 2500 + income 500 - expense 600 = 2400
    accounts = await financeService.getAccounts(userA.id, db);
    targetAcc = accounts.find((a: any) => a.id === acc1Id);
    assert.equal(targetAcc.currentBalance, '2400');

    // -------------------------------------------------------------------------
    // V2-T083: Standalone income edit recalculates account
    // -------------------------------------------------------------------------
    // Update income tx1 from 500 to 1200
    const editIncRes = await financeService.updateTransaction(userA.id, tx1Id, {
      amount: '1200.00',
    }, db);
    assert.equal(editIncRes.success, true);

    // After edit: opening 2500 + income 1200 - expense 600 = 3100
    accounts = await financeService.getAccounts(userA.id, db);
    targetAcc = accounts.find((a: any) => a.id === acc1Id);
    assert.equal(targetAcc.currentBalance, '3100');

    // -------------------------------------------------------------------------
    // V2-T084: Transfer edit moves balances atomically
    // -------------------------------------------------------------------------
    const acc2Res = await financeService.createAccount(userA.id, {
      name: 'Second Bank',
      type: 'BANK',
      openingBalance: '1000.00',
    }, db);
    const acc2Id = acc2Res.account.id;

    // Transfer 500 from acc1 -> acc2
    const xferRes = await financeService.recordTransaction(userA.id, {
      type: 'TRANSFER',
      amount: '500.00',
      category: 'Transfer',
      accountId: acc1Id,
      transferAccountId: acc2Id,
      occurredAt: new Date(),
    }, db);
    const xferId = xferRes.transaction.id;

    // acc1: 3100 - 500 = 2600. acc2: 1000 + 500 = 1500
    accounts = await financeService.getAccounts(userA.id, db);
    assert.equal(accounts.find((a: any) => a.id === acc1Id).currentBalance, '2600');
    assert.equal(accounts.find((a: any) => a.id === acc2Id).currentBalance, '1500');

    // Edit transfer amount to 900
    const editXferRes = await financeService.updateTransaction(userA.id, xferId, {
      amount: '900.00',
    }, db);
    assert.equal(editXferRes.success, true);

    // acc1: 3100 - 900 = 2200. acc2: 1000 + 900 = 1900
    accounts = await financeService.getAccounts(userA.id, db);
    assert.equal(accounts.find((a: any) => a.id === acc1Id).currentBalance, '2200');
    assert.equal(accounts.find((a: any) => a.id === acc2Id).currentBalance, '1900');

    // -------------------------------------------------------------------------
    // V2-T085 & V2-T086: Obligation future edit & past occurrence immutability
    // -------------------------------------------------------------------------
    const dueAtDate = new Date('2026-10-10T10:00:00.000Z');
    const obRes = await financeService.createObligation(userA.id, {
      title: 'Electricity Bill',
      kind: 'BILL',
      amount: '1500.00',
      accountId: acc1Id,
      dueAt: dueAtDate,
      recurrenceType: 'MONTHLY',
    }, db);
    assert.equal(obRes.success, true);
    const obId = obRes.obligation.id;

    // Mark current occurrence paid
    const markRes = await financeService.markObligationPaid(userA.id, {
      obligationId: obId,
      occurrenceKey: '2026-10-10',
      createExpense: true,
      accountId: acc1Id,
    }, db);
    assert.equal(markRes.success, true);
    const paidOccurrenceId = markRes.occurrenceId;
    const paidTxId = markRes.transactionId;

    // Check occurrence in DB
    const occBefore = await db.obligationOccurrence.findUnique({
      where: { id: paidOccurrenceId }
    });
    assert.equal(occBefore?.occurrenceKey, '2026-10-10');
    assert.equal(occBefore?.transactionId, paidTxId);

    // Edit future obligation definition (title, amount, new dueAt)
    const newDueAt = new Date('2026-11-15T10:00:00.000Z');
    const updateObRes = await financeService.updateObligation(userA.id, obId, {
      title: 'Renewed Electricity Bill',
      amount: '1800.00',
      dueAt: newDueAt,
      nextDueAt: newDueAt,
    }, db);
    assert.equal(updateObRes.success, true);
    assert.equal(updateObRes.obligation.title, 'Renewed Electricity Bill');
    assert.equal(updateObRes.obligation.amount, '1800');

    // V2-T086: Verify past occurrence was NOT modified
    const occAfter = await db.obligationOccurrence.findUnique({
      where: { id: paidOccurrenceId }
    });
    assert.equal(occAfter?.occurrenceKey, '2026-10-10');
    assert.equal(occAfter?.transactionId, paidTxId);
    assert.equal(occAfter?.dueDate.toISOString(), occBefore?.dueDate.toISOString());

    // -------------------------------------------------------------------------
    // V2-T087: Generic editor cannot corrupt or delete debt-linked transaction
    // -------------------------------------------------------------------------
    const debt = await db.personalDebt.create({
      data: {
        userId: userA.id,
        direction: 'RECEIVABLE',
        counterpartyName: 'Ramesh Friend',
        originalAmount: new Prisma.Decimal('5000.00'),
        status: 'OPEN',
      }
    });

    const debtTx = await db.financialTransaction.create({
      data: {
        userId: userA.id,
        type: 'LEND',
        amount: new Prisma.Decimal('5000.00'),
        category: 'Personal Debt',
        occurredAt: new Date(),
        accountId: acc1Id,
        personalDebtId: debt.id,
      }
    });

    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, debtTx.id, { amount: '4000.00' }, db);
      },
      /Linked transaction cannot be modified directly through generic transaction editor/
    );

    await assert.rejects(
      async () => {
        await financeService.deleteTransaction(userA.id, debtTx.id, db);
      },
      /Linked transaction cannot be deleted directly through generic transaction editor/
    );

    // -------------------------------------------------------------------------
    // V2-T088: Generic editor cannot corrupt or delete loan-linked transaction
    // -------------------------------------------------------------------------
    const loan = await db.loan.create({
      data: {
        userId: userA.id,
        name: 'Home Loan',
        loanType: 'HOME',
        lender: 'HDFC Bank',
        openingOutstanding: new Prisma.Decimal('900000.00'),
        outstandingPrincipal: new Prisma.Decimal('900000.00'),
        status: 'ACTIVE',
      }
    });

    const loanTx = await db.financialTransaction.create({
      data: {
        userId: userA.id,
        type: 'EXPENSE',
        amount: new Prisma.Decimal('25000.00'),
        category: 'EMI',
        occurredAt: new Date(),
        accountId: acc1Id,
      }
    });

    await db.loanPayment.create({
      data: {
        userId: userA.id,
        loanId: loan.id,
        amount: new Prisma.Decimal('25000.00'),
        principalPaid: new Prisma.Decimal('18000.00'),
        interestPaid: new Prisma.Decimal('7000.00'),
        occurredAt: new Date(),
        accountId: acc1Id,
        transactionId: loanTx.id,
      }
    });

    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, loanTx.id, { amount: '30000.00' }, db);
      },
      /Linked transaction cannot be modified directly through generic transaction editor/
    );

    await assert.rejects(
      async () => {
        await financeService.deleteTransaction(userA.id, loanTx.id, db);
      },
      /Linked transaction cannot be deleted directly through generic transaction editor/
    );

    // -------------------------------------------------------------------------
    // V2-T089: Generic editor cannot corrupt or delete wishlist-linked transaction
    // -------------------------------------------------------------------------
    const wishTx = await db.financialTransaction.create({
      data: {
        userId: userA.id,
        type: 'EXPENSE',
        amount: new Prisma.Decimal('45000.00'),
        category: 'Shopping',
        occurredAt: new Date(),
        accountId: acc1Id,
      }
    });

    await db.wishlistItem.create({
      data: {
        userId: userA.id,
        name: 'New Laptop',
        category: 'Electronics',
        targetPrice: new Prisma.Decimal('50000.00'),
        status: 'PURCHASED',
        actualPrice: new Prisma.Decimal('45000.00'),
        purchasedAt: new Date(),
        transactionId: wishTx.id,
      }
    });

    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userA.id, wishTx.id, { amount: '40000.00' }, db);
      },
      /Linked transaction cannot be modified directly through generic transaction editor/
    );

    await assert.rejects(
      async () => {
        await financeService.deleteTransaction(userA.id, wishTx.id, db);
      },
      /Linked transaction cannot be deleted directly through generic transaction editor/
    );

    // -------------------------------------------------------------------------
    // V2-1008: Authorization negatives (Cross-user isolation)
    // -------------------------------------------------------------------------
    // User B cannot update User A's account
    await assert.rejects(
      async () => {
        await financeService.updateAccount(userB.id, acc1Id, { name: 'Hacked Name' }, db);
      },
      /Account not found or unauthorized/
    );

    // User B cannot archive User A's account
    await assert.rejects(
      async () => {
        await financeService.archiveAccount(userB.id, acc1Id, db);
      },
      /Account not found or unauthorized/
    );

    // User B cannot update User A's standalone transaction
    await assert.rejects(
      async () => {
        await financeService.updateTransaction(userB.id, exp1Id, { amount: '10.00' }, db);
      },
      /Transaction not found or unauthorized/
    );

    // User B cannot delete User A's standalone transaction
    await assert.rejects(
      async () => {
        await financeService.deleteTransaction(userB.id, exp1Id, db);
      },
      /Transaction not found or unauthorized/
    );

    // User B cannot update User A's obligation
    await assert.rejects(
      async () => {
        await financeService.updateObligation(userB.id, obId, { title: 'Hacked Bill' }, db);
      },
      /Obligation not found or unauthorized/
    );

    // User B cannot archive User A's obligation
    await assert.rejects(
      async () => {
        await financeService.archiveObligation(userB.id, obId, db);
      },
      /Obligation not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // V2-1006: Archive flows
    // -------------------------------------------------------------------------
    // Archive account
    const archiveAccRes = await financeService.archiveAccount(userA.id, acc2Id, db);
    assert.equal(archiveAccRes.success, true);
    const activeAccs = await financeService.getAccounts(userA.id, db);
    assert.equal(activeAccs.some((a: any) => a.id === acc2Id), false);

    // Archive obligation
    const archiveObRes = await financeService.archiveObligation(userA.id, obId, db);
    assert.equal(archiveObRes.success, true);
    const activeObs = await financeService.getObligations(userA.id, db);
    assert.equal(activeObs.some((o: any) => o.id === obId), false);

  } finally {
    await db.$disconnect();
  }
});
