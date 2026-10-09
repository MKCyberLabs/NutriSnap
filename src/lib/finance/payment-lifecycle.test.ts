import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
import * as financeService from './finance-service';
import * as loanService from './loan-service';
import * as creditCardService from './credit-card-service';
import { processSchedulerTick } from '../scheduler';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('V2-650: Payment Lifecycle, Reminder Management, and Credit Card Tracking', async (t) => {
  const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  const timestamp = Date.now();
  const userAId = `usr_plc_a_${timestamp}`;
  const userBId = `usr_plc_b_${timestamp}`;

  // Setup test users
  await db.user.createMany({
    data: [
      { id: userAId, email: `plc_a_${timestamp}@test.com`, name: 'User A PLC', password: 'password123', timezone: 'Asia/Kolkata' },
      { id: userBId, email: `plc_b_${timestamp}@test.com`, name: 'User B PLC', password: 'password123', timezone: 'Asia/Kolkata' },
    ]
  });

  // Setup Accounts for User A
  const bankA = await db.financialAccount.create({
    data: {
      userId: userAId,
      name: 'HDFC Savings',
      type: 'BANK',
      openingBalance: new Decimal(100000),
      isActive: true,
    }
  });

  const cardA = await db.financialAccount.create({
    data: {
      userId: userAId,
      name: 'ICICI Coral Card',
      type: 'CREDIT_CARD',
      openingBalance: new Decimal(0),
      creditLimit: new Decimal(150000),
      statementDay: 20,
      paymentDueDay: 10,
      defaultPaymentAccountId: bankA.id,
      isActive: true,
    }
  });

  // Setup Account for User B
  const bankB = await db.financialAccount.create({
    data: {
      userId: userBId,
      name: 'SBI Bank B',
      type: 'BANK',
      openingBalance: new Decimal(50000),
      isActive: true,
    }
  });

  t.after(async () => {
    // Cleanup in reverse dependency order
    await db.creditCardPayment.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.creditCardStatement.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.loanPayment.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.loan.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.reminderDelivery.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.obligationOccurrence.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.reminder.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.financialTransaction.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.obligation.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.financialAccount.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await db.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  await t.test('V2-651a: Domain-aware Undo Paid reverts obligation occurrence and transaction', async () => {
    const obDate = new Date('2026-11-05T10:00:00.000Z');
    const obligation = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Broadband Fiber',
        kind: 'BILL',
        amount: new Decimal(1199),
        accountId: bankA.id,
        dueAt: obDate,
        nextDueAt: obDate,
        recurrenceType: 'MONTHLY',
        recurrenceInterval: 1,
        reminderOffsetsMin: [0],
        isActive: true,
      }
    });

    // 1. Mark as Paid
    const payRes = await financeService.markObligationPaid(userAId, {
      obligationId: obligation.id,
      occurrenceKey: '2026-11-05',
      createExpense: true,
      accountId: bankA.id,
    }, db);

    assert.equal(payRes.success, true);
    assert.ok(payRes.occurrenceId);
    assert.ok(payRes.transactionId);

    // Verify expense transaction exists
    const expenseTx = await db.financialTransaction.findUnique({
      where: { id: payRes.transactionId! }
    });
    assert.ok(expenseTx);
    assert.equal(expenseTx.type, 'EXPENSE');
    assert.equal(new Decimal(expenseTx.amount).toString(), '1199');

    // Verify obligation advanced
    const updatedOb = await db.obligation.findUnique({ where: { id: obligation.id } });
    assert.ok(updatedOb!.lastCompletedAt);
    assert.ok(new Date(updatedOb!.nextDueAt).getTime() > obDate.getTime());

    // Generic transaction delete MUST be blocked (409 Conflict protection)
    await assert.rejects(
      async () => financeService.deleteTransaction(userAId, payRes.transactionId!, db),
      /Linked transaction cannot be deleted directly/
    );

    // 2. Perform Undo Paid
    const revertRes = await financeService.revertObligationPayment(userAId, {
      obligationId: obligation.id,
      occurrenceKey: '2026-11-05',
    }, db);

    assert.equal(revertRes.success, true);
    assert.equal(revertRes.alreadyReversed, false);

    // Linked expense transaction deleted
    const deletedTx = await db.financialTransaction.findUnique({
      where: { id: payRes.transactionId! }
    });
    assert.equal(deletedTx, null);

    // Occurrence deleted / cleared
    const occ = await db.obligationOccurrence.findUnique({
      where: {
        obligationId_occurrenceKey: {
          obligationId: obligation.id,
          occurrenceKey: '2026-11-05',
        }
      }
    });
    assert.equal(occ, null);

    // Obligation schedule restored to original due date
    const restoredOb = await db.obligation.findUnique({ where: { id: obligation.id } });
    assert.equal(restoredOb!.nextDueAt.toISOString(), obDate.toISOString());
    assert.equal(restoredOb!.lastCompletedAt, null);
    assert.equal(restoredOb!.isActive, true);

    // 3. Repeated undo call is idempotent
    const repeatRevert = await financeService.revertObligationPayment(userAId, {
      obligationId: obligation.id,
      occurrenceKey: '2026-11-05',
    }, db);
    assert.equal(repeatRevert.success, true);
    assert.equal(repeatRevert.alreadyReversed, true);

    // 4. Occurrence can be paid again cleanly
    const rePayRes = await financeService.markObligationPaid(userAId, {
      obligationId: obligation.id,
      occurrenceKey: '2026-11-05',
      createExpense: true,
      accountId: bankA.id,
    }, db);
    assert.equal(rePayRes.success, true);
    assert.equal(rePayRes.alreadyCompleted, false);
    assert.ok(rePayRes.transactionId);
  });

  await t.test('V2-651b: Loan EMI reversal adds back principal, deletes expense, and restores schedule', async () => {
    // Create Loan with linked Obligation
    const loanRes = await loanService.createLoan(userAId, {
      name: 'Two Wheeler Loan',
      loanType: 'VEHICLE',
      lender: 'Bajaj Finance',
      openingOutstanding: 50000,
      emiAmount: 5000,
      emiGeneratesExpense: true,
      paymentAccountId: bankA.id,
      nextEmiDate: '2026-11-10T10:00:00.000Z',
      createLinkedObligation: true,
    }, db);

    const loanId = loanRes.loan.id;
    const loanDb = await db.loan.findUnique({
      where: { id: loanId },
      include: { obligation: true }
    });
    assert.ok(loanDb!.obligation);
    const linkedObId = loanDb!.obligation!.id;

    // Record an EMI payment with ₹4,000 principal + ₹1,000 interest
    const emiDate = new Date('2026-11-10T10:00:00.000Z');
    const payRes = await loanService.recordEmiPayment(userAId, {
      loanId,
      amount: 5000,
      accountId: bankA.id,
      principalPaid: 4000,
      interestPaid: 1000,
      occurredAt: emiDate,
    }, db);

    assert.equal(payRes.success, true);
    assert.equal(payRes.remainingPrincipal, '46000');
    assert.ok(payRes.transactionId);

    // Outstanding reduced from 50000 to 46000
    const loanAfterPay = await db.loan.findUnique({ where: { id: loanId } });
    assert.equal(new Decimal(loanAfterPay!.outstandingPrincipal).toString(), '46000');
    const obAfterPay = await db.obligation.findUnique({ where: { id: linkedObId } });
    assert.equal(obAfterPay?.nextDueAt?.toISOString(), loanAfterPay?.nextEmiDate?.toISOString());

    // Generic transaction delete blocked on EMI transaction
    await assert.rejects(
      async () => financeService.deleteTransaction(userAId, payRes.transactionId!, db),
      /Linked transaction cannot be deleted directly/
    );

    // Revert EMI payment via LoanService.revertEmiPayment
    const revertRes = await loanService.revertEmiPayment(userAId, {
      loanPaymentId: payRes.paymentId,
      revertToDate: emiDate,
    }, db);

    assert.equal(revertRes.success, true);
    assert.equal(revertRes.alreadyReversed, false);
    // Principal restored back to 50000
    assert.equal(new Decimal(revertRes.restoredOutstanding).toString(), '50000');

    // Linked expense transaction deleted
    const deletedTx = await db.financialTransaction.findUnique({
      where: { id: payRes.transactionId! }
    });
    assert.equal(deletedTx, null);

    // Loan database state verified
    const loanAfterRevert = await db.loan.findUnique({ where: { id: loanId } });
    assert.equal(new Decimal(loanAfterRevert!.outstandingPrincipal).toString(), '50000');
    assert.equal(loanAfterRevert!.nextEmiDate!.toISOString(), emiDate.toISOString());
    const obAfterRevert = await db.obligation.findUnique({ where: { id: linkedObId } });
    assert.equal(obAfterRevert?.nextDueAt?.toISOString(), emiDate.toISOString());

    // Repeated revert is idempotent
    const repeatRevert = await loanService.revertEmiPayment(userAId, {
      loanPaymentId: payRes.paymentId,
    }, db);
    assert.equal(repeatRevert.success, true);
    assert.equal(repeatRevert.alreadyReversed, true);
  });

  await t.test('V2-652: Reminder and Obligation Management (Edit, Pause, Delete, Delivery purge)', async () => {
    // 1. Create recurring obligation
    const obDate = new Date('2026-12-01T09:00:00.000Z');
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Gym Subscription',
        kind: 'SUBSCRIPTION',
        amount: new Decimal(2500),
        accountId: bankA.id,
        dueAt: obDate,
        nextDueAt: obDate,
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Create a dummy reminder delivery claim
    const reminder = await db.reminder.create({
      data: {
        userId: userAId,
        domain: 'WEALTH',
        type: 'BILL',
        title: 'Gym Subscription',
        obligationId: ob.id,
        scheduledAt: obDate,
        recurrenceType: 'MONTHLY',
      }
    });

    await db.reminderDelivery.create({
      data: {
        userId: userAId,
        reminderId: reminder.id,
        obligationId: ob.id,
        occurrenceKey: '2026-12-01',
        scheduledFor: obDate,
        offsetMinutes: 0,
        status: 'PENDING',
      }
    });

    // 2. Edit schedule: changes schedule and purges pending deliveries
    const newDate = new Date('2026-12-15T09:00:00.000Z');
    await financeService.updateObligation(userAId, ob.id, {
      dueAt: newDate,
      amount: 2700,
    }, db);

    const pendingDeliveries = await db.reminderDelivery.findMany({
      where: { obligationId: ob.id, status: 'PENDING' }
    });
    // Pending deliveries were cleaned up
    assert.equal(pendingDeliveries.length, 0);

    const updatedOb = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(new Decimal(updatedOb!.amount!).toString(), '2700');

    // 3. Pause obligation
    await financeService.toggleObligationActive(userAId, ob.id, false, db);
    const pausedOb = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(pausedOb!.isActive, false);

    // 4. Resume obligation
    await financeService.toggleObligationActive(userAId, ob.id, true, db);
    const resumedOb = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(resumedOb!.isActive, true);

    // 5. Hard delete with 0 payment occurrences succeeds
    const delRes = await financeService.deleteObligation(userAId, ob.id, db);
    assert.equal(delRes.success, true);
    const deletedOb = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(deletedOb, null);

    // 6. Hard delete with >= 1 payment occurrences is blocked
    const paidOb = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Mobile Postpaid',
        kind: 'RECHARGE',
        amount: new Decimal(499),
        dueAt: obDate,
        nextDueAt: obDate,
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    await financeService.markObligationPaid(userAId, {
      obligationId: paidOb.id,
      occurrenceKey: '2026-12-01',
    }, db);

    await assert.rejects(
      async () => financeService.deleteObligation(userAId, paidOb.id, db),
      /Cannot delete obligation with payment history/
    );

    // Archiving instead succeeds
    const archRes = await financeService.archiveObligation(userAId, paidOb.id, db);
    assert.equal(archRes.success, true);
    const archOb = await db.obligation.findUnique({ where: { id: paidOb.id } });
    assert.equal(archOb!.isArchived, true);
    assert.equal(archOb!.isActive, false);
  });

  await t.test('V2-653a: Month-end clamping helper handles Feb 28/29, Apr 30 without month rollover', () => {
    // Feb 2026 (non-leap year, 28 days)
    assert.equal(creditCardService.clampDayToMonth(2026, 1, 31), 28);
    assert.equal(creditCardService.clampDayToMonth(2026, 1, 29), 28);
    assert.equal(creditCardService.clampDayToMonth(2026, 1, 15), 15);

    // Feb 2024 (leap year, 29 days)
    assert.equal(creditCardService.clampDayToMonth(2024, 1, 31), 29);
    assert.equal(creditCardService.clampDayToMonth(2024, 1, 29), 29);

    // April (30 days)
    assert.equal(creditCardService.clampDayToMonth(2026, 3, 31), 30);
    assert.equal(creditCardService.clampDayToMonth(2026, 3, 30), 30);

    // January (31 days)
    assert.equal(creditCardService.clampDayToMonth(2026, 0, 31), 31);

    // Calculate dates helper
    const dates = creditCardService.calculateStatementDates(31, 15, 2026, 1); // Feb 2026
    assert.equal(dates.statementDate.getUTCDate(), 28);
    assert.equal(dates.statementDate.getUTCMonth(), 1); // Feb
    assert.equal(dates.dueDate.getUTCDate(), 15);
    assert.equal(dates.dueDate.getUTCMonth(), 2); // March
    assert.equal(dates.periodKey, '2026-02');
  });

  await t.test('V2-653b: Credit Card statement creation, partial payments, and full completion', async () => {
    // 1. Create monthly statement: ₹30,000 due on 2026-11-10
    const stmtRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardA.id,
      periodKey: '2026-10',
      statementDate: '2026-10-20T12:00:00.000Z',
      dueDate: '2026-11-10T12:00:00.000Z',
      statementAmount: 30000,
      minimumDue: 1500,
    }, db);

    assert.equal(stmtRes.success, true);
    assert.equal(stmtRes.statement.status, 'OPEN');
    assert.equal(new Decimal(stmtRes.statement.statementAmount).toString(), '30000');
    assert.equal(new Decimal(stmtRes.statement.minimumDue!).toString(), '1500');

    const stmtId = stmtRes.statement.id;

    // Verify linked obligation was created/synced with ₹30,000
    const linkedOb = await db.obligation.findFirst({
      where: { userId: userAId, accountId: cardA.id, kind: 'CREDIT_CARD' }
    });
    assert.ok(linkedOb);
    assert.equal(new Decimal(linkedOb.amount!).toString(), '30000');

    // 2. Partial Payment 1: ₹10,000
    const pay1 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtId,
      fromAccountId: bankA.id,
      amount: 10000,
      note: 'Part 1 Payment',
    }, db);

    assert.equal(pay1.success, true);
    assert.equal(pay1.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(pay1.pendingBalance).toString(), '20000');
    assert.equal(pay1.fullyPaid, false);

    // Verify TRANSFER transaction created (NOT Expense, NOT Income)
    const tx1 = await db.financialTransaction.findUnique({
      where: { id: pay1.transactionId }
    });
    assert.ok(tx1);
    assert.equal(tx1.type, 'TRANSFER');
    assert.equal(tx1.accountId, bankA.id);
    assert.equal(tx1.transferAccountId, cardA.id);
    assert.equal(new Decimal(tx1.amount).toString(), '10000');

    // Verify generic transaction delete is blocked
    await assert.rejects(
      async () => financeService.deleteTransaction(userAId, pay1.transactionId, db),
      /Linked transaction cannot be deleted directly/
    );

    // Verify linked Obligation amount synced to ₹20,000
    const obAfterPay1 = await db.obligation.findUnique({ where: { id: linkedOb.id } });
    assert.equal(new Decimal(obAfterPay1!.amount!).toString(), '20000');

    // 3. Partial Payment 2: ₹12,000 (Remaining pending ₹8,000)
    const pay2 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtId,
      fromAccountId: bankA.id,
      amount: 12000,
    }, db);
    assert.equal(pay2.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(pay2.pendingBalance).toString(), '8000');

    const obAfterPay2 = await db.obligation.findUnique({ where: { id: linkedOb.id } });
    assert.equal(new Decimal(obAfterPay2!.amount!).toString(), '8000');

    // Overpayment rejection: trying to pay ₹10,000 when only ₹8,000 pending
    await assert.rejects(
      async () => creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmtId,
        fromAccountId: bankA.id,
        amount: 10000,
      }, db),
      /cannot exceed pending balance/
    );

    // 4. Final Payment: ₹8,000 -> statement status becomes PAID
    const pay3 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtId,
      fromAccountId: bankA.id,
      amount: 8000,
    }, db);
    assert.equal(pay3.statementStatus, 'PAID');
    assert.equal(new Decimal(pay3.pendingBalance).toString(), '0');
    assert.equal(pay3.fullyPaid, true);

    // Obligation occurrence created with transactionId = null (Finding 3)
    const occ = await db.obligationOccurrence.findFirst({
      where: { obligationId: linkedOb.id }
    });
    assert.ok(occ);
    assert.equal(occ.status, 'COMPLETED');
    assert.equal(occ.transactionId, null);

    // Obligation deactivated on full payoff
    const obAfterFull = await db.obligation.findUnique({ where: { id: linkedOb.id } });
    assert.equal(obAfterFull!.isActive, false);
    assert.equal(obAfterFull!.isArchived, true);
    assert.equal(obAfterFull!.recurrenceType, 'ONCE');

    // 5. Revert Payment: undo the latest ₹8,000 payment
    const revertPay3 = await creditCardService.revertCreditCardPayment(userAId, {
      paymentId: pay3.paymentId,
    }, db);
    assert.equal(revertPay3.success, true);
    assert.equal(revertPay3.restoredStatus, 'PARTIAL');
    assert.equal(new Decimal(revertPay3.pendingBalance).toString(), '8000');

    // Transfer transaction for pay3 deleted
    const tx3Deleted = await db.financialTransaction.findUnique({
      where: { id: pay3.transactionId }
    });
    assert.equal(tx3Deleted, null);

    // Completed occurrence removed and obligation restored to ₹8,000 pending and reactivated
    const occAfterRevert = await db.obligationOccurrence.findFirst({
      where: { obligationId: linkedOb.id }
    });
    assert.equal(occAfterRevert, null);

    const obAfterRevert = await db.obligation.findUnique({ where: { id: linkedOb.id } });
    assert.equal(new Decimal(obAfterRevert!.amount!).toString(), '8000');
    assert.equal(obAfterRevert!.nextDueAt.toISOString(), linkedOb.nextDueAt.toISOString());
    assert.equal(obAfterRevert!.isActive, true);
    assert.equal(obAfterRevert!.isArchived, false);
  });

  await t.test('V2-653c: Cross-user and safety invariants for credit cards', async () => {
    // User B cannot create statement on User A card
    await assert.rejects(
      async () => creditCardService.createCreditCardStatement(userBId, {
        accountId: cardA.id,
        periodKey: '2026-11',
        statementDate: '2026-11-20',
        dueDate: '2026-12-10',
        statementAmount: 5000,
      }, db),
      /Credit card account not found or unauthorized/
    );

    // User A cannot pay using User B account
    const stmt = await db.creditCardStatement.findFirst({ where: { accountId: cardA.id } });
    await assert.rejects(
      async () => creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmt!.id,
        fromAccountId: bankB.id,
        amount: 1000,
      }, db),
      /Source payment account not found or unauthorized/
    );

    // Cannot pay using the card itself as source
    await assert.rejects(
      async () => creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmt!.id,
        fromAccountId: cardA.id,
        amount: 1000,
      }, db),
      /Source account cannot be the credit card being paid/
    );
  });

  await t.test('V2-653d: Fully paid credit card returns activeStatement: null while preserving allStatements history', async () => {
    const stmt = await db.creditCardStatement.findFirst({
      where: { accountId: cardA.id, periodKey: '2026-10' }
    });
    assert.ok(stmt);

    const payFinal = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmt.id,
      fromAccountId: bankA.id,
      amount: 8000,
    }, db);
    assert.equal(payFinal.fullyPaid, true);
    assert.equal(payFinal.statementStatus, 'PAID');

    const details = await creditCardService.getCreditCardDetails(userAId, cardA.id, db);
    assert.equal(details.activeStatement, null);
    assert.ok(details.allStatements.length > 0);
    const stmtInHistory = details.allStatements.find((s: any) => s.id === stmt.id);
    assert.ok(stmtInHistory);
    assert.equal(stmtInHistory.status, 'PAID');
  });

  await t.test('V2-652b: Safe Obligation edit preserves completed occurrence history', async () => {
    const obDate = new Date('2026-10-01T10:00:00.000Z');
    const obligation = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Electricity Power Bill',
        kind: 'BILL',
        amount: new Decimal(2400),
        accountId: bankA.id,
        dueAt: obDate,
        nextDueAt: obDate,
        recurrenceType: 'MONTHLY',
        recurrenceInterval: 1,
        reminderOffsetsMin: [0],
        isActive: true,
      }
    });

    await financeService.markObligationPaid(userAId, {
      obligationId: obligation.id,
      occurrenceKey: '2026-10-01',
      createExpense: false,
    }, db);

    const occBefore = await db.obligationOccurrence.findFirst({
      where: { obligationId: obligation.id, occurrenceKey: '2026-10-01' }
    });
    assert.ok(occBefore);
    assert.equal(occBefore.status, 'COMPLETED');

    const updateRes = await financeService.updateObligation(userAId, obligation.id, {
      title: 'Bescom Electricity Bill',
      amount: '2600.00',
      notes: 'Updated tariff',
    }, db);

    assert.equal(updateRes.success, true);
    assert.equal(updateRes.obligation.title, 'Bescom Electricity Bill');
    assert.equal(new Decimal(updateRes.obligation.amount).toString(), '2600');

    const occAfter = await db.obligationOccurrence.findFirst({
      where: { obligationId: obligation.id, occurrenceKey: '2026-10-01' }
    });
    assert.ok(occAfter);
    assert.equal(occAfter.id, occBefore.id);
    assert.equal(occAfter.status, 'COMPLETED');
  });

  await t.test('V2-653e: Overlapping credit card statement cycles preserve separate obligations, due dates, partial payments, and full completion', async () => {
    // Setup dedicated credit card
    const cardMulti = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'Axis Atlas Card',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(200000),
        statementDay: 15,
        paymentDueDay: 5,
        defaultPaymentAccountId: bankA.id,
        isActive: true,
      }
    });

    // 1. Create Statement 1: ₹20,000 due 2026-11-05
    const stmt1Res = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardMulti.id,
      periodKey: '2026-10',
      statementDate: '2026-10-15T12:00:00.000Z',
      dueDate: '2026-11-05T12:00:00.000Z',
      statementAmount: 20000,
      minimumDue: 1000,
    }, db);
    assert.equal(stmt1Res.success, true);
    assert.equal(stmt1Res.statement.status, 'OPEN');
    const stmt1Id = stmt1Res.statement.id;

    const stmt1InDb = await db.creditCardStatement.findUnique({ where: { id: stmt1Id } });
    assert.ok(stmt1InDb?.obligationId);
    const ob1Id = stmt1InDb.obligationId!;

    const ob1 = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.ok(ob1);
    assert.equal(new Decimal(ob1.amount!).toString(), '20000');
    assert.equal(ob1.dueAt.toISOString(), '2026-11-05T12:00:00.000Z');

    // Add reminder delivery for Statement 1
    const rem1 = await db.reminder.create({
      data: {
        userId: userAId,
        obligationId: ob1Id,
        type: 'BILL',
        title: 'Stmt 1 Reminder',
        time: '12:00',
        recurrenceType: 'MONTHLY',
      }
    });
    await db.reminderDelivery.create({
      data: {
        userId: userAId,
        obligationId: ob1Id,
        reminderId: rem1.id,
        occurrenceKey: '2026-11-05',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-05T12:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // 2. While Statement 1 is OPEN, create overlapping Statement 2: ₹35,000 due 2026-12-05
    const stmt2Res = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardMulti.id,
      periodKey: '2026-11',
      statementDate: '2026-11-15T12:00:00.000Z',
      dueDate: '2026-12-05T12:00:00.000Z',
      statementAmount: 35000,
      minimumDue: 1750,
    }, db);
    assert.equal(stmt2Res.success, true);
    assert.equal(stmt2Res.statement.status, 'OPEN');
    const stmt2Id = stmt2Res.statement.id;

    const stmt2InDb = await db.creditCardStatement.findUnique({ where: { id: stmt2Id } });
    assert.ok(stmt2InDb?.obligationId);
    const ob2Id = stmt2InDb.obligationId!;

    // Must NOT share the same obligation
    assert.notEqual(ob2Id, ob1Id, 'Overlapping statement cycle must receive its own obligation');

    const ob2 = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.ok(ob2);
    assert.equal(new Decimal(ob2.amount!).toString(), '35000');
    assert.equal(ob2.dueAt.toISOString(), '2026-12-05T12:00:00.000Z');

    // Overlapping protection check: Statement 1 obligation must be completely unaffected!
    const ob1AfterStmt2 = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.equal(new Decimal(ob1AfterStmt2!.amount!).toString(), '20000', 'Statement 1 amount must not be overwritten');
    assert.equal(ob1AfterStmt2!.dueAt.toISOString(), '2026-11-05T12:00:00.000Z', 'Statement 1 due date must not be overwritten');

    const rem1Deliv = await db.reminderDelivery.findFirst({
      where: { obligationId: ob1Id, occurrenceKey: '2026-11-05' }
    });
    assert.equal(rem1Deliv?.status, 'PENDING', 'Statement 1 delivery claim must remain pending');

    // 3. Partial payment of ₹5,000 on Statement 1
    const partPay1 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmt1Id,
      fromAccountId: bankA.id,
      amount: 5000,
      note: 'Atlas Stmt 1 Part 1',
    }, db);
    assert.equal(partPay1.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(partPay1.pendingBalance).toString(), '15000');

    // Statement 1 obligation updated to ₹15,000
    const ob1AfterPartPay = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.equal(new Decimal(ob1AfterPartPay!.amount!).toString(), '15000');

    // Statement 2 obligation remains untouched at ₹35,000
    const ob2AfterPartPay = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.equal(new Decimal(ob2AfterPartPay!.amount!).toString(), '35000', 'Statement 2 amount must not change on Stmt 1 payment');
    assert.equal(ob2AfterPartPay!.dueAt.toISOString(), '2026-12-05T12:00:00.000Z');

    // 4. Full payment of remaining ₹15,000 on Statement 1
    const fullPay1 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmt1Id,
      fromAccountId: bankA.id,
      amount: 15000,
      note: 'Atlas Stmt 1 Part 2',
    }, db);
    assert.equal(fullPay1.statementStatus, 'PAID');
    assert.equal(fullPay1.fullyPaid, true);

    // Statement 1 obligation cleared/completed
    const ob1AfterFullPay = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.equal(ob1AfterFullPay?.amount, null);
    assert.equal(ob1AfterFullPay?.isActive, false);
    assert.equal(ob1AfterFullPay?.isArchived, true);

    // Statement 2 obligation remains completely active with ₹35,000
    const ob2AfterFullPay = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.equal(new Decimal(ob2AfterFullPay!.amount!).toString(), '35000', 'Statement 2 amount must remain intact after Stmt 1 full pay');
    assert.equal(ob2AfterFullPay!.dueAt.toISOString(), '2026-12-05T12:00:00.000Z');
    assert.equal(ob2AfterFullPay!.isActive, true);

    // 5. Partial payment of ₹10,000 on Statement 2
    const partPay2 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmt2Id,
      fromAccountId: bankA.id,
      amount: 10000,
      note: 'Atlas Stmt 2 Part 1',
    }, db);
    assert.equal(partPay2.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(partPay2.pendingBalance).toString(), '25000');

    const ob2AfterPart2 = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.equal(new Decimal(ob2AfterPart2!.amount!).toString(), '25000');

    // 6. Full payment of remaining ₹25,000 on Statement 2
    const fullPay2 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmt2Id,
      fromAccountId: bankA.id,
      amount: 25000,
      note: 'Atlas Stmt 2 Part 2',
    }, db);
    assert.equal(fullPay2.statementStatus, 'PAID');
    assert.equal(fullPay2.fullyPaid, true);

    const ob2AfterFull2 = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.equal(ob2AfterFull2?.amount, null);
    assert.equal(ob2AfterFull2?.isActive, false);
    assert.equal(ob2AfterFull2?.isArchived, true);

    // Both statements fully paid -> activeStatement is null
    const cardDetails = await creditCardService.getCreditCardDetails(userAId, cardMulti.id, db);
    assert.equal(cardDetails.activeStatement, null);
    assert.equal(cardDetails.allStatements.length, 2);
  });

  await t.test('V2-653f: Credit Card multi-cycle lifecycle: dedicated obligations across Jan/Feb/Mar, old cycle reversal isolation, repayment histories, and concurrent creation idempotency', async () => {
    // Setup dedicated credit card for multi-cycle isolation test
    const cardCycles = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'Standard Chartered Platinum',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(300000),
        statementDay: 20,
        paymentDueDay: 10,
        defaultPaymentAccountId: bankA.id,
        isActive: true,
      }
    });

    // 1. Cycle 1: January statement (₹20,000 due 2026-02-10)
    const stmtJanRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardCycles.id,
      periodKey: '2026-01',
      statementDate: '2026-01-20T12:00:00.000Z',
      dueDate: '2026-02-10T12:00:00.000Z',
      statementAmount: 20000,
      minimumDue: 1000,
    }, db);
    assert.equal(stmtJanRes.success, true);
    assert.equal(stmtJanRes.statement.status, 'OPEN');
    const stmtJanId = stmtJanRes.statement.id;

    const stmtJanDb = await db.creditCardStatement.findUnique({ where: { id: stmtJanId } });
    assert.ok(stmtJanDb?.obligationId);
    const obJanId = stmtJanDb.obligationId!;

    const obJan = await db.obligation.findUnique({ where: { id: obJanId } });
    assert.ok(obJan);
    assert.equal(new Decimal(obJan.amount!).toString(), '20000');
    assert.equal(obJan.dueAt.toISOString(), '2026-02-10T12:00:00.000Z');

    // Partial payment on Jan: ₹5,000
    const payJanPart = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtJanId,
      fromAccountId: bankA.id,
      amount: 5000,
      note: 'Jan CC Part 1',
    }, db);
    assert.equal(payJanPart.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(payJanPart.pendingBalance).toString(), '15000');

    // Full payoff of remaining ₹15,000 on Jan
    const payJanFull = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtJanId,
      fromAccountId: bankA.id,
      amount: 15000,
      note: 'Jan CC Part 2 Full',
    }, db);
    assert.equal(payJanFull.statementStatus, 'PAID');
    assert.equal(payJanFull.fullyPaid, true);

    const obJanAfterPay = await db.obligation.findUnique({ where: { id: obJanId } });
    assert.equal(obJanAfterPay?.amount, null);
    assert.equal(obJanAfterPay?.isActive, false);
    assert.equal(obJanAfterPay?.isArchived, true);

    // 2. Cycle 2: February statement (₹35,000 due 2026-03-10) created after Jan is fully paid
    const stmtFebRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardCycles.id,
      periodKey: '2026-02',
      statementDate: '2026-02-20T12:00:00.000Z',
      dueDate: '2026-03-10T12:00:00.000Z',
      statementAmount: 35000,
      minimumDue: 1750,
    }, db);
    assert.equal(stmtFebRes.success, true);
    assert.equal(stmtFebRes.statement.status, 'OPEN');
    const stmtFebId = stmtFebRes.statement.id;

    const stmtFebDb = await db.creditCardStatement.findUnique({ where: { id: stmtFebId } });
    assert.ok(stmtFebDb?.obligationId);
    const obFebId = stmtFebDb.obligationId!;

    // MUST NOT reuse Jan's obligation even though Jan statement is fully paid!
    assert.notEqual(obFebId, obJanId, 'February cycle must receive its own dedicated obligation, not reuse Jan');

    const obFeb = await db.obligation.findUnique({ where: { id: obFebId } });
    assert.ok(obFeb);
    assert.equal(new Decimal(obFeb.amount!).toString(), '35000');
    assert.equal(obFeb.dueAt.toISOString(), '2026-03-10T12:00:00.000Z');
    assert.equal(obFeb.isActive, true);

    // 3. Cycle 3: March statement (₹45,000 due 2026-04-10)
    const stmtMarRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardCycles.id,
      periodKey: '2026-03',
      statementDate: '2026-03-20T12:00:00.000Z',
      dueDate: '2026-04-10T12:00:00.000Z',
      statementAmount: 45000,
      minimumDue: 2250,
    }, db);
    assert.equal(stmtMarRes.success, true);
    const stmtMarId = stmtMarRes.statement.id;

    const stmtMarDb = await db.creditCardStatement.findUnique({ where: { id: stmtMarId } });
    assert.ok(stmtMarDb?.obligationId);
    const obMarId = stmtMarDb.obligationId!;

    // Distinct obligations across all 3 cycles
    assert.notEqual(obMarId, obFebId, 'March obligation must differ from February');
    assert.notEqual(obMarId, obJanId, 'March obligation must differ from January');

    const totalObs = await db.obligation.findMany({ where: { accountId: cardCycles.id } });
    assert.equal(totalObs.length, 3, 'Exactly 3 separate obligations exist for the 3 statement cycles');

    // Attach reminder and delivery claim to Feb obligation
    const remFeb = await db.reminder.create({
      data: {
        userId: userAId,
        obligationId: obFebId,
        type: 'BILL',
        title: 'Feb SCB CC Reminder',
        time: '12:00',
        recurrenceType: 'MONTHLY',
      }
    });
    await db.reminderDelivery.create({
      data: {
        userId: userAId,
        obligationId: obFebId,
        reminderId: remFeb.id,
        occurrenceKey: '2026-03-10',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-03-10T12:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // 4. Old Cycle Reversal Isolation:
    // Revert Jan's full payoff payment (₹15,000) while Feb and Mar exist and are active
    const revertJan1 = await creditCardService.revertCreditCardPayment(userAId, {
      paymentId: payJanFull.paymentId,
    }, db);
    assert.equal(revertJan1.success, true);
    assert.equal(revertJan1.restoredStatus, 'PARTIAL');
    assert.equal(new Decimal(revertJan1.pendingBalance).toString(), '15000');

    // Verify Jan obligation restored to ₹15,000 and reactivated
    const obJanAfterRevert1 = await db.obligation.findUnique({ where: { id: obJanId } });
    assert.equal(new Decimal(obJanAfterRevert1!.amount!).toString(), '15000');
    assert.equal(obJanAfterRevert1!.nextDueAt.toISOString(), '2026-02-10T12:00:00.000Z');
    assert.equal(obJanAfterRevert1!.isActive, true);
    assert.equal(obJanAfterRevert1!.isArchived, false);

    // CRUCIAL FINDING P1 #1 ISOLATION CHECKS:
    // Feb obligation must be COMPLETELY UNTOUCHED!
    const obFebAfterJanRevert = await db.obligation.findUnique({ where: { id: obFebId } });
    assert.equal(
      new Decimal(obFebAfterJanRevert!.amount!).toString(),
      '35000',
      'Feb obligation amount must remain ₹35,000 and NOT be overwritten by Jan reversal'
    );
    assert.equal(
      obFebAfterJanRevert!.dueAt.toISOString(),
      '2026-03-10T12:00:00.000Z',
      'Feb obligation due date must remain March 10'
    );
    assert.equal(
      obFebAfterJanRevert!.nextDueAt.toISOString(),
      '2026-03-10T12:00:00.000Z',
      'Feb obligation nextDueAt must remain March 10'
    );
    assert.equal(obFebAfterJanRevert!.isActive, true);

    // Feb reminder delivery status must remain PENDING
    const febDeliv = await db.reminderDelivery.findFirst({
      where: { obligationId: obFebId, occurrenceKey: '2026-03-10' }
    });
    assert.equal(febDeliv?.status, 'PENDING', 'Feb reminder delivery claim must remain PENDING');

    // Mar obligation must also remain completely untouched at ₹45,000
    const obMarAfterJanRevert = await db.obligation.findUnique({ where: { id: obMarId } });
    assert.equal(new Decimal(obMarAfterJanRevert!.amount!).toString(), '45000');
    assert.equal(obMarAfterJanRevert!.dueAt.toISOString(), '2026-04-10T12:00:00.000Z');

    // Revert Jan's first partial payment (₹5,000) as well -> Jan statement becomes OPEN with ₹20,000
    const revertJan2 = await creditCardService.revertCreditCardPayment(userAId, {
      paymentId: payJanPart.paymentId,
    }, db);
    assert.equal(revertJan2.success, true);
    assert.equal(revertJan2.restoredStatus, 'OPEN');
    assert.equal(new Decimal(revertJan2.pendingBalance).toString(), '20000');

    const obJanAfterRevert2 = await db.obligation.findUnique({ where: { id: obJanId } });
    assert.equal(new Decimal(obJanAfterRevert2!.amount!).toString(), '20000');

    // Feb and Mar obligations still intact
    const obFebStillIntact = await db.obligation.findUnique({ where: { id: obFebId } });
    assert.equal(new Decimal(obFebStillIntact!.amount!).toString(), '35000');

    // 5. Repayment histories, partial payments, and full payoff
    // Re-pay Jan fully with a single payment of ₹20,000
    const repayJan = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtJanId,
      fromAccountId: bankA.id,
      amount: 20000,
      note: 'Jan Repayment in full',
    }, db);
    assert.equal(repayJan.statementStatus, 'PAID');
    assert.equal(repayJan.fullyPaid, true);

    // Pay Feb in two steps (₹15,000 partial, then ₹20,000 remainder)
    const payFeb1 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtFebId,
      fromAccountId: bankA.id,
      amount: 15000,
    }, db);
    assert.equal(payFeb1.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(payFeb1.pendingBalance).toString(), '20000');

    const payFeb2 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtFebId,
      fromAccountId: bankA.id,
      amount: 20000,
    }, db);
    assert.equal(payFeb2.statementStatus, 'PAID');
    assert.equal(payFeb2.fullyPaid, true);

    // Pay Mar in two steps (₹20,000 partial, then ₹25,000 remainder)
    const payMar1 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtMarId,
      fromAccountId: bankA.id,
      amount: 20000,
    }, db);
    assert.equal(payMar1.statementStatus, 'PARTIAL');
    assert.equal(new Decimal(payMar1.pendingBalance).toString(), '25000');

    const payMar2 = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtMarId,
      fromAccountId: bankA.id,
      amount: 25000,
    }, db);
    assert.equal(payMar2.statementStatus, 'PAID');
    assert.equal(payMar2.fullyPaid, true);

    // Verify card details reflects all paid
    const detailsAfterAllPaid = await creditCardService.getCreditCardDetails(userAId, cardCycles.id, db);
    assert.equal(detailsAfterAllPaid.activeStatement, null);
    assert.equal(detailsAfterAllPaid.allStatements.length, 3);
    for (const st of detailsAfterAllPaid.allStatements) {
      assert.equal(st.status, 'PAID');
    }

    // 6. Concurrent cycle creation idempotency:
    // Concurrently attempt to create Statement 4 (April 2026: periodKey '2026-04')
    const [stmtApr1, stmtApr2] = await Promise.all([
      creditCardService.createCreditCardStatement(userAId, {
        accountId: cardCycles.id,
        periodKey: '2026-04',
        statementDate: '2026-04-20T12:00:00.000Z',
        dueDate: '2026-05-10T12:00:00.000Z',
        statementAmount: 50000,
        minimumDue: 2500,
      }, db),
      creditCardService.createCreditCardStatement(userAId, {
        accountId: cardCycles.id,
        periodKey: '2026-04',
        statementDate: '2026-04-20T12:00:00.000Z',
        dueDate: '2026-05-10T12:00:00.000Z',
        statementAmount: 50000,
        minimumDue: 2500,
      }, db),
    ]);

    assert.equal(stmtApr1.success, true);
    assert.equal(stmtApr2.success, true);
    assert.equal(stmtApr1.statement.id, stmtApr2.statement.id, 'Both concurrent calls must yield the identical statement');
    assert.equal(stmtApr1.statement.periodKey, '2026-04');

    // In DB: exactly 1 statement created for period 2026-04
    const countAprStmts = await db.creditCardStatement.count({
      where: { accountId: cardCycles.id, periodKey: '2026-04' }
    });
    assert.equal(countAprStmts, 1, 'Exactly one statement record exists for period 2026-04');

    // In DB: exactly 1 obligation created for period 2026-04
    const countAprObs = await db.obligation.count({
      where: { accountId: cardCycles.id, title: { contains: '2026-04' } }
    });
    assert.equal(countAprObs, 1, 'Exactly one obligation created for period 2026-04');

    // Sequential repeat call is also idempotent
    const stmtAprRepeat = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardCycles.id,
      periodKey: '2026-04',
      statementDate: '2026-04-20T12:00:00.000Z',
      dueDate: '2026-05-10T12:00:00.000Z',
      statementAmount: 50000,
    }, db);
    assert.equal(stmtAprRepeat.success, true);
    assert.equal(stmtAprRepeat.statement.id, stmtApr1.statement.id);
    assert.equal(stmtAprRepeat.alreadyExists, true);
  });

  await t.test('V2-653g: Paid CC cycle obligation is deactivated (isActive: false) and suppressed from scheduler reminder deliveries, while open cycle remains active and receives reminders', async () => {
    // 1. Setup user with telegramId so scheduler processes their obligations
    const schedUserId = `usr_sched_cc_${timestamp}`;
    const schedUser = await db.user.create({
      data: {
        id: schedUserId,
        email: `sched_cc_${timestamp}@test.com`,
        name: 'CC Sched User',
        password: 'password123',
        telegramId: `tg_cc_${timestamp}`,
        timezone: 'UTC',
      }
    });

    const schedBank = await db.financialAccount.create({
      data: {
        userId: schedUserId,
        name: 'Sched Bank',
        type: 'BANK',
        openingBalance: new Decimal(100000),
        isActive: true,
      }
    });

    const schedCard = await db.financialAccount.create({
      data: {
        userId: schedUserId,
        name: 'Sched Platinum Card',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(200000),
        statementDay: 20,
        paymentDueDay: 10,
        defaultPaymentAccountId: schedBank.id,
        isActive: true,
      }
    });

    // 2. Create Statement 1 (Jan 2026, due 2026-02-10)
    const stmt1Res = await creditCardService.createCreditCardStatement(schedUserId, {
      accountId: schedCard.id,
      periodKey: '2026-01',
      statementDate: '2026-01-20T12:00:00.000Z',
      dueDate: '2026-02-10T12:00:00.000Z',
      statementAmount: 20000,
      minimumDue: 1000,
    }, db);
    assert.equal(stmt1Res.success, true);
    const stmt1Id = stmt1Res.statement.id;
    const stmt1Db = await db.creditCardStatement.findUnique({ where: { id: stmt1Id } });
    assert.ok(stmt1Db?.obligationId);
    const ob1Id = stmt1Db.obligationId!;

    // Verify Statement 1 obligation created with ONCE recurrence and active
    const ob1 = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.ok(ob1);
    assert.equal(ob1.recurrenceType, 'ONCE');
    assert.equal(ob1.recurrenceInterval, 1);
    assert.equal(ob1.isActive, true);
    assert.equal(ob1.isArchived, false);
    assert.equal(new Decimal(ob1.amount!).toString(), '20000');

    // Create a pre-existing PENDING delivery for Statement 1 to verify it gets acknowledged on payoff
    const rem1 = await db.reminder.create({
      data: {
        userId: schedUserId,
        obligationId: ob1Id,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        title: ob1.title,
        isActive: true,
      }
    });
    const deliv1 = await db.reminderDelivery.create({
      data: {
        userId: schedUserId,
        reminderId: rem1.id,
        obligationId: ob1Id,
        occurrenceKey: '2026-02-10',
        scheduledFor: new Date('2026-02-10T12:00:00.000Z'),
        offsetMinutes: 0,
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // 3. Create Statement 2 (Feb 2026, due 2026-03-10)
    const stmt2Res = await creditCardService.createCreditCardStatement(schedUserId, {
      accountId: schedCard.id,
      periodKey: '2026-02',
      statementDate: '2026-02-20T12:00:00.000Z',
      dueDate: '2026-03-10T12:00:00.000Z',
      statementAmount: 35000,
      minimumDue: 1750,
    }, db);
    assert.equal(stmt2Res.success, true);
    const stmt2Id = stmt2Res.statement.id;
    const stmt2Db = await db.creditCardStatement.findUnique({ where: { id: stmt2Id } });
    assert.ok(stmt2Db?.obligationId);
    const ob2Id = stmt2Db.obligationId!;

    // Verify Statement 2 obligation created with ONCE recurrence and active
    const ob2 = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.ok(ob2);
    assert.equal(ob2.recurrenceType, 'ONCE');
    assert.equal(ob2.recurrenceInterval, 1);
    assert.equal(ob2.isActive, true);
    assert.equal(ob2.isArchived, false);
    assert.equal(new Decimal(ob2.amount!).toString(), '35000');

    // 4. Pay Statement 1 in full (₹20,000)
    const payStmt1 = await creditCardService.recordCreditCardPayment(schedUserId, {
      statementId: stmt1Id,
      fromAccountId: schedBank.id,
      amount: 20000,
      note: 'Payoff Stmt 1',
    }, db);
    assert.equal(payStmt1.statementStatus, 'PAID');
    assert.equal(payStmt1.fullyPaid, true);

    // Verify Statement 1 obligation is atomically deactivated
    const ob1AfterPay = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.equal(ob1AfterPay?.isActive, false, 'Statement 1 obligation must be deactivated (isActive: false)');
    assert.equal(ob1AfterPay?.isArchived, true, 'Statement 1 obligation must be archived (isArchived: true)');
    assert.equal(ob1AfterPay?.amount, null);
    assert.equal(ob1AfterPay?.nextDueAt.toISOString(), '2026-02-10T12:00:00.000Z');

    // Verify pre-existing delivery for Statement 1 was acknowledged/cancelled
    const deliv1AfterPay = await db.reminderDelivery.findUnique({ where: { id: deliv1.id } });
    assert.equal(deliv1AfterPay?.status, 'ACKNOWLEDGED', 'Pending delivery for paid Statement 1 must be acknowledged');

    // Verify Statement 2 obligation remains active and untouched
    const ob2AfterPay1 = await db.obligation.findUnique({ where: { id: ob2Id } });
    assert.equal(ob2AfterPay1?.isActive, true, 'Statement 2 obligation must remain active');
    assert.equal(ob2AfterPay1?.isArchived, false);
    assert.equal(new Decimal(ob2AfterPay1!.amount!).toString(), '35000');

    // 5. Run scheduler tick when Statement 2 reminder is due (2026-03-10T12:00:00.000Z)
    const mockBot = {
      sentMessages: [] as Array<{ chatId: string; text: string; options?: any }>,
      api: {
        sendMessage: async (chatId: string, text: string, options?: any) => {
          mockBot.sentMessages.push({ chatId, text, options });
          return { message_id: 3000 + mockBot.sentMessages.length };
        },
      },
    };

    const tickNow = new Date('2026-03-10T12:00:00.000Z');
    await processSchedulerTick({
      prismaClient: db,
      botClient: mockBot,
      now: tickNow,
    });

    // CRUCIAL FINDING P1 #2 VERIFICATIONS:
    // a) Statement 1 (paid) generated NO messages and NO new reminder deliveries
    const userMessages = mockBot.sentMessages.filter(m => m.chatId === schedUser.telegramId);
    assert.ok(userMessages.length > 0, 'Scheduler should have sent at least one message for active obligations');
    const hasStmt1Message = userMessages.some(m => m.text.includes('2026-01'));
    assert.equal(hasStmt1Message, false, 'Paid Statement 1 must NEVER generate Telegram reminder messages');

    // b) Statement 2 (active) received reminders
    const hasStmt2Message = userMessages.some(m => m.text.includes('2026-02') || m.text.includes('35,000') || m.text.includes('35000'));
    assert.ok(hasStmt2Message, 'Active Statement 2 must receive Telegram reminder');

    // c) Check DB deliveries: Statement 1 has 0 PENDING or SENT deliveries
    const stmt1Deliveries = await db.reminderDelivery.findMany({
      where: { obligationId: ob1Id, status: { in: ['PENDING', 'SENT'] } }
    });
    assert.equal(stmt1Deliveries.length, 0, 'Statement 1 must have NO PENDING or SENT reminder deliveries');

    // d) Statement 2 has SENT reminder delivery
    const stmt2Deliveries = await db.reminderDelivery.findMany({
      where: { obligationId: ob2Id, status: 'SENT' }
    });
    assert.ok(stmt2Deliveries.length > 0, 'Statement 2 must have at least one SENT reminder delivery');

    // 6. Verify Revert: Reverting Statement 1 payment reactivates its obligation
    const revertStmt1 = await creditCardService.revertCreditCardPayment(schedUserId, {
      paymentId: payStmt1.paymentId,
    }, db);
    assert.equal(revertStmt1.success, true);
    assert.equal(revertStmt1.restoredStatus, 'OPEN');

    const ob1AfterRevert = await db.obligation.findUnique({ where: { id: ob1Id } });
    assert.equal(ob1AfterRevert?.isActive, true, 'Reverting payment must reactivate obligation (isActive: true)');
    assert.equal(ob1AfterRevert?.isArchived, false, 'Reverting payment must unarchive obligation (isArchived: false)');
    assert.equal(new Decimal(ob1AfterRevert!.amount!).toString(), '20000', 'Obligation amount must be restored');
    assert.equal(ob1AfterRevert?.nextDueAt.toISOString(), '2026-02-10T12:00:00.000Z');
  });

  await t.test('V2-654: SOL-R001-002: Concurrent credit card payments serialize under row lock and prevent duplicate transfers or overpaying', async () => {
    const cardAcc = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'SBI Elite Card',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(200000),
        statementDay: 15,
        paymentDueDay: 5,
        defaultPaymentAccountId: bankA.id,
        isActive: true,
      }
    });

    const stmtRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardAcc.id,
      periodKey: '2026-11',
      statementDate: new Date('2026-11-15T12:00:00.000Z'),
      dueDate: new Date('2026-12-05T12:00:00.000Z'),
      statementAmount: 25000,
    }, db);
    assert.equal(stmtRes.success, true);
    const stmtId = stmtRes.statement.id;

    // Concurrently trigger two full payments of ₹25,000 for the same statement
    const [res1, res2] = await Promise.all([
      creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmtId,
        fromAccountId: bankA.id,
        amount: 25000,
      }, db),
      creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmtId,
        fromAccountId: bankA.id,
        amount: 25000,
      }, db),
    ]);

    // One must have processed the payment, the other must have returned alreadyProcessed under lock
    assert.ok(res1.alreadyProcessed || res2.alreadyProcessed, 'One concurrent payment must return alreadyProcessed');
    assert.ok(!res1.alreadyProcessed || !res2.alreadyProcessed, 'Exactly one payment should actually process');
    assert.equal(res1.statementStatus, 'PAID');
    assert.equal(res2.statementStatus, 'PAID');

    // Verify only 1 payment and 1 transfer transaction created
    const payments = await db.creditCardPayment.findMany({ where: { statementId: stmtId } });
    assert.equal(payments.length, 1, 'Only one CreditCardPayment must exist');

    const transfers = await db.financialTransaction.findMany({
      where: {
        userId: userAId,
        type: 'TRANSFER',
        transferAccountId: cardAcc.id,
      }
    });
    assert.equal(transfers.length, 1, 'Only one TRANSFER transaction must exist');
    assert.equal(transfers[0].amount.toString(), '25000');

    // Verify idempotency key concurrent calls
    const stmtRes2 = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardAcc.id,
      periodKey: '2026-12',
      statementDate: new Date('2026-12-15T12:00:00.000Z'),
      dueDate: new Date('2027-01-05T12:00:00.000Z'),
      statementAmount: 30000,
    }, db);
    const stmt2Id = stmtRes2.statement.id;

    const [idem1, idem2] = await Promise.all([
      creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmt2Id,
        fromAccountId: bankA.id,
        amount: 5000,
        idempotencyKey: 'idem-cc-concurrent-key-1',
      }, db),
      creditCardService.recordCreditCardPayment(userAId, {
        statementId: stmt2Id,
        fromAccountId: bankA.id,
        amount: 5000,
        idempotencyKey: 'idem-cc-concurrent-key-1',
      }, db),
    ]);

    assert.ok(idem1.alreadyProcessed || idem2.alreadyProcessed);
    const payments2 = await db.creditCardPayment.findMany({ where: { statementId: stmt2Id } });
    assert.equal(payments2.length, 1, 'Duplicate idempotency key must not create duplicate payment');
  });

  await t.test('V2-655: SOL-R001-005 & SOL-R001-006: Statement-linked obligation update guard, Paid transfer routing, and Undo', async () => {
    const cardAcc = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'Axis Magnus Card',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(300000),
        statementDay: 18,
        paymentDueDay: 8,
        defaultPaymentAccountId: bankA.id,
        isActive: true,
      }
    });

    const stmtRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardAcc.id,
      periodKey: '2026-10',
      statementDate: new Date('2026-10-18T12:00:00.000Z'),
      dueDate: new Date('2026-11-08T12:00:00.000Z'),
      statementAmount: 18000,
    }, db);
    const stmt = await db.creditCardStatement.findUnique({ where: { id: stmtRes.statement.id } });
    assert.ok(stmt);
    const obId = stmt.obligationId!;
    assert.ok(obId);

    // SOL-R001-006: Attempt updateObligation to modify amount, dueAt, nextDueAt, or recurrence
    await assert.rejects(
      async () => financeService.updateObligation(userAId, obId, { amount: 20000 }, db),
      /Credit card statement obligations must be managed through the Credit Card statement workflow/
    );

    await assert.rejects(
      async () => financeService.updateObligation(userAId, obId, { dueAt: new Date('2026-11-10T12:00:00.000Z') }, db),
      /Credit card statement obligations must be managed through the Credit Card statement workflow/
    );

    await assert.rejects(
      async () => financeService.updateObligation(userAId, obId, { recurrenceType: 'MONTHLY' }, db),
      /Credit card statement obligations must be managed through the Credit Card statement workflow/
    );

    // Metadata updates (title, notes) should succeed
    const updateNotesRes = await financeService.updateObligation(userAId, obId, { notes: 'Updated bill note' }, db);
    assert.equal(updateNotesRes.success, true);

    // SOL-R001-005: markObligationPaid routes through statement payment creating a TRANSFER (not generic EXPENSE on card)
    const markRes = await financeService.markObligationPaid(userAId, {
      obligationId: obId,
      occurrenceKey: '2026-11-08',
      accountId: bankA.id,
    }, db);

    assert.equal(markRes.success, true);
    assert.equal(markRes.statementStatus, 'PAID');

    // Verify statement status is PAID (not left OPEN!)
    const stmtAfter = await db.creditCardStatement.findUnique({ where: { id: stmt.id } });
    assert.equal(stmtAfter?.status, 'PAID', 'Statement status must be PAID when obligation marked Paid');

    // Verify created transaction is TRANSFER from bank to card, not generic EXPENSE
    assert.ok(markRes.transactionId);
    const createdTx = await db.financialTransaction.findUnique({ where: { id: markRes.transactionId! } });
    assert.ok(createdTx);
    assert.equal(createdTx?.type, 'TRANSFER');
    assert.equal(createdTx?.accountId, bankA.id);
    assert.equal(createdTx?.transferAccountId, cardAcc.id);
    assert.equal(createdTx?.amount.toString(), '18000');

    // Verify obligation is deactivated and completed
    const obAfter = await db.obligation.findUnique({ where: { id: obId } });
    assert.equal(obAfter?.isActive, false);

    // Revert obligation payment (Undo)
    const undoRes = await financeService.revertObligationPayment(userAId, {
      obligationId: obId,
    }, db);

    assert.equal(undoRes.success, true);
    assert.equal(undoRes.creditCardReversed, true);

    // Statement status restored to OPEN
    const stmtRestored = await db.creditCardStatement.findUnique({ where: { id: stmt.id } });
    assert.equal(stmtRestored?.status, 'OPEN');

    // Obligation reactivated
    const obRestored = await db.obligation.findUnique({ where: { id: obId } });
    assert.equal(obRestored?.isActive, true);

    // Transfer transaction deleted
    const txRestored = await db.financialTransaction.findUnique({ where: { id: markRes.transactionId! } });
    assert.equal(txRestored, null);
  });

  await t.test('V2-656: SOL-R001-008: Overlapping scheduler ticks exclusively claim delivery attempt before sendMessage', async () => {
    const schedUser2 = await db.user.create({
      data: {
        id: `usr_sched_claim_${timestamp}`,
        email: `sched_claim_${timestamp}@test.com`,
        name: 'Sched Claim User',
        password: 'password123',
        telegramId: `tg_claim_${timestamp}`,
        timezone: 'UTC',
      }
    });

    const obDate = new Date('2026-04-10T12:00:00.000Z');
    const ob = await db.obligation.create({
      data: {
        userId: schedUser2.id,
        title: 'Electricity Overlap Test',
        kind: 'BILL',
        amount: new Decimal(4500),
        dueAt: obDate,
        nextDueAt: obDate,
        recurrenceType: 'ONCE',
        reminderOffsetsMin: [0],
        isActive: true,
      }
    });

    const sentMessages: any[] = [];
    const slowBot = {
      sentMessages,
      api: {
        sendMessage: async (chatId: string, text: string, options?: any) => {
          // Artificial 15ms latency to guarantee overlap
          await new Promise((r) => setTimeout(r, 15));
          sentMessages.push({ chatId, text, options });
          return { message_id: 8880 + sentMessages.length };
        }
      }
    };

    // Run 2 overlapping scheduler ticks concurrently
    await Promise.all([
      processSchedulerTick({
        prismaClient: db,
        botClient: slowBot,
        now: obDate,
      }),
      processSchedulerTick({
        prismaClient: db,
        botClient: slowBot,
        now: obDate,
      }),
    ]);

    // Verify exactly ONE Telegram message was sent
    const userMessages = sentMessages.filter((m) => m.chatId === schedUser2.telegramId);
    assert.equal(userMessages.length, 1, 'Overlapping scheduler ticks must send exactly ONE message');

    // Verify exactly ONE SENT delivery record exists
    const deliveries = await db.reminderDelivery.findMany({
      where: { obligationId: ob.id }
    });
    assert.equal(deliveries.length, 1, 'Only one delivery record should be created');
    assert.equal(deliveries[0].status, 'SENT');

    // Cleanup schedUser2
    await db.reminderDelivery.deleteMany({ where: { userId: schedUser2.id } });
    await db.obligation.deleteMany({ where: { userId: schedUser2.id } });
    await db.user.delete({ where: { id: schedUser2.id } });
  });

  await t.test('V2-657: SOL-R001-015: calculateCreditCardUsage supports debt ledger transaction types', async () => {
    const { calculateCreditCardUsage } = await import('./finance');
    const cardId = 'acc_card_usage_test';

    const transactions = [
      { type: 'EXPENSE', amount: 5000, accountId: cardId },
      { type: 'DEBT_REPAY', amount: 2000, accountId: cardId },
      { type: 'LEND', amount: 1000, accountId: cardId },
      { type: 'INCOME', amount: 500, accountId: cardId },
      { type: 'DEBT_COLLECT', amount: 1500, accountId: cardId },
      { type: 'TRANSFER', amount: 3000, accountId: 'bank_id', transferAccountId: cardId },
    ];

    const result = calculateCreditCardUsage(0, transactions, cardId, 50000);
    assert.equal(result.amountUsed.toString(), '3000');
    assert.equal(result.availableCredit?.toString(), '47000');
  });

  await t.test('SOL-R002-001 & SOL-R001-002: Revert CC payment from Bills targets specific payment and supports idempotent repeated undo', async () => {
    const cardAcc = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'SBI Prime Card R3',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(200000),
        statementDay: 15,
        paymentDueDay: 5,
        defaultPaymentAccountId: bankA.id,
        isActive: true,
      }
    });

    const stmtRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardAcc.id,
      periodKey: '2026-11',
      statementDate: new Date('2026-11-15T12:00:00.000Z'),
      dueDate: new Date('2026-12-05T12:00:00.000Z'),
      statementAmount: 25000,
    }, db);
    const stmtId = stmtRes.statement.id;
    const stmt = await db.creditCardStatement.findUnique({ where: { id: stmtId } });
    assert.ok(stmt);
    const obId = stmt.obligationId!;
    assert.ok(obId);

    // 1. First partial payment of 10,000 recorded directly
    const directPay = await creditCardService.recordCreditCardPayment(userAId, {
      statementId: stmtId,
      fromAccountId: bankA.id,
      amount: 10000,
      paidAt: new Date(),
      note: 'Direct partial payment',
    }, db);
    assert.equal(directPay.statementStatus, 'PARTIAL');
    assert.equal(directPay.pendingBalance, '15000');

    // 2. Second payment of remaining 15,000 recorded via markObligationPaid from Bills
    const billPay = await financeService.markObligationPaid(userAId, {
      obligationId: obId,
      occurrenceKey: '2026-12-05',
      accountId: bankA.id,
    }, db);
    assert.equal(billPay.success, true);
    assert.equal(billPay.statementStatus, 'PAID');

    // Verify 2 payments exist
    const paymentsBeforeUndo = await db.creditCardPayment.findMany({
      where: { statementId: stmtId },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(paymentsBeforeUndo.length, 2);
    assert.equal(paymentsBeforeUndo[0].id, directPay.paymentId);
    assert.equal(paymentsBeforeUndo[1].transactionId, billPay.transactionId);

    // 3. First undo from Bills via revertObligationPayment
    const undoRes1 = await financeService.revertObligationPayment(userAId, {
      obligationId: obId,
      occurrenceKey: '2026-12-05',
    }, db);
    assert.equal(undoRes1.success, true);
    assert.equal(undoRes1.alreadyReversed, false);
    assert.equal(undoRes1.restoredStatus, 'PARTIAL');
    assert.equal(undoRes1.pendingBalance, '15000');

    // Verify only the second payment was undone, the first payment (directPay) remains intact!
    const paymentsAfterFirstUndo = await db.creditCardPayment.findMany({
      where: { statementId: stmtId },
    });
    assert.equal(paymentsAfterFirstUndo.length, 1);
    assert.equal(paymentsAfterFirstUndo[0].id, directPay.paymentId);

    // 4. Repeated undo from Bills: must return idempotent success and NEVER reverse directPay!
    const undoRes2 = await financeService.revertObligationPayment(userAId, {
      obligationId: obId,
      occurrenceKey: '2026-12-05',
    }, db);
    assert.equal(undoRes2.success, true);
    assert.equal(undoRes2.alreadyReversed, true);

    const paymentsAfterSecondUndo = await db.creditCardPayment.findMany({
      where: { statementId: stmtId },
    });
    assert.equal(paymentsAfterSecondUndo.length, 1, 'First payment must NOT be reversed on repeated undo');
    assert.equal(paymentsAfterSecondUndo[0].id, directPay.paymentId);
  });

  await t.test('SOL-R001-007: Alias normalization across timezones recognizes past completions idempotently', async () => {
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Internet Fiber Bill',
        kind: 'SUBSCRIPTION',
        amount: new Decimal('999.00'),
        dueAt: new Date('2026-08-20T12:00:00.000Z'),
        nextDueAt: new Date('2026-08-20T12:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Mark paid with occurrenceKey '2026-08-20T12:00'
    const firstPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-20T12:00',
      createExpense: true,
      accountId: bankA.id,
    }, db);
    assert.equal(firstPay.success, true);
    assert.equal(firstPay.alreadyCompleted, false);

    // Call again with date-only alias '2026-08-20'
    const secondPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-20',
      createExpense: true,
      accountId: bankA.id,
    }, db);
    assert.equal(secondPay.success, true);
    assert.equal(secondPay.alreadyCompleted, true);

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R001-004: Stale EMI callback overtaken guard returns stale without corrupting loan', async () => {
    const testLoan = await db.loan.create({
      data: {
        userId: userAId,
        name: 'Two-Wheeler Loan R3',
        lender: 'HDFC Bank',
        loanType: 'VEHICLE',
        openingOutstanding: new Decimal('70000.00'),
        outstandingPrincipal: new Decimal('70000.00'),
        tenureMonths: 24,
        emiAmount: new Decimal('3800.00'),
        startDate: new Date('2026-01-05T12:00:00.000Z'),
        nextEmiDate: new Date('2026-04-05T12:00:00.000Z'),
        dueDay: 5,
        status: 'ACTIVE',
      }
    });

    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: testLoan.name,
        kind: 'EMI',
        amount: testLoan.emiAmount,
        dueAt: testLoan.nextEmiDate!,
        nextDueAt: testLoan.nextEmiDate!,
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    await db.loan.update({ where: { id: testLoan.id }, data: { obligationId: ob.id } });

    // Stale occurrence key from February arrives when nextEmiDate is April
    const staleRes = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-02-05',
      accountId: bankA.id,
    }, db);

    assert.equal(staleRes.success, true);
    assert.equal(staleRes.alreadyCompleted, true);

    // Verify loan was NOT corrupted or advanced
    const loanAfterStale = await db.loan.findUnique({ where: { id: testLoan.id } });
    assert.equal(loanAfterStale?.nextEmiDate?.toISOString(), new Date('2026-04-05T12:00:00.000Z').toISOString());
    assert.equal(loanAfterStale?.outstandingPrincipal.toString(), '70000');

    // Clean up
    await db.loan.delete({ where: { id: testLoan.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R002-004 & SOL-R002-005: Crash recovery lease timeout in scheduler recovers stale SENDING deliveries', async () => {
    const { getOccurrenceKey } = await import('../recurrence/recurrence');
    const schedUser3 = await db.user.create({
      data: {
        id: `usr_sched_lease_${timestamp}`,
        email: `sched_lease_${timestamp}@test.com`,
        name: 'Sched Lease User',
        password: 'password123',
        telegramId: `tg_lease_${timestamp}`,
        timezone: 'UTC',
      }
    });

    const obDue = new Date(Date.now() - 60000); // 1 minute ago
    const ob = await db.obligation.create({
      data: {
        userId: schedUser3.id,
        title: 'Lease Timeout Test Bill',
        kind: 'BILL',
        amount: new Decimal('1200.00'),
        dueAt: obDue,
        nextDueAt: obDue,
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    const reminder = await db.reminder.create({
      data: {
        userId: schedUser3.id,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        obligationId: ob.id,
        title: ob.title,
        isActive: true,
      }
    });

    // Create a delivery with exact occurrenceKey that was left stuck in SENDING from a crashed worker 10 minutes ago
    const staleAttemptTime = new Date(Date.now() - 10 * 60 * 1000);
    const expectedOccurrenceKey = getOccurrenceKey(obDue, 'UTC');
    const stuckDelivery = await db.reminderDelivery.create({
      data: {
        userId: schedUser3.id,
        reminderId: reminder.id,
        obligationId: ob.id,
        occurrenceKey: expectedOccurrenceKey,
        scheduledFor: obDue,
        offsetMinutes: 0,
        channel: 'TELEGRAM',
        status: 'SENDING',
        attemptCount: 1,
        lastAttemptAt: staleAttemptTime,
      }
    });

    let sentLeaseMsg = false;
    const testBot: any = {
      api: {
        sendMessage: async () => {
          sentLeaseMsg = true;
          return { message_id: 888 };
        }
      }
    };

    // Run scheduler tick - should recover the expired lease and complete delivery
    await processSchedulerTick({
      prismaClient: db,
      botClient: testBot,
      now: new Date(),
    });

    assert.equal(sentLeaseMsg, true, 'Scheduler must recover expired lease and send telegram notification');
    const updatedDelivery = await db.reminderDelivery.findUnique({ where: { id: stuckDelivery.id } });
    assert.equal(updatedDelivery?.status, 'SENT');

    // Clean up
    await db.reminderDelivery.deleteMany({ where: { userId: schedUser3.id } });
    await db.reminder.deleteMany({ where: { userId: schedUser3.id } });
    await db.obligation.deleteMany({ where: { userId: schedUser3.id } });
    await db.user.delete({ where: { id: schedUser3.id } });
  });

  await t.test('SOL-R002-007: getObligations read model correctly exposes isCreditCardStatement and statement details', async () => {
    const cardAcc = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'HDFC Tata Neu Card R3',
        type: 'CREDIT_CARD',
        openingBalance: new Decimal(0),
        creditLimit: new Decimal(100000),
        statementDay: 10,
        paymentDueDay: 30,
        defaultPaymentAccountId: bankA.id,
        isActive: true,
      }
    });

    const stmtRes = await creditCardService.createCreditCardStatement(userAId, {
      accountId: cardAcc.id,
      periodKey: '2026-12',
      statementDate: new Date('2026-12-10T12:00:00.000Z'),
      dueDate: new Date('2026-12-30T12:00:00.000Z'),
      statementAmount: 14500,
    }, db);

    const stmt = await db.creditCardStatement.findUnique({ where: { id: stmtRes.statement.id } });
    assert.ok(stmt);
    const obligations = await financeService.getObligations(userAId, db);
    const ccOb = obligations.find((o) => o.id === stmt.obligationId);
    assert.ok(ccOb);
    assert.equal(ccOb.isCreditCardStatement, true);
    assert.ok(ccOb.creditCardStatement);
    assert.equal(ccOb.creditCardStatement.id, stmtRes.statement.id);
  });

  await t.test('SOL-R002-008: DebtForm date preservation helpers avoid timezone drift and preserve exact timestamps', async () => {
    const { toPreservedCalendarIso, formatToDateInput } = await import('../../components/finance/DebtForm');

    // Test calendar date YYYY-MM-DD input
    const dateInput = '2026-10-15';
    const preservedIso = toPreservedCalendarIso(dateInput, 'Asia/Kolkata');
    assert.ok(preservedIso.includes('2026-10-15'));

    // Test formatting back to date input
    const formatted = formatToDateInput(preservedIso, 'Asia/Kolkata');
    assert.equal(formatted, '2026-10-15');

    // Test exact timestamp preservation when date string is unchanged
    const exactOriginal = '2026-10-15T12:00:00.000Z';
    const originalFormatted = formatToDateInput(exactOriginal, 'UTC');
    assert.equal(originalFormatted, '2026-10-15');
  });

  await t.test('SOL-R001-004: Kiritimati (+14) UTC scheduler key matches active EMI and advances loan', async () => {
    const kiritimatiUser = await db.user.create({
      data: {
        id: `usr_kiri_${timestamp}`,
        email: `kiri_${timestamp}@test.com`,
        name: 'Kiritimati User',
        password: 'password123',
        telegramId: `tg_kiri_${timestamp}`,
        timezone: 'Pacific/Kiritimati', // UTC+14
      }
    });

    const kiriBank = await financeService.createAccount(kiritimatiUser.id, {
      name: 'Kiritimati Bank',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);

    // In Kiritimati (+14): Nov 15 12:00 is Nov 14 22:00 UTC
    const emiDateUtc = new Date('2026-11-14T22:00:00.000Z');

    const testLoan = await db.loan.create({
      data: {
        userId: kiritimatiUser.id,
        name: 'Kiritimati Scooter Loan',
        lender: 'Pacific Finance',
        loanType: 'VEHICLE',
        openingOutstanding: new Decimal('30000.00'),
        outstandingPrincipal: new Decimal('30000.00'),
        tenureMonths: 12,
        emiAmount: new Decimal('2500.00'),
        startDate: emiDateUtc,
        nextEmiDate: emiDateUtc,
        dueDay: 15,
        status: 'ACTIVE',
        paymentAccountId: kiriBank.account.id,
      }
    });

    const ob = await db.obligation.create({
      data: {
        userId: kiritimatiUser.id,
        title: testLoan.name,
        kind: 'EMI',
        amount: testLoan.emiAmount,
        dueAt: emiDateUtc,
        nextDueAt: emiDateUtc,
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    await db.loan.update({ where: { id: testLoan.id }, data: { obligationId: ob.id } });

    // Scheduler generates occurrence key in UTC: '2026-11-14T22:00'
    const payRes = await financeService.markObligationPaid(kiritimatiUser.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-11-14T22:00',
      accountId: kiriBank.account.id,
    }, db);

    assert.equal(payRes.success, true);
    assert.equal(payRes.alreadyCompleted, false);

    // Verify loan was advanced to next month (Dec 15 local)
    const loanAfter = await db.loan.findUnique({ where: { id: testLoan.id } });
    assert.ok(loanAfter?.nextEmiDate);
    assert.notEqual(loanAfter?.nextEmiDate.toISOString(), emiDateUtc.toISOString());

    // Verify loan payment was created
    const payment = await db.loanPayment.findFirst({ where: { loanId: testLoan.id } });
    assert.ok(payment);
    assert.equal(payment?.amount.toString(), '2500');

    // Clean up
    await db.loanPayment.deleteMany({ where: { loanId: testLoan.id } });
    await db.loan.delete({ where: { id: testLoan.id } });
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R001-004: Future EMI callback is safely rejected without corrupting loan', async () => {
    const testLoan = await db.loan.create({
      data: {
        userId: userAId,
        name: 'Future EMI Guard Loan',
        lender: 'HDFC Bank',
        loanType: 'PERSONAL',
        openingOutstanding: new Decimal('50000.00'),
        outstandingPrincipal: new Decimal('50000.00'),
        tenureMonths: 12,
        emiAmount: new Decimal('5000.00'),
        startDate: new Date('2026-04-10T12:00:00.000Z'),
        nextEmiDate: new Date('2026-04-10T12:00:00.000Z'), // Active is April
        dueDay: 10,
        status: 'ACTIVE',
        paymentAccountId: bankA.id,
      }
    });

    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: testLoan.name,
        kind: 'EMI',
        amount: testLoan.emiAmount,
        dueAt: testLoan.nextEmiDate!,
        nextDueAt: testLoan.nextEmiDate!,
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    await db.loan.update({ where: { id: testLoan.id }, data: { obligationId: ob.id } });

    // Future callback for June arrives while loan is on April
    const futureRes = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-06-10',
      accountId: bankA.id,
    }, db);

    assert.equal(futureRes.success, true);
    assert.equal(futureRes.alreadyCompleted, true);

    // Verify loan was NOT corrupted or advanced
    const loanAfter = await db.loan.findUnique({ where: { id: testLoan.id } });
    assert.equal(loanAfter?.nextEmiDate?.toISOString(), new Date('2026-04-10T12:00:00.000Z').toISOString());
    assert.equal(loanAfter?.outstandingPrincipal.toString(), '50000');

    // Clean up
    await db.loan.delete({ where: { id: testLoan.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R001-007: Concurrent date-only and timestamp submissions serialize without duplicate payments', async () => {
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Concurrent Fiber Bill',
        kind: 'SUBSCRIPTION',
        amount: new Decimal('1200.00'),
        dueAt: new Date('2026-09-15T12:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T12:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Simulate concurrent date-only ('2026-09-15') and timestamp ('2026-09-15T12:00') requests
    const [res1, res2] = await Promise.all([
      financeService.markObligationPaid(userAId, {
        obligationId: ob.id,
        occurrenceKey: '2026-09-15',
        createExpense: true,
        accountId: bankA.id,
      }, db),
      financeService.markObligationPaid(userAId, {
        obligationId: ob.id,
        occurrenceKey: '2026-09-15T12:00',
        createExpense: true,
        accountId: bankA.id,
      }, db),
    ]);

    // Exactly one should be initial completion and one should be alreadyCompleted
    assert.equal(res1.success, true);
    assert.equal(res2.success, true);
    const completedCount = (res1.alreadyCompleted ? 0 : 1) + (res2.alreadyCompleted ? 0 : 1);
    assert.equal(completedCount, 1, 'Exactly one concurrent request succeeds and one is marked alreadyCompleted');

    // Only one occurrence record exists
    const occs = await db.obligationOccurrence.findMany({ where: { obligationId: ob.id } });
    assert.equal(occs.length, 1, 'Only one occurrence record created');

    // Only one financial transaction created
    const txs = await db.financialTransaction.findMany({ where: { obligationId: ob.id } });
    assert.equal(txs.length, 1, 'Only one transaction created');

    // Clean up
    await db.financialTransaction.deleteMany({ where: { obligationId: ob.id } });
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R001-007: Adjacent daily occurrences in UTC+14 remain distinct and never false-match', async () => {
    const kiritimatiUser = await db.user.create({
      data: {
        id: `usr_kiri_adj_${timestamp}`,
        email: `kiri_adj_${timestamp}@test.com`,
        name: 'Kiritimati Adjacent User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati', // UTC+14
      }
    });

    // Day 1: Nov 15 noon in Kiritimati = Nov 14 22:00 UTC
    const day1Due = new Date('2026-11-14T22:00:00.000Z');
    const ob = await db.obligation.create({
      data: {
        userId: kiritimatiUser.id,
        title: 'Daily Kiritimati Check',
        kind: 'BILL',
        amount: new Decimal('100.00'),
        dueAt: day1Due,
        nextDueAt: day1Due,
        recurrenceType: 'DAILY',
        isActive: true,
      }
    });

    // Mark Day 1 paid with date-only key '2026-11-15'
    const pay1 = await financeService.markObligationPaid(kiritimatiUser.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-11-15',
    }, db);
    assert.equal(pay1.success, true);
    assert.equal(pay1.alreadyCompleted, false);

    // Verify obligation advanced to Day 2: Nov 16 noon in Kiritimati = Nov 15 22:00 UTC
    const obAfter1 = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.ok(obAfter1?.nextDueAt);

    // Mark Day 2 paid with UTC key '2026-11-15T22:00' (which starts with '2026-11-15' in UTC)
    // In old buggy code, '2026-11-15T22:00'.startsWith('2026-11-15') false-matched Day 1!
    const pay2 = await financeService.markObligationPaid(kiritimatiUser.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-11-15T22:00',
    }, db);
    assert.equal(pay2.success, true);
    assert.equal(pay2.alreadyCompleted, false, 'Day 2 must NOT false-match Day 1');

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R001-007: Historical occurrence completion stored due date does not suppress current day deliveries or payment', async () => {
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Internet Fiber Bill',
        kind: 'BILL',
        amount: new Decimal('1200.00'),
        dueAt: new Date('2026-09-15T12:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T12:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Create a reminder and delivery record for current due date
    const rem = await db.reminder.create({
      data: {
        userId: userAId,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        title: ob.title,
        obligationId: ob.id,
        isActive: true,
      }
    });

    const activeDel = await db.reminderDelivery.create({
      data: {
        userId: userAId,
        reminderId: rem.id,
        obligationId: ob.id,
        occurrenceKey: '2026-09-15T12:00',
        scheduledFor: new Date('2026-09-15T12:00:00.000Z'),
        offsetMinutes: 0,
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // Pay historical occurrence from August
    const histPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-15',
      createExpense: false,
    }, db);

    assert.equal(histPay.success, true);
    assert.equal(histPay.alreadyCompleted, false);

    // Verify stored occurrence has August dueDate, NOT September nextDueAt
    const histOcc = await db.obligationOccurrence.findUnique({
      where: {
        obligationId_occurrenceKey: {
          obligationId: ob.id,
          occurrenceKey: '2026-08-15',
        }
      }
    });
    assert.ok(histOcc);
    assert.equal(histOcc.dueDate.toISOString().substring(0, 10), '2026-08-15', 'Historical occurrence stores resolved August dueDate');

    // Verify active delivery for September was NOT acknowledged or suppressed
    const activeDelAfter = await db.reminderDelivery.findUnique({ where: { id: activeDel.id } });
    assert.equal(activeDelAfter?.status, 'PENDING', 'September reminder delivery remains PENDING');

    // Pay current occurrence for September - must succeed and NOT be recognized as already completed
    const currPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-09-15T12:00',
      createExpense: false,
    }, db);
    assert.equal(currPay.success, true);
    assert.equal(currPay.alreadyCompleted, false, 'Current day payment succeeds and was not blocked by historical payment');

    // September delivery is now acknowledged
    const activeDelFinal = await db.reminderDelivery.findUnique({ where: { id: activeDel.id } });
    assert.equal(activeDelFinal?.status, 'ACKNOWLEDGED');

    // Clean up
    await db.reminderDelivery.deleteMany({ where: { obligationId: ob.id } });
    await db.reminder.deleteMany({ where: { obligationId: ob.id } });
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R004-007: Validate payer account when creating expense on obligation paid', async () => {
    // Inactive account for User A
    const inactiveAccount = await db.financialAccount.create({
      data: {
        userId: userAId,
        name: 'Closed Axis Bank',
        type: 'BANK',
        openingBalance: new Decimal(1000),
        isActive: false,
      }
    });

    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Electricity Bill Test Account',
        kind: 'BILL',
        amount: new Decimal('1500.00'),
        dueAt: new Date('2026-10-15T12:00:00.000Z'),
        nextDueAt: new Date('2026-10-15T12:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // 1. Missing account rejected when createExpense is true and amount is present
    await assert.rejects(
      async () => {
        await financeService.markObligationPaid(userAId, {
          obligationId: ob.id,
          occurrenceKey: '2026-10-15T12:00',
          createExpense: true,
        }, db);
      },
      /Payment account required/,
      'Missing account is strictly rejected'
    );

    // Obligation must NOT be completed
    let occCount = await db.obligationOccurrence.count({ where: { obligationId: ob.id } });
    assert.equal(occCount, 0, 'Obligation occurrence was not created on missing account error');

    // 2. Foreign account (owned by User B) rejected
    await assert.rejects(
      async () => {
        await financeService.markObligationPaid(userAId, {
          obligationId: ob.id,
          occurrenceKey: '2026-10-15T12:00',
          createExpense: true,
          accountId: bankB.id,
        }, db);
      },
      /not found or unauthorized/,
      'Foreign account is strictly rejected'
    );

    occCount = await db.obligationOccurrence.count({ where: { obligationId: ob.id } });
    assert.equal(occCount, 0, 'Obligation occurrence was not created on foreign account error');

    // 3. Inactive account rejected
    await assert.rejects(
      async () => {
        await financeService.markObligationPaid(userAId, {
          obligationId: ob.id,
          occurrenceKey: '2026-10-15T12:00',
          createExpense: true,
          accountId: inactiveAccount.id,
        }, db);
      },
      /inactive payment account/,
      'Inactive account is strictly rejected'
    );

    occCount = await db.obligationOccurrence.count({ where: { obligationId: ob.id } });
    assert.equal(occCount, 0, 'Obligation occurrence was not created on inactive account error');

    // 4. Valid active account succeeds
    const validPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-10-15T12:00',
      createExpense: true,
      accountId: bankA.id,
    }, db);
    assert.equal(validPay.success, true);
    assert.equal(validPay.alreadyCompleted, false);
    assert.ok(validPay.transactionId);

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.financialTransaction.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
    await db.financialAccount.delete({ where: { id: inactiveAccount.id } });
  });

  await t.test('SOL-R004-002: Latest-only undo prevents reverting earlier completion under lock', async () => {
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Gym Membership Latest Revert',
        kind: 'SUBSCRIPTION',
        amount: new Decimal('2500.00'),
        dueAt: new Date('2026-01-01T10:00:00.000Z'),
        nextDueAt: new Date('2026-01-01T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Pay occurrence 1 (Jan 2026)
    const pay1 = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-01-01T10:00',
      createExpense: false,
    }, db);
    assert.equal(pay1.success, true);
    const occ1Id = pay1.occurrenceId!;

    // Pay occurrence 2 (Feb 2026)
    const pay2 = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-02-01T10:00',
      createExpense: false,
    }, db);
    assert.equal(pay2.success, true);
    const occ2Id = pay2.occurrenceId!;

    // Attempting to revert Jan occurrence while Feb occurrence exists must be rejected
    await assert.rejects(
      async () => {
        await financeService.revertObligationPayment(userAId, {
          obligationId: ob.id,
          occurrenceId: occ1Id,
        }, db);
      },
      /reverse chronological order/,
      'Cannot revert earlier occurrence when later occurrence is completed'
    );

    // Revert Feb occurrence succeeds
    const rev2 = await financeService.revertObligationPayment(userAId, {
      obligationId: ob.id,
      occurrenceId: occ2Id,
    }, db);
    assert.equal(rev2.success, true);
    assert.equal(rev2.alreadyReversed, false);

    // Now reverting Jan occurrence succeeds
    const rev1 = await financeService.revertObligationPayment(userAId, {
      obligationId: ob.id,
      occurrenceId: occ1Id,
    }, db);
    assert.equal(rev1.success, true);
    assert.equal(rev1.alreadyReversed, false);

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R002-008: ObligationForm formatDateForInput in configured timezone', async () => {
    const { formatDateForInput } = await import('../../components/finance/ObligationForm');

    // Pacific/Kiritimati (UTC+14): 2026-11-14 22:00 UTC is 2026-11-15 12:00 local
    const kiritimatiDate = formatDateForInput('2026-11-14T22:00:00.000Z', 'Pacific/Kiritimati');
    assert.equal(kiritimatiDate, '2026-11-15', 'Kiritimati calendar date is Nov 15');

    // Pacific/Honolulu (UTC-10): 2026-11-15 02:00 UTC is 2026-11-14 16:00 local
    const honoluluDate = formatDateForInput('2026-11-15T02:00:00.000Z', 'Pacific/Honolulu');
    assert.equal(honoluluDate, '2026-11-14', 'Honolulu calendar date is Nov 14');
  });

  await t.test('SOL-R002-008: getObligations and getObligationById read models expose user.timezone', async () => {
    const userKiri = await db.user.create({
      data: {
        id: `usr_tz_read_${timestamp}`,
        email: `tz_read_${timestamp}@test.com`,
        name: 'Timezone Read Model User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati',
      }
    });

    const ob = await db.obligation.create({
      data: {
        userId: userKiri.id,
        title: 'Timezone Read Test Bill',
        kind: 'BILL',
        amount: new Decimal('750.00'),
        dueAt: new Date('2026-09-14T22:00:00.000Z'), // 2026-09-15 12:00 in Kiritimati
        nextDueAt: new Date('2026-09-14T22:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // 1. getObligations exposes user.timezone
    const obs = await financeService.getObligations(userKiri.id, db);
    const obItem = obs.find((o) => o.id === ob.id);
    assert.ok(obItem, 'Obligation returned by getObligations');
    assert.ok(obItem?.user, 'Obligation exposes user object');
    assert.equal(obItem?.user?.timezone, 'Pacific/Kiritimati', 'getObligations exposes user.timezone');

    // 2. getObligationById exposes user.timezone
    const singleOb = await financeService.getObligationById(userKiri.id, ob.id, db);
    assert.ok(singleOb, 'Obligation returned by getObligationById');
    assert.ok(singleOb.user, 'getObligationById exposes user object');
    assert.equal(singleOb.user?.timezone, 'Pacific/Kiritimati', 'getObligationById exposes user.timezone');

    // Clean up
    await db.obligation.delete({ where: { id: ob.id } });
    await db.user.delete({ where: { id: userKiri.id } });
  });

  await t.test('SOL-R001-007: Historical Occurrence Resolution & Canonical Scheduled Instant', async () => {
    const userKiri = await db.user.create({
      data: {
        id: `usr_sol_r001_007_${timestamp}`,
        email: `sol_r001_007_${timestamp}@test.com`,
        name: 'Historical Resolution User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati', // UTC+14
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userKiri.id,
        name: 'Kiritimati Bank',
        type: 'BANK',
        openingBalance: new Decimal(10000),
      }
    });

    // Scheduled at 12:00 local noon in Kiritimati = 22:00 UTC previous day
    // Anchor dueAt: Sept 14 22:00 UTC = Sept 15 12:00 local
    const ob = await db.obligation.create({
      data: {
        userId: userKiri.id,
        title: 'Kiritimati Monthly Electricity',
        kind: 'BILL',
        amount: new Decimal('2000.00'),
        accountId: account.id,
        dueAt: new Date('2026-09-14T22:00:00.000Z'),
        nextDueAt: new Date('2026-09-14T22:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // 1. Mark historical August occurrence using local key '2026-08-15T12:00'
    const payLocal = await financeService.markObligationPaid(userKiri.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-15T12:00',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payLocal.success, true);
    assert.equal(payLocal.alreadyCompleted, false);
    assert.ok(payLocal.transactionId);

    // Verify stored occurrence has exact instant 2026-08-14T22:00:00.000Z
    const occLocal = await db.obligationOccurrence.findUnique({
      where: { id: payLocal.occurrenceId! }
    });
    assert.ok(occLocal);
    assert.equal(occLocal.dueDate.toISOString(), '2026-08-14T22:00:00.000Z', 'Local key resolves to scheduled UTC instant');

    // 2. Retry with alternate format: UTC key '2026-08-14T22:00'
    // Must return alreadyCompleted: true and create NO duplicate expense
    const payUtcRetry = await financeService.markObligationPaid(userKiri.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-14T22:00',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payUtcRetry.success, true);
    assert.equal(payUtcRetry.alreadyCompleted, true, 'UTC key recognized as already completed');
    assert.equal(payUtcRetry.transactionId, payLocal.transactionId, 'Same transactionId returned on UTC retry');

    // 3. Retry with alternate format: date-only key '2026-08-15'
    const payDateOnlyRetry = await financeService.markObligationPaid(userKiri.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-15',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payDateOnlyRetry.success, true);
    assert.equal(payDateOnlyRetry.alreadyCompleted, true, 'Date-only key recognized as already completed');

    // Exactly one expense transaction exists for this occurrence
    const expenseCount = await db.financialTransaction.count({
      where: { obligationId: ob.id }
    });
    assert.equal(expenseCount, 1, 'Exactly one expense created across all representation formats');

    // 4. Preserve non-noon scheduled time for date-only historical completion
    // Create UTC-scheduled bill at 09:00 UTC
    const userUtc = await db.user.create({
      data: {
        id: `usr_sol_utc_sched_${timestamp}`,
        email: `utc_sched_${timestamp}@test.com`,
        name: 'UTC Sched User',
        password: 'password123',
        timezone: 'UTC',
      }
    });

    const obUtc9 = await db.obligation.create({
      data: {
        userId: userUtc.id,
        title: 'Morning 9am UTC Server Bill',
        kind: 'BILL',
        amount: new Decimal('500.00'),
        dueAt: new Date('2026-09-15T09:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T09:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Mark historical August occurrence with date-only key '2026-08-15'
    const payDateOnly9 = await financeService.markObligationPaid(userUtc.id, {
      obligationId: obUtc9.id,
      occurrenceKey: '2026-08-15',
      createExpense: false,
    }, db);
    assert.equal(payDateOnly9.success, true);
    assert.equal(payDateOnly9.alreadyCompleted, false);

    const occ9 = await db.obligationOccurrence.findUnique({
      where: { id: payDateOnly9.occurrenceId! }
    });
    assert.ok(occ9);
    assert.equal(occ9.dueDate.toISOString(), '2026-08-15T09:00:00.000Z', 'Date-only completion preserves 09:00 scheduled time, not 12:00 noon');

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.financialTransaction.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
    await db.financialAccount.delete({ where: { id: account.id } });
    await db.user.delete({ where: { id: userKiri.id } });
    await db.obligationOccurrence.deleteMany({ where: { obligationId: obUtc9.id } });
    await db.obligation.delete({ where: { id: obUtc9.id } });
    await db.user.delete({ where: { id: userUtc.id } });
  });

  await t.test('SOL-R004-010: Undo of Historical Payment Must Not Rewind Unrelated Active Schedule', async () => {
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Broadband Plan Schedule Isolation',
        kind: 'BILL',
        amount: new Decimal('999.00'),
        dueAt: new Date('2026-09-15T10:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    const rem = await db.reminder.create({
      data: {
        userId: userAId,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        title: ob.title,
        obligationId: ob.id,
        isActive: true,
      }
    });

    const activeDelSept = await db.reminderDelivery.create({
      data: {
        userId: userAId,
        reminderId: rem.id,
        obligationId: ob.id,
        occurrenceKey: '2026-09-15T10:00',
        scheduledFor: new Date('2026-09-15T10:00:00.000Z'),
        offsetMinutes: 0,
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // 1. Pay historical occurrence for August 15 while September 15 is current
    const histPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-08-15T10:00',
      createExpense: false,
    }, db);
    assert.equal(histPay.success, true);
    assert.equal(histPay.alreadyCompleted, false);

    // Verify nextDueAt remained September 15
    const obAfterHistPay = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(obAfterHistPay?.nextDueAt.toISOString(), '2026-09-15T10:00:00.000Z', 'Historical payment leaves nextDueAt at Sept 15');

    // 2. Revert / Undo historical August payment
    const histUndo = await financeService.revertObligationPayment(userAId, {
      obligationId: ob.id,
      occurrenceId: histPay.occurrenceId!,
    }, db);
    assert.equal(histUndo.success, true);
    assert.equal(histUndo.alreadyReversed, false);

    // SOL-R004-010: Undo of historical payment must NOT rewind nextDueAt back to August 15!
    const obAfterHistUndo = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(obAfterHistUndo?.nextDueAt.toISOString(), '2026-09-15T10:00:00.000Z', 'Undo of historical payment leaves nextDueAt UNCHANGED at Sept 15');
    assert.equal(histUndo.restoredNextDueAt, '2026-09-15T10:00:00.000Z', 'Result reports unchanged nextDueAt');

    // Verify active September reminder delivery was NOT deleted or cancelled
    const delAfterUndo = await db.reminderDelivery.findUnique({ where: { id: activeDelSept.id } });
    assert.equal(delAfterUndo?.status, 'PENDING', 'September reminder delivery preserved as PENDING');

    // 3. Now pay the active September occurrence
    const activePay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-09-15T10:00',
      createExpense: false,
    }, db);
    assert.equal(activePay.success, true);

    // nextDueAt advances to October 15
    const obAfterActivePay = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(obAfterActivePay?.nextDueAt.toISOString(), '2026-10-15T10:00:00.000Z', 'Active payment advances schedule to Oct 15');

    // 4. Undo the active September payment -> schedule MUST be restored back to September 15
    const activeUndo = await financeService.revertObligationPayment(userAId, {
      obligationId: ob.id,
      occurrenceId: activePay.occurrenceId!,
    }, db);
    assert.equal(activeUndo.success, true);
    assert.equal(activeUndo.alreadyReversed, false);

    const obAfterActiveUndo = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(obAfterActiveUndo?.nextDueAt.toISOString(), '2026-09-15T10:00:00.000Z', 'Undo of active payment restores nextDueAt to Sept 15');

    // Clean up
    await db.reminderDelivery.deleteMany({ where: { obligationId: ob.id } });
    await db.reminder.deleteMany({ where: { obligationId: ob.id } });
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R001-007: Historical Occurrence Resolution Across DST in America/New_York', async () => {
    const userNy = await db.user.create({
      data: {
        id: `usr_sol_dst_ny_${timestamp}`,
        email: `dst_ny_${timestamp}@test.com`,
        name: 'New York DST User',
        password: 'password123',
        timezone: 'America/New_York',
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userNy.id,
        name: 'Chase Checking',
        type: 'BANK',
        openingBalance: new Decimal(20000),
      }
    });

    // Obligation anchored in September (EDT, UTC-4): 2026-09-15T13:00:00.000Z = 09:00 EDT
    // In January (EST, UTC-5): 09:00 EST = 14:00 UTC
    const ob = await db.obligation.create({
      data: {
        userId: userNy.id,
        title: 'NY Electric Bill',
        kind: 'BILL',
        amount: new Decimal('150.00'),
        accountId: account.id,
        dueAt: new Date('2026-09-15T13:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T13:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // 1. Pay January occurrence using UTC key '2026-01-15T14:00'
    const payUtc = await financeService.markObligationPaid(userNy.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-01-15T14:00',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payUtc.success, true);
    assert.equal(payUtc.alreadyCompleted, false);
    assert.ok(payUtc.transactionId);

    // Verify stored occurrence dueDate is exact instant 2026-01-15T14:00:00.000Z
    const occ = await db.obligationOccurrence.findUnique({
      where: { id: payUtc.occurrenceId! }
    });
    assert.ok(occ);
    assert.equal(occ.dueDate.toISOString(), '2026-01-15T14:00:00.000Z');
    assert.equal(occ.occurrenceKey, '2026-01-15T09:00', 'Canonical key is in user timezone 09:00');
    assert.equal(occ.status, 'COMPLETED_HISTORICAL');

    // 2. Pay January occurrence using local key '2026-01-15T09:00'
    // Must recognize as already completed and NOT duplicate expense
    const payLocal = await financeService.markObligationPaid(userNy.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-01-15T09:00',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payLocal.success, true);
    assert.equal(payLocal.alreadyCompleted, true, 'Local key recognized as already completed');
    assert.equal(payLocal.transactionId, payUtc.transactionId, 'Identical transactionId returned');

    // 3. Retry with date-only key '2026-01-15'
    const payDateOnly = await financeService.markObligationPaid(userNy.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-01-15',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payDateOnly.success, true);
    assert.equal(payDateOnly.alreadyCompleted, true, 'Date-only key recognized as already completed');

    // Total expenses in database for this obligation must be exactly 1
    const expenseCount = await db.financialTransaction.count({
      where: { obligationId: ob.id }
    });
    assert.equal(expenseCount, 1, 'Exactly one expense created across UTC and local representations');

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.financialTransaction.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
    await db.financialAccount.delete({ where: { id: account.id } });
    await db.user.delete({ where: { id: userNy.id } });
  });

  await t.test('SOL-R004-010: Historical Undo Preserves Paused State, Schedule, and Future Deliveries', async () => {
    const ob = await db.obligation.create({
      data: {
        userId: userAId,
        title: 'Paused Internet Bill Schedule Isolation',
        kind: 'BILL',
        amount: new Decimal('1200.00'),
        dueAt: new Date('2026-09-15T10:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: false,
      }
    });

    const rem = await db.reminder.create({
      data: {
        userId: userAId,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        title: ob.title,
        obligationId: ob.id,
        isActive: false,
      }
    });

    // Pending reminder delivery for active September occurrence
    const activeDelSept = await db.reminderDelivery.create({
      data: {
        userId: userAId,
        reminderId: rem.id,
        obligationId: ob.id,
        occurrenceKey: '2026-09-15T10:00',
        scheduledFor: new Date('2026-09-15T10:00:00.000Z'),
        offsetMinutes: 0,
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    const obPaused = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(obPaused?.isActive, false, 'Obligation initially paused');

    // 2. Pay historical July occurrence
    const histPay = await financeService.markObligationPaid(userAId, {
      obligationId: ob.id,
      occurrenceKey: '2026-07-15T10:00',
      createExpense: false,
    }, db);
    assert.equal(histPay.success, true);
    assert.equal(histPay.alreadyCompleted, false);

    const histOcc = await db.obligationOccurrence.findUnique({
      where: { id: histPay.occurrenceId! }
    });
    assert.equal(histOcc?.status, 'COMPLETED_HISTORICAL', 'Tagged as COMPLETED_HISTORICAL');

    // 3. Revert / Undo historical July payment
    const histUndo = await financeService.revertObligationPayment(userAId, {
      obligationId: ob.id,
      occurrenceId: histPay.occurrenceId!,
    }, db);
    assert.equal(histUndo.success, true);
    assert.equal(histUndo.alreadyReversed, false);

    // Verify schedule, paused state, and active deliveries are all preserved
    const obAfterUndo = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.equal(obAfterUndo?.nextDueAt.toISOString(), '2026-09-15T10:00:00.000Z', 'nextDueAt remained September 15');
    assert.equal(obAfterUndo?.isActive, false, 'Paused state preserved (isActive remained false)');

    const delAfterUndo = await db.reminderDelivery.findUnique({ where: { id: activeDelSept.id } });
    assert.equal(delAfterUndo?.status, 'PENDING', 'Active September reminder delivery preserved');

    // Clean up
    await db.reminderDelivery.deleteMany({ where: { obligationId: ob.id } });
    await db.reminder.deleteMany({ where: { obligationId: ob.id } });
    await db.obligationOccurrence.deleteMany({ where: { obligationId: ob.id } });
    await db.obligation.delete({ where: { id: ob.id } });
  });

  await t.test('SOL-R004-013: User-Timezone Calendar Month Boundaries in Monthly Summaries', async () => {
    const userKiri = await db.user.create({
      data: {
        id: `usr_sol_month_bounds_${timestamp}`,
        email: `month_bounds_${timestamp}@test.com`,
        name: 'Kiritimati Month User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati', // UTC+14
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userKiri.id,
        name: 'Kiritimati Savings',
        type: 'BANK',
        openingBalance: new Decimal(50000),
      }
    });

    // In Pacific/Kiritimati (+14):
    // 2026-04-30T10:30:00.000Z in UTC is 2026-05-01 00:30 local (inside May)
    const tx1 = await db.financialTransaction.create({
      data: {
        userId: userKiri.id,
        accountId: account.id,
        type: 'EXPENSE',
        amount: new Decimal('1000.00'),
        category: 'Food',
        occurredAt: new Date('2026-04-30T10:30:00.000Z'),
        note: 'May 1st early morning local',
      }
    });

    // 2026-05-31T09:30:00.000Z in UTC is 2026-05-31 23:30 local (inside May)
    const tx2 = await db.financialTransaction.create({
      data: {
        userId: userKiri.id,
        accountId: account.id,
        type: 'EXPENSE',
        amount: new Decimal('2000.00'),
        category: 'Shopping',
        occurredAt: new Date('2026-05-31T09:30:00.000Z'),
        note: 'May 31st late night local',
      }
    });

    // 2026-05-31T10:30:00.000Z in UTC is 2026-06-01 00:30 local (inside June!)
    const tx3 = await db.financialTransaction.create({
      data: {
        userId: userKiri.id,
        accountId: account.id,
        type: 'EXPENSE',
        amount: new Decimal('4000.00'),
        category: 'Utilities',
        occurredAt: new Date('2026-05-31T10:30:00.000Z'),
        note: 'June 1st early morning local',
      }
    });

    // Query May 2026 summary
    const summaryMay = await financeService.getMonthlyFinanceSummary(
      userKiri.id,
      new Date('2026-05-15T12:00:00.000Z'),
      db
    );
    assert.equal(summaryMay.month, '2026-05');
    assert.equal(summaryMay.transactionCount, 2, 'Includes tx1 and tx2, excludes tx3');
    assert.equal(summaryMay.expense, '3000', 'Expense sum is 1000 + 2000 = 3000');

    // Query Money Overview
    const overviewMay = await financeService.getMoneyOverview(
      userKiri.id,
      new Date('2026-05-15T12:00:00.000Z'),
      db
    );
    assert.equal(overviewMay.monthlyExpense, '3000.00', 'MoneyOverview correctly scopes to May user timezone bounds');

    // Clean up
    await db.financialTransaction.deleteMany({ where: { userId: userKiri.id } });
    await db.financialAccount.delete({ where: { id: account.id } });
    await db.user.delete({ where: { id: userKiri.id } });
  });

  await t.test('SOL-R004-012: Isolated db client explicitly passed to all financial and loan service mutations', async () => {
    const userIsolated = await db.user.create({
      data: {
        id: `usr_sol_iso_${timestamp}`,
        email: `iso_${timestamp}@test.com`,
        name: 'Isolated DB User',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userIsolated.id,
        name: 'Isolated Bank',
        type: 'BANK',
        openingBalance: new Decimal(50000),
      }
    });

    // 1. Loan lifecycle passing db explicitly
    const loanRes = await loanService.createLoan(userIsolated.id, {
      name: 'Personal Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: 10000,
      emiAmount: 2000,
      paymentAccountId: account.id,
      nextEmiDate: '2026-11-01T10:00:00.000Z',
      createLinkedObligation: true,
    }, db);
    assert.ok(loanRes.loan.id);

    const emiRes = await loanService.recordEmiPayment(userIsolated.id, {
      loanId: loanRes.loan.id,
      amount: 2000,
      accountId: account.id,
      principalPaid: 1500,
      interestPaid: 500,
      occurredAt: new Date('2026-11-01T10:00:00.000Z'),
    }, db);
    assert.equal(emiRes.success, true);

    const revertEmiRes = await loanService.revertEmiPayment(userIsolated.id, {
      loanPaymentId: emiRes.paymentId,
      revertToDate: new Date('2026-11-01T10:00:00.000Z'),
    }, db);
    assert.equal(revertEmiRes.success, true);

    // 2. Standard Obligation lifecycle passing db explicitly
    const ob = await db.obligation.create({
      data: {
        userId: userIsolated.id,
        title: 'Utility Bill',
        kind: 'BILL',
        amount: new Decimal('500.00'),
        accountId: account.id,
        dueAt: new Date('2026-11-05T10:00:00.000Z'),
        nextDueAt: new Date('2026-11-05T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    const payRes = await financeService.markObligationPaid(userIsolated.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-11-05',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payRes.success, true);
    assert.ok(payRes.transactionId);

    // Generic transaction delete blocked using isolated db
    await assert.rejects(
      async () => financeService.deleteTransaction(userIsolated.id, payRes.transactionId!, db),
      /Linked transaction cannot be deleted directly/
    );

    // Revert obligation payment passing db explicitly
    const revertObRes = await financeService.revertObligationPayment(userIsolated.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-11-05',
    }, db);
    assert.equal(revertObRes.success, true);

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { userId: userIsolated.id } });
    await db.financialTransaction.deleteMany({ where: { userId: userIsolated.id } });
    await db.obligation.deleteMany({ where: { userId: userIsolated.id } });
    await db.loan.deleteMany({ where: { userId: userIsolated.id } });
    await db.financialAccount.delete({ where: { id: account.id } });
    await db.user.delete({ where: { id: userIsolated.id } });
  });

  await t.test('SOL-R001-007: Pacific/Kiritimati Midnight Crossing UTC & Local Historical Aliases (both orders)', async () => {
    const testTime = Date.now();
    const userKiri = await db.user.create({
      data: {
        id: `usr_r5_kiri_${testTime}`,
        email: `r5_kiri_${testTime}@test.com`,
        name: 'Kiritimati R5 User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati', // UTC+14
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userKiri.id,
        name: 'Kiritimati Bank R5',
        type: 'BANK',
        openingBalance: new Decimal(50000),
      }
    });

    // 1. Order A: UTC first ('2026-01-14T10:30'), then local ('2026-01-15T00:30')
    const obA = await db.obligation.create({
      data: {
        userId: userKiri.id,
        title: 'Kiritimati Midnight Bill A',
        kind: 'BILL',
        amount: new Decimal('1200.00'),
        accountId: account.id,
        dueAt: new Date('2026-09-14T10:30:00.000Z'),
        nextDueAt: new Date('2026-09-14T10:30:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    const payUtcFirst = await financeService.markObligationPaid(userKiri.id, {
      obligationId: obA.id,
      occurrenceKey: '2026-01-14T10:30',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payUtcFirst.success, true);
    assert.equal(payUtcFirst.alreadyCompleted, false);
    assert.ok(payUtcFirst.transactionId);

    const occA = await db.obligationOccurrence.findUnique({
      where: { id: payUtcFirst.occurrenceId! }
    });
    assert.ok(occA);
    assert.equal(occA.dueDate.toISOString(), '2026-01-14T10:30:00.000Z');
    assert.equal(occA.occurrenceKey, '2026-01-15T00:30');

    const payLocalSecond = await financeService.markObligationPaid(userKiri.id, {
      obligationId: obA.id,
      occurrenceKey: '2026-01-15T00:30',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payLocalSecond.success, true);
    assert.equal(payLocalSecond.alreadyCompleted, true);
    assert.equal(payLocalSecond.transactionId, payUtcFirst.transactionId);

    const occurrencesA = await db.obligationOccurrence.findMany({ where: { obligationId: obA.id } });
    assert.equal(occurrencesA.length, 1);
    const expensesA = await db.financialTransaction.findMany({ where: { obligationId: obA.id } });
    assert.equal(expensesA.length, 1);

    // 2. Order B (vice-versa): Local first ('2026-01-15T00:30'), then UTC ('2026-01-14T10:30')
    const obB = await db.obligation.create({
      data: {
        userId: userKiri.id,
        title: 'Kiritimati Midnight Bill B',
        kind: 'BILL',
        amount: new Decimal('1500.00'),
        accountId: account.id,
        dueAt: new Date('2026-09-14T10:30:00.000Z'),
        nextDueAt: new Date('2026-09-14T10:30:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    const payLocalFirst = await financeService.markObligationPaid(userKiri.id, {
      obligationId: obB.id,
      occurrenceKey: '2026-01-15T00:30',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payLocalFirst.success, true);
    assert.equal(payLocalFirst.alreadyCompleted, false);
    assert.ok(payLocalFirst.transactionId);

    const occB = await db.obligationOccurrence.findUnique({
      where: { id: payLocalFirst.occurrenceId! }
    });
    assert.ok(occB);
    assert.equal(occB.dueDate.toISOString(), '2026-01-14T10:30:00.000Z');
    assert.equal(occB.occurrenceKey, '2026-01-15T00:30');

    const payUtcSecond = await financeService.markObligationPaid(userKiri.id, {
      obligationId: obB.id,
      occurrenceKey: '2026-01-14T10:30',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payUtcSecond.success, true);
    assert.equal(payUtcSecond.alreadyCompleted, true);
    assert.equal(payUtcSecond.transactionId, payLocalFirst.transactionId);

    const occurrencesB = await db.obligationOccurrence.findMany({ where: { obligationId: obB.id } });
    assert.equal(occurrencesB.length, 1);
    const expensesB = await db.financialTransaction.findMany({ where: { obligationId: obB.id } });
    assert.equal(expensesB.length, 1);

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { userId: userKiri.id } });
    await db.financialTransaction.deleteMany({ where: { userId: userKiri.id } });
    await db.obligation.deleteMany({ where: { userId: userKiri.id } });
    await db.financialAccount.deleteMany({ where: { userId: userKiri.id } });
    await db.user.delete({ where: { id: userKiri.id } });
  });

  await t.test('SOL-R001-007: America/New_York Midnight Crossing DST Anchor Deduplication', async () => {
    const testTime = Date.now();
    const userNy = await db.user.create({
      data: {
        id: `usr_r5_ny_${testTime}`,
        email: `r5_ny_${testTime}@test.com`,
        name: 'New York R5 User',
        password: 'password123',
        timezone: 'America/New_York',
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userNy.id,
        name: 'NY Checking R5',
        type: 'BANK',
        openingBalance: new Decimal(50000),
      }
    });

    // Obligation anchored in September (EDT, UTC-4): 2026-09-16T03:30:00.000Z = Sep 15 23:30 EDT
    // In January (EST, UTC-5): 23:30 EST = Jan 16 04:30 UTC
    const ob = await db.obligation.create({
      data: {
        userId: userNy.id,
        title: 'NY Night Utility Bill',
        kind: 'BILL',
        amount: new Decimal('300.00'),
        accountId: account.id,
        dueAt: new Date('2026-09-16T03:30:00.000Z'),
        nextDueAt: new Date('2026-09-16T03:30:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // 1. Pay with UTC key '2026-01-16T04:30'
    const payUtc = await financeService.markObligationPaid(userNy.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-01-16T04:30',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payUtc.success, true);
    assert.equal(payUtc.alreadyCompleted, false);
    assert.ok(payUtc.transactionId);

    const occ = await db.obligationOccurrence.findUnique({
      where: { id: payUtc.occurrenceId! }
    });
    assert.ok(occ);
    assert.equal(occ.dueDate.toISOString(), '2026-01-16T04:30:00.000Z');
    assert.equal(occ.occurrenceKey, '2026-01-15T23:30');

    // 2. Pay with local key '2026-01-15T23:30'
    const payLocal = await financeService.markObligationPaid(userNy.id, {
      obligationId: ob.id,
      occurrenceKey: '2026-01-15T23:30',
      createExpense: true,
      accountId: account.id,
    }, db);
    assert.equal(payLocal.success, true);
    assert.equal(payLocal.alreadyCompleted, true);
    assert.equal(payLocal.transactionId, payUtc.transactionId);

    const occurrences = await db.obligationOccurrence.findMany({ where: { obligationId: ob.id } });
    assert.equal(occurrences.length, 1);
    assert.equal(occurrences[0].dueDate.toISOString(), '2026-01-16T04:30:00.000Z');
    const expenses = await db.financialTransaction.findMany({ where: { obligationId: ob.id } });
    assert.equal(expenses.length, 1);

    // Clean up
    await db.obligationOccurrence.deleteMany({ where: { userId: userNy.id } });
    await db.financialTransaction.deleteMany({ where: { userId: userNy.id } });
    await db.obligation.deleteMany({ where: { userId: userNy.id } });
    await db.financialAccount.deleteMany({ where: { userId: userNy.id } });
    await db.user.delete({ where: { id: userNy.id } });
  });

  await t.test('SOL-R004-010: Legacy Historical Completion Schedule & Reminder Isolation on Undo', async () => {
    const testTime = Date.now();
    const userUtc = await db.user.create({
      data: {
        id: `usr_r5_legacy_${testTime}`,
        email: `r5_legacy_${testTime}@test.com`,
        name: 'Legacy Historical Undo User',
        password: 'password123',
        timezone: 'UTC',
      }
    });

    const account = await db.financialAccount.create({
      data: {
        userId: userUtc.id,
        name: 'UTC Main Bank',
        type: 'BANK',
        openingBalance: new Decimal(25000),
      }
    });

    // Monthly UTC obligation next due 2026-09-15T10:00Z
    const ob = await db.obligation.create({
      data: {
        userId: userUtc.id,
        title: 'Monthly Cloud Subscription',
        kind: 'SUBSCRIPTION',
        amount: new Decimal('250.00'),
        accountId: account.id,
        dueAt: new Date('2026-09-15T10:00:00.000Z'),
        nextDueAt: new Date('2026-09-15T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Seed legacy COMPLETED occurrence for 2026-07-15T10:00Z (status 'COMPLETED', not 'COMPLETED_HISTORICAL')
    const legacyJulyOcc = await db.obligationOccurrence.create({
      data: {
        userId: userUtc.id,
        obligationId: ob.id,
        occurrenceKey: '2026-07-15T10:00',
        dueDate: new Date('2026-07-15T10:00:00.000Z'),
        status: 'COMPLETED',
        paidAt: new Date('2026-07-15T10:02:00.000Z'),
      }
    });

    // Seed reminder and PENDING reminder delivery for September
    const rem = await db.reminder.create({
      data: {
        userId: userUtc.id,
        domain: 'FINANCE',
        type: 'OBLIGATION',
        title: ob.title,
        obligationId: ob.id,
        isActive: true,
      }
    });

    const septDelivery = await db.reminderDelivery.create({
      data: {
        userId: userUtc.id,
        reminderId: rem.id,
        obligationId: ob.id,
        occurrenceKey: '2026-09-15T10:00',
        scheduledFor: new Date('2026-09-15T10:00:00.000Z'),
        offsetMinutes: 0,
        channel: 'IN_APP',
        status: 'PENDING',
      }
    });

    // Call revertObligationPayment on July occurrence
    const revertRes = await financeService.revertObligationPayment(userUtc.id, {
      obligationId: ob.id,
      occurrenceId: legacyJulyOcc.id,
    }, db);
    assert.equal(revertRes.success, true);
    assert.equal(revertRes.alreadyReversed, false);

    // Assert: obligation nextDueAt remains September 15, isActive is preserved
    const obAfter = await db.obligation.findUnique({ where: { id: ob.id } });
    assert.ok(obAfter);
    assert.equal(obAfter.nextDueAt.toISOString(), '2026-09-15T10:00:00.000Z', 'nextDueAt remains September 15');
    assert.equal(obAfter.isActive, true, 'isActive remains true');

    // Assert: September PENDING delivery is NOT deleted
    const foundSeptDelivery = await db.reminderDelivery.findUnique({ where: { id: septDelivery.id } });
    assert.ok(foundSeptDelivery, 'September reminder delivery must NOT be deleted');

    // Assert: only July occurrence is deleted
    const foundJulyOcc = await db.obligationOccurrence.findUnique({ where: { id: legacyJulyOcc.id } });
    assert.equal(foundJulyOcc, null, 'July occurrence was cleanly deleted');

    // Clean up
    await db.reminderDelivery.deleteMany({ where: { userId: userUtc.id } });
    await db.reminder.deleteMany({ where: { userId: userUtc.id } });
    await db.obligationOccurrence.deleteMany({ where: { userId: userUtc.id } });
    await db.obligation.deleteMany({ where: { userId: userUtc.id } });
    await db.financialAccount.deleteMany({ where: { userId: userUtc.id } });
    await db.user.delete({ where: { id: userUtc.id } });
  });
});
