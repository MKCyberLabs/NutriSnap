import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
import * as debtService from './debt-service';
import * as financeService from './finance-service';
import { calculateMonthlyTotals } from './finance';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('V2-200: Personal Debt (Friends & Family) Test Suite (V2-T020..V2-T030)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const userA = await db.user.create({
      data: {
        id: `usr-debt-a-${timestamp}`,
        email: `debta-${timestamp}@test.local`,
        name: 'User Debt Alpha',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userB = await db.user.create({
      data: {
        id: `usr-debt-b-${timestamp}`,
        email: `debtb-${timestamp}@test.local`,
        name: 'User Debt Beta',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    // Create accounts for User A
    const bankA = await financeService.createAccount(userA.id, {
      name: 'Bank Alpha',
      type: 'BANK',
      openingBalance: '20000.00',
    }, db);
    const bankAId = bankA.account.id;

    // Create account for User B
    const bankB = await financeService.createAccount(userB.id, {
      name: 'Bank Beta',
      type: 'BANK',
      openingBalance: '10000.00',
    }, db);
    const bankBId = bankB.account.id;

    // -------------------------------------------------------------------------
    // V2-T020: Create receivable (User A lends ₹10,000 to Rahul from Bank Alpha)
    // -------------------------------------------------------------------------
    const recRes = await debtService.createDebt(userA.id, {
      direction: 'RECEIVABLE',
      counterpartyName: 'Rahul Colleague',
      title: 'Emergency medical assistance',
      originalAmount: '10000.00',
      accountId: bankAId,
    }, db);

    assert.equal(recRes.success, true);
    assert.equal(recRes.debt.direction, 'RECEIVABLE');
    assert.equal(recRes.debt.counterpartyName, 'Rahul Colleague');
    assert.equal(recRes.debt.originalAmount, '10000');
    assert.equal(recRes.debt.outstandingAmount, '10000');
    assert.equal(recRes.debt.status, 'OPEN');
    assert.ok(recRes.debt.initialTransactionId);
    const recId = recRes.debt.id;

    // Verify account balance: 20000 - 10000 = 10000 (V2-2010)
    let accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '10000');

    // -------------------------------------------------------------------------
    // V2-T021: Create payable (User A borrows ₹5,000 from Arun into Bank Alpha)
    // -------------------------------------------------------------------------
    const payRes = await debtService.createDebt(userA.id, {
      direction: 'PAYABLE',
      counterpartyName: 'Arun Friend',
      title: 'Trip share advance',
      originalAmount: '5000.00',
      accountId: bankAId,
    }, db);

    assert.equal(payRes.success, true);
    assert.equal(payRes.debt.direction, 'PAYABLE');
    assert.equal(payRes.debt.outstandingAmount, '5000');
    assert.equal(payRes.debt.status, 'OPEN');
    const payId = payRes.debt.id;

    // Verify account balance: 10000 + 5000 = 15000 (V2-2010)
    accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '15000');

    // -------------------------------------------------------------------------
    // V2-2011: Verify Income / Expense exclusion
    // Neither LEND nor BORROW should inflate income or expense!
    // -------------------------------------------------------------------------
    const txsA = await db.financialTransaction.findMany({ where: { userId: userA.id } });
    const monthlyTotals = calculateMonthlyTotals(txsA);
    assert.equal(monthlyTotals.income.toString(), '0');
    assert.equal(monthlyTotals.expense.toString(), '0');

    // -------------------------------------------------------------------------
    // V2-T022: Partial collection (Rahul returns ₹4,000 to Bank Alpha)
    // -------------------------------------------------------------------------
    const collectRes = await debtService.recordDebtCollection(userA.id, {
      debtId: recId,
      amount: '4000.00',
      accountId: bankAId,
      note: 'UPI received from Rahul',
    }, db);

    assert.equal(collectRes.success, true);
    assert.equal(collectRes.remainingOutstanding, '6000');
    assert.equal(collectRes.settled, false);

    // Bank balance increases: 15000 + 4000 = 19000
    accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '19000');

    // -------------------------------------------------------------------------
    // V2-T023: Partial repayment (User A repays ₹2,000 to Arun from Bank Alpha)
    // -------------------------------------------------------------------------
    const repayRes = await debtService.recordDebtRepayment(userA.id, {
      debtId: payId,
      amount: '2000.00',
      accountId: bankAId,
      note: 'GPay to Arun',
    }, db);

    assert.equal(repayRes.success, true);
    assert.equal(repayRes.remainingOutstanding, '3000');
    assert.equal(repayRes.settled, false);

    // Bank balance decreases: 19000 - 2000 = 17000
    accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '17000');

    // -------------------------------------------------------------------------
    // V2-T024: Additional lending (User A lends an additional ₹2,000 to Rahul)
    // -------------------------------------------------------------------------
    const addLendRes = await debtService.recordAdditionalLend(userA.id, {
      debtId: recId,
      amount: '2000.00',
      accountId: bankAId,
      note: 'Additional medicine expense',
    }, db);

    assert.equal(addLendRes.success, true);
    // Outstanding was 6000, now 8000
    assert.equal(addLendRes.newOutstanding, '8000');

    // Bank balance decreases: 17000 - 2000 = 15000
    accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '15000');

    // -------------------------------------------------------------------------
    // V2-T025: Additional borrowing (User A borrows an additional ₹1,500 from Arun)
    // -------------------------------------------------------------------------
    const addBorrowRes = await debtService.recordAdditionalBorrow(userA.id, {
      debtId: payId,
      amount: '1500.00',
      accountId: bankAId,
      note: 'Second round dinner share',
    }, db);

    assert.equal(addBorrowRes.success, true);
    // Outstanding was 3000, now 4500
    assert.equal(addBorrowRes.newOutstanding, '4500');

    // Bank balance increases: 15000 + 1500 = 16500
    accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '16500');

    // -------------------------------------------------------------------------
    // V2-T026: Outstanding never negative
    // -------------------------------------------------------------------------
    // Rahul owes ₹8,000. Attempt to collect ₹9,000 -> must reject
    await assert.rejects(
      async () => {
        await debtService.recordDebtCollection(userA.id, {
          debtId: recId,
          amount: '9000.00',
          accountId: bankAId,
        }, db);
      },
      /Cannot collect more than outstanding balance/
    );

    // User A owes Arun ₹4,500. Attempt to repay ₹5,000 -> must reject
    await assert.rejects(
      async () => {
        await debtService.recordDebtRepayment(userA.id, {
          debtId: payId,
          amount: '5000.00',
          accountId: bankAId,
        }, db);
      },
      /Cannot repay more than outstanding balance/
    );

    // -------------------------------------------------------------------------
    // V2-T027: Exact settlement -> SETTLED
    // -------------------------------------------------------------------------
    // Rahul repays remaining ₹8,000 exactly
    const settleRecRes = await debtService.recordDebtCollection(userA.id, {
      debtId: recId,
      amount: '8000.00',
      accountId: bankAId,
    }, db);

    assert.equal(settleRecRes.success, true);
    assert.equal(settleRecRes.remainingOutstanding, '0');
    assert.equal(settleRecRes.settled, true);

    const settledDebt = await debtService.getDebtById(userA.id, recId, db);
    assert.equal(settledDebt.status, 'SETTLED');
    assert.equal(settledDebt.outstandingAmount, '0');

    // User A repays Arun remaining ₹4,500 exactly
    const settlePayRes = await debtService.recordDebtRepayment(userA.id, {
      debtId: payId,
      amount: '4500.00',
      accountId: bankAId,
    }, db);

    assert.equal(settlePayRes.success, true);
    assert.equal(settlePayRes.remainingOutstanding, '0');
    assert.equal(settlePayRes.settled, true);

    const settledPay = await debtService.getDebtById(userA.id, payId, db);
    assert.equal(settledPay.status, 'SETTLED');
    assert.equal(settledPay.outstandingAmount, '0');

    // -------------------------------------------------------------------------
    // V2-T028: Cross-user debt rejected (Authorization negative)
    // -------------------------------------------------------------------------
    // User B attempts to access User A's debt
    await assert.rejects(
      async () => {
        await debtService.getDebtById(userB.id, recId, db);
      },
      /Debt not found or unauthorized/
    );

    // User B attempts to collect User A's debt
    await assert.rejects(
      async () => {
        await debtService.recordDebtCollection(userB.id, {
          debtId: recId,
          amount: '100.00',
          accountId: bankBId,
        }, db);
      },
      /Debt not found or unauthorized/
    );

    // User B attempts to archive User A's debt
    await assert.rejects(
      async () => {
        await debtService.archiveDebt(userB.id, recId, db);
      },
      /Debt not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // V2-T029: Foreign account rejected
    // User A attempts to collect debt into User B's bank account
    // -------------------------------------------------------------------------
    // Create new active debt for User A
    const newDebt = await debtService.createDebt(userA.id, {
      direction: 'RECEIVABLE',
      counterpartyName: 'Pooja Sister',
      originalAmount: '3000.00',
    }, db);
    const newDebtId = newDebt.debt.id;

    await assert.rejects(
      async () => {
        await debtService.recordDebtCollection(userA.id, {
          debtId: newDebtId,
          amount: '1000.00',
          accountId: bankBId, // Foreign account!
        }, db);
      },
      /Account not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // V2-T030: Repeat collection submission idempotent with idempotencyKey
    // -------------------------------------------------------------------------
    const idemKey = `idem-${Date.now()}`;
    const collectFirst = await debtService.recordDebtCollection(userA.id, {
      debtId: newDebtId,
      amount: '1000.00',
      accountId: bankAId,
      idempotencyKey: idemKey,
    }, db);

    assert.equal(collectFirst.success, true);
    assert.equal(collectFirst.alreadyProcessed, false);
    assert.equal(collectFirst.remainingOutstanding, '2000');

    // Repeat with identical idempotencyKey
    const collectSecond = await debtService.recordDebtCollection(userA.id, {
      debtId: newDebtId,
      amount: '1000.00',
      accountId: bankAId,
      idempotencyKey: idemKey,
    }, db);

    assert.equal(collectSecond.success, true);
    assert.equal(collectSecond.alreadyProcessed, true);
    assert.equal(collectSecond.transactionId, collectFirst.transactionId);
    assert.equal(collectSecond.remainingOutstanding, '2000');

    // Archive debt flow
    const archiveRes = await debtService.archiveDebt(userA.id, newDebtId, db);
    assert.equal(archiveRes.success, true);

    const activeDebts = await debtService.getDebts(userA.id, {}, db);
    assert.equal(activeDebts.some((d: any) => d.id === newDebtId), false);

    // -------------------------------------------------------------------------
    // V2-T031: Safe debt update and invariant enforcement
    // -------------------------------------------------------------------------
    // 1. Create a fresh open debt
    const debtToUpdate = await debtService.createDebt(userA.id, {
      direction: 'RECEIVABLE',
      counterpartyName: 'Suresh Sharma',
      title: 'Festival advance',
      originalAmount: '8000.00',
      accountId: bankAId,
    }, db);
    assert.equal(debtToUpdate.success, true);
    const updateDebtId = debtToUpdate.debt.id;

    // Check balance before edit
    const accountsBeforeEdit = await financeService.getAccounts(userA.id, db);
    const balanceBefore = accountsBeforeEdit.find((a: any) => a.id === bankAId).currentBalance;

    // 2. Safe edit of mutable fields
    const updatedDebtRes = await debtService.updateDebt(userA.id, updateDebtId, {
      counterpartyName: 'Suresh K. Sharma',
      title: 'Diwali Festival Advance',
      dueAt: '2026-12-25',
      notes: 'Agreed repayment by Christmas',
    }, db);

    assert.equal(updatedDebtRes.success, true);
    assert.equal(updatedDebtRes.debt.counterpartyName, 'Suresh K. Sharma');
    assert.equal(updatedDebtRes.debt.title, 'Diwali Festival Advance');
    assert.equal(updatedDebtRes.debt.notes, 'Agreed repayment by Christmas');
    assert.equal(updatedDebtRes.debt.originalAmount, '8000');

    // Verify outstanding amount remains untouched via getDebts
    const debtsList = await debtService.getDebts(userA.id, {}, db);
    const fetchedDebt = debtsList.find((d: any) => d.id === updateDebtId);
    assert.equal(fetchedDebt.outstandingAmount, '8000');

    // Account balance and transaction count are unchanged
    const accountsAfterEdit = await financeService.getAccounts(userA.id, db);
    const balanceAfter = accountsAfterEdit.find((a: any) => a.id === bankAId).currentBalance;
    assert.equal(balanceBefore, balanceAfter);

    // 3. Reject alteration of originalAmount
    await assert.rejects(
      async () => {
        await debtService.updateDebt(userA.id, updateDebtId, {
          originalAmount: '12000.00',
        } as any, db);
      },
      /originalAmount cannot be/
    );

    // 4. Reject alteration of direction
    await assert.rejects(
      async () => {
        await debtService.updateDebt(userA.id, updateDebtId, {
          direction: 'PAYABLE',
        } as any, db);
      },
      /direction cannot be/
    );

    // 5. Cross-user debt update rejected
    await assert.rejects(
      async () => {
        await debtService.updateDebt(userB.id, updateDebtId, {
          title: 'Hacked debt title',
        }, db);
      },
      /Debt not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // SOL-R002-008: Debt read models expose user.timezone
    // -------------------------------------------------------------------------
    const debtReadList = await debtService.getDebts(userA.id, {}, db);
    assert.ok(debtReadList.length > 0);
    assert.equal(debtReadList[0].timezone, 'Asia/Kolkata');
    assert.equal(debtReadList[0].user?.timezone, 'Asia/Kolkata');

    const singleDebtRead = await debtService.getDebtById(userA.id, debtReadList[0].id, db);
    assert.ok(singleDebtRead);
    assert.equal(singleDebtRead?.timezone, 'Asia/Kolkata');
    assert.equal(singleDebtRead?.user?.timezone, 'Asia/Kolkata');

    // -------------------------------------------------------------------------
    // SOL-R003-007: Concurrent debt repayments idempotency and limits under row lock
    // -------------------------------------------------------------------------
    const limitDebt = await debtService.createDebt(userA.id, {
      direction: 'PAYABLE',
      counterpartyName: 'Deepak Lock Test',
      title: 'Concurrency Limit Debt',
      originalAmount: '3000.00',
    }, db);
    const limitDebtId = limitDebt.debt.id;

    // Test 1: Duplicate idempotency key concurrent calls
    const idempKey = `idemp_debt_${timestamp}`;
    const [idempRes1, idempRes2] = await Promise.all([
      debtService.recordDebtRepayment(userA.id, {
        debtId: limitDebtId,
        amount: '1000.00',
        accountId: bankAId,
        idempotencyKey: idempKey,
      }, db),
      debtService.recordDebtRepayment(userA.id, {
        debtId: limitDebtId,
        amount: '1000.00',
        accountId: bankAId,
        idempotencyKey: idempKey,
      }, db),
    ]);

    assert.equal(idempRes1.success, true);
    assert.equal(idempRes2.success, true);
    const alreadyProcessedCount = (idempRes1.alreadyProcessed ? 1 : 0) + (idempRes2.alreadyProcessed ? 1 : 0);
    assert.equal(alreadyProcessedCount, 1, 'Exactly one concurrent call is marked alreadyProcessed');

    // Debt outstanding should now be 2000
    const debtMid = await debtService.getDebtById(userA.id, limitDebtId, db);
    assert.equal(debtMid?.outstandingAmount, '2000');

    // Test 2: Concurrent overpayment rejected against remaining balance under row lock
    // Remaining is 2000. Submit two concurrent payments of 1500 each (total 3000 > 2000).
    const results = await Promise.allSettled([
      debtService.recordDebtRepayment(userA.id, {
        debtId: limitDebtId,
        amount: '1500.00',
        accountId: bankAId,
      }, db),
      debtService.recordDebtRepayment(userA.id, {
        debtId: limitDebtId,
        amount: '1500.00',
        accountId: bankAId,
      }, db),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'Exactly one concurrent repayment succeeds');
    assert.equal(rejected.length, 1, 'Overpayment rejected under lock');
    assert.match((rejected[0] as PromiseRejectedResult).reason.message, /Cannot repay more than outstanding balance/);

    const debtFinal = await debtService.getDebtById(userA.id, limitDebtId, db);
    assert.equal(debtFinal?.outstandingAmount, '500', 'Outstanding balance protected under lock');

    // -------------------------------------------------------------------------
    // SOL-R004-006: Debt payment archival status check under row lock
    // -------------------------------------------------------------------------
    const archPayDebt = await debtService.createDebt(userA.id, {
      direction: 'PAYABLE',
      counterpartyName: 'Archival Check Pay',
      title: 'Archival Lock Test Payable',
      originalAmount: '2000.00',
    }, db);
    const archPayId = archPayDebt.debt.id;

    // Archive the debt
    await db.personalDebt.update({
      where: { id: archPayId },
      data: { status: 'ARCHIVED' }
    });

    // Repayment on archived debt must be rejected
    await assert.rejects(
      async () => {
        await debtService.recordDebtRepayment(userA.id, {
          debtId: archPayId,
          amount: '500.00',
          accountId: bankAId,
        }, db);
      },
      /archived debt/i,
      'Repayment on archived debt is strictly rejected under lock'
    );

    const archRecDebt = await debtService.createDebt(userA.id, {
      direction: 'RECEIVABLE',
      counterpartyName: 'Archival Check Rec',
      title: 'Archival Lock Test Receivable',
      originalAmount: '3000.00',
      accountId: bankAId,
    }, db);
    const archRecId = archRecDebt.debt.id;

    // Archive the debt
    await db.personalDebt.update({
      where: { id: archRecId },
      data: { status: 'ARCHIVED' }
    });

    // Collection on archived debt must be rejected
    await assert.rejects(
      async () => {
        await debtService.recordDebtCollection(userA.id, {
          debtId: archRecId,
          amount: '1000.00',
          accountId: bankAId,
        }, db);
      },
      /archived debt/i,
      'Collection on archived debt is strictly rejected under lock'
    );
  } finally {
    await db.$disconnect();
  }
});
