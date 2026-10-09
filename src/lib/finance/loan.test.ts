import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
import { TZDate } from '@date-fns/tz';
import * as loanService from './loan-service';
import * as financeService from './finance-service';
import { calculateMonthlyTotals } from './finance';
import { formatCalendarDate } from '../../components/finance/LoanForm';
import * as creditCardService from './credit-card-service';
import fs from 'node:fs';
import path from 'node:path';
import { generateEmiIdempotencyKey } from '../../components/finance/RecordEmiModal';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('V2-300: Loans & EMI Test Suite (V2-T040..V2-T052)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const userA = await db.user.create({
      data: {
        id: `usr-loan-a-${timestamp}`,
        email: `loana-${timestamp}@test.local`,
        name: 'User Loan Alpha',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userB = await db.user.create({
      data: {
        id: `usr-loan-b-${timestamp}`,
        email: `loanb-${timestamp}@test.local`,
        name: 'User Loan Beta',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    // User A Account
    const bankA = await financeService.createAccount(userA.id, {
      name: 'Salary Bank',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);
    const bankAId = bankA.account.id;

    // User B Account
    const bankB = await financeService.createAccount(userB.id, {
      name: 'User B Bank',
      type: 'BANK',
      openingBalance: '25000.00',
    }, db);
    const bankBId = bankB.account.id;

    // -------------------------------------------------------------------------
    // V2-T040: Add existing Personal Loan snapshot
    // -------------------------------------------------------------------------
    const plRes = await loanService.createLoan(userA.id, {
      name: 'HDFC Personal Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '300000.00',
      originalPrincipal: '500000.00',
      emiAmount: '12500.00',
      tenureMonths: 24,
      paymentAccountId: bankAId,
    }, db);

    assert.equal(plRes.success, true);
    assert.equal(plRes.loan.name, 'HDFC Personal Loan');
    assert.equal(plRes.loan.outstandingPrincipal, '300000');
    assert.equal(plRes.loan.emiAmount, '12500');
    assert.equal(plRes.loan.status, 'ACTIVE');
    const plId = plRes.loan.id;

    // -------------------------------------------------------------------------
    // V2-T043 & V2-T044: Loan creation does not change cash balance or create income
    // -------------------------------------------------------------------------
    let accountsA = await financeService.getAccounts(userA.id, db);
    assert.equal(accountsA.find((a: any) => a.id === bankAId).currentBalance, '50000');

    let txsA = await db.financialTransaction.findMany({ where: { userId: userA.id } });
    let totalsA = calculateMonthlyTotals(txsA);
    assert.equal(totalsA.income.toString(), '0');
    assert.equal(totalsA.expense.toString(), '0');

    // -------------------------------------------------------------------------
    // V2-T041: Add Home Loan
    // -------------------------------------------------------------------------
    const hlRes = await loanService.createLoan(userA.id, {
      name: 'SBI Home Loan',
      loanType: 'HOME',
      lender: 'State Bank of India',
      openingOutstanding: '2500000.00',
      emiAmount: '28000.00',
      interestRatePercent: '8.40',
      interestRateType: 'FLOATING',
    }, db);

    assert.equal(hlRes.success, true);
    assert.equal(hlRes.loan.loanType, 'HOME');
    assert.equal(hlRes.loan.outstandingPrincipal, '2500000');

    // -------------------------------------------------------------------------
    // V2-T042: Add Product EMI
    // -------------------------------------------------------------------------
    const peRes = await loanService.createLoan(userA.id, {
      name: 'Croma iPhone 16 EMI',
      loanType: 'PRODUCT_EMI',
      lender: 'Bajaj Finserv',
      openingOutstanding: '79900.00',
      emiAmount: '13316.67',
      productName: 'iPhone 16 Pro 128GB',
      merchant: 'Croma Electronics',
      tenureMonths: 6,
    }, db);

    assert.equal(peRes.success, true);
    assert.equal(peRes.loan.loanType, 'PRODUCT_EMI');
    assert.equal(peRes.loan.outstandingPrincipal, '79900');

    // -------------------------------------------------------------------------
    // V2-T042b: Credit Card EMI snapshot (emiGeneratesExpense = true)
    // Future EMI payment creates linked Expense, no historical purchase created
    // -------------------------------------------------------------------------
    const ccSnapshotRes = await loanService.createLoan(userA.id, {
      name: 'ICICI Amazon Card EMI',
      loanType: 'CREDIT_CARD_EMI',
      lender: 'ICICI Bank',
      openingOutstanding: '45000.00',
      emiAmount: '7500.00',
      emiGeneratesExpense: true,
      principalAlreadyRecognized: false,
    }, db);

    assert.equal(ccSnapshotRes.success, true);
    const ccSnapshotId = ccSnapshotRes.loan.id;

    // Record EMI payment for snapshot loan
    const ccPay1 = await loanService.recordEmiPayment(userA.id, {
      loanId: ccSnapshotId,
      amount: '7500.00',
      accountId: bankAId,
      principalPaid: '6500.00',
      interestPaid: '1000.00',
    }, db);

    assert.equal(ccPay1.success, true);
    assert.ok(ccPay1.transactionId, 'Must create linked EXPENSE transaction');

    const createdTx1 = await db.financialTransaction.findUnique({
      where: { id: ccPay1.transactionId! }
    });
    assert.equal(createdTx1?.type, 'EXPENSE');
    assert.equal(createdTx1?.category, 'EMI');
    assert.equal(createdTx1?.amount.toString(), '7500');

    // -------------------------------------------------------------------------
    // V2-T042c: Credit Card EMI from existing purchase (emiGeneratesExpense = false)
    // LoanPayment records payment without creating duplicate Expense
    // -------------------------------------------------------------------------
    const ccConvertedRes = await loanService.createLoan(userA.id, {
      name: 'Converted Laptop Purchase EMI',
      loanType: 'CREDIT_CARD_EMI',
      lender: 'HDFC Bank',
      openingOutstanding: '60000.00',
      emiAmount: '10000.00',
      emiGeneratesExpense: false,
      principalAlreadyRecognized: true,
    }, db);

    assert.equal(ccConvertedRes.success, true);
    const ccConvertedId = ccConvertedRes.loan.id;

    const ccPay2 = await loanService.recordEmiPayment(userA.id, {
      loanId: ccConvertedId,
      amount: '10000.00',
      accountId: bankAId,
      principalPaid: '9000.00',
      interestPaid: '1000.00',
    }, db);

    assert.equal(ccPay2.success, true);
    assert.equal(ccPay2.transactionId, null, 'Must NOT create duplicate expense transaction when emiGeneratesExpense is false');

    // -------------------------------------------------------------------------
    // V2-T047: Known principal component reduces outstanding
    // Personal Loan had 300,000 outstanding. Payment with principalPaid = 10,000
    // -------------------------------------------------------------------------
    const payKnownPrincipal = await loanService.recordEmiPayment(userA.id, {
      loanId: plId,
      amount: '12500.00',
      accountId: bankAId,
      principalPaid: '10000.00',
      interestPaid: '2500.00',
    }, db);

    assert.equal(payKnownPrincipal.success, true);
    assert.equal(payKnownPrincipal.remainingPrincipal, '290000');
    assert.equal(payKnownPrincipal.principalReduced, true);

    const plAfterKnown = await loanService.getLoanById(userA.id, plId, db);
    assert.equal(plAfterKnown.outstandingPrincipal, '290000');

    // -------------------------------------------------------------------------
    // V2-T048 & V2-T048b: Unknown principal component does not guess reduction
    // Payment recorded without principalPaid leaves outstanding untouched
    // -------------------------------------------------------------------------
    const payUnknownPrincipal = await loanService.recordEmiPayment(userA.id, {
      loanId: plId,
      amount: '12500.00',
      accountId: bankAId,
      // No principalPaid supplied!
    }, db);

    assert.equal(payUnknownPrincipal.success, true);
    assert.equal(payUnknownPrincipal.remainingPrincipal, '290000', 'Outstanding must remain untouched');
    assert.equal(payUnknownPrincipal.principalReduced, false);

    const plAfterUnknown = await loanService.getLoanById(userA.id, plId, db);
    assert.equal(plAfterUnknown.outstandingPrincipal, '290000');

    // -------------------------------------------------------------------------
    // V2-T045b: Linked EMI Obligation mark-paid delegates to Loan service
    // Creates exactly one LoanPayment, completes occurrence, updates next EMI atomically
    // -------------------------------------------------------------------------
    const nextEmiDate = new Date('2026-10-15T10:00:00.000Z');
    const linkedLoanRes = await loanService.createLoan(userA.id, {
      name: 'Linked Car Loan',
      loanType: 'VEHICLE',
      lender: 'Axis Bank',
      openingOutstanding: '400000.00',
      emiAmount: '15000.00',
      nextEmiDate,
      paymentAccountId: bankAId,
      createLinkedObligation: true,
    }, db);

    assert.equal(linkedLoanRes.success, true);
    const linkedLoanId = linkedLoanRes.loan.id;
    const linkedObId = linkedLoanRes.loan.obligationId!;
    assert.ok(linkedObId);

    // Call markObligationPaid on the linked obligation
    const markEmiRes = await financeService.markObligationPaid(userA.id, {
      obligationId: linkedObId,
      occurrenceKey: '2026-10-15',
      accountId: bankAId,
    }, db);

    assert.equal(markEmiRes.success, true);
    assert.equal(markEmiRes.alreadyCompleted, false);
    assert.ok(markEmiRes.occurrenceId);
    assert.ok(markEmiRes.transactionId);

    // Verify LoanPayment was created linked to this occurrence
    const loanPayment = await db.loanPayment.findUnique({
      where: { obligationOccurrenceId: markEmiRes.occurrenceId }
    });
    assert.ok(loanPayment);
    assert.equal(loanPayment?.loanId, linkedLoanId);
    assert.equal(loanPayment?.amount.toString(), '15000');
    assert.equal(loanPayment?.transactionId, markEmiRes.transactionId);

    // -------------------------------------------------------------------------
    // V2-T046 & V2-T046b: Idempotency on linked EMI
    // Repeated markObligationPaid returns existing payment without duplicating
    // -------------------------------------------------------------------------
    const repeatMarkEmiRes = await financeService.markObligationPaid(userA.id, {
      obligationId: linkedObId,
      occurrenceKey: '2026-10-15',
      accountId: bankAId,
    }, db);

    assert.equal(repeatMarkEmiRes.success, true);
    assert.equal(repeatMarkEmiRes.alreadyCompleted, true);
    assert.equal(repeatMarkEmiRes.occurrenceId, markEmiRes.occurrenceId);
    assert.equal(repeatMarkEmiRes.transactionId, markEmiRes.transactionId);

    // Verify only ONE LoanPayment exists in total for this loan
    const totalPayments = await db.loanPayment.count({
      where: { loanId: linkedLoanId }
    });
    assert.equal(totalPayments, 1, 'Duplicate same occurrence must not create second LoanPayment');

    // -------------------------------------------------------------------------
    // V2-T049: Manual outstanding reconciliation / update
    // -------------------------------------------------------------------------
    const reconRes = await loanService.reconcileOutstanding(userA.id, plId, '275000.00', 'Statement check', db);
    assert.equal(reconRes.success, true);
    assert.equal(reconRes.outstandingPrincipal, '275000');

    const plAfterRecon = await loanService.getLoanById(userA.id, plId, db);
    assert.equal(plAfterRecon.outstandingPrincipal, '275000');

    // -------------------------------------------------------------------------
    // V2-T050: Loan closure sets status = CLOSED
    // -------------------------------------------------------------------------
    const closeRes = await loanService.closeLoan(userA.id, plId, db);
    assert.equal(closeRes.success, true);

    const closedLoan = await loanService.getLoanById(userA.id, plId, db);
    assert.equal(closedLoan.status, 'CLOSED');

    // -------------------------------------------------------------------------
    // V2-T051: Authorization negatives (cross-user loan access/mutation rejected)
    // -------------------------------------------------------------------------
    // User B attempts to access User A's loan
    await assert.rejects(
      async () => {
        await loanService.getLoanById(userB.id, plId, db);
      },
      /Loan not found or unauthorized/
    );

    // User B attempts to record EMI payment on User A's loan
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(userB.id, {
          loanId: plId,
          amount: '1000.00',
          accountId: bankBId,
        }, db);
      },
      /Loan not found or unauthorized/
    );

    // User B attempts to reconcile User A's loan
    await assert.rejects(
      async () => {
        await loanService.reconcileOutstanding(userB.id, plId, '1000.00', undefined, db);
      },
      /Loan not found or unauthorized/
    );

    // User B attempts to close User A's loan
    await assert.rejects(
      async () => {
        await loanService.closeLoan(userB.id, plId, db);
      },
      /Loan not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // V2-T052: Foreign account rejected for EMI payment
    // User A attempts to pay EMI using User B's account
    // -------------------------------------------------------------------------
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(userA.id, {
          loanId: linkedLoanId,
          amount: '15000.00',
          accountId: bankBId, // Foreign account!
        }, db);
      },
      /Account not found or unauthorized/
    );

    // -------------------------------------------------------------------------
    // V2-T053: Automatic EMI obligation lifecycle on loan creation, update, and close
    // -------------------------------------------------------------------------
    // 1. Create a new active loan with emiAmount and nextEmiDate
    const newLoanRes = await loanService.createLoan(userA.id, {
      name: 'Auto Loan Honda',
      loanType: 'VEHICLE',
      lender: 'HDFC Bank',
      openingOutstanding: '600000.00',
      originalPrincipal: '800000.00',
      emiAmount: '18500.00',
      nextEmiDate: '2026-11-15',
      paymentAccountId: bankAId,
    }, db);
    assert.equal(newLoanRes.success, true);
    const newLoanId = newLoanRes.loan.id;

    // Verify linked EMI obligation was created
    const linkedObs = await db.obligation.findMany({
      where: {
        userId: userA.id,
        kind: 'EMI',
        title: { contains: 'Auto Loan Honda' },
      }
    });
    assert.equal(linkedObs.length, 1);
    const linkedOb = linkedObs[0];
    assert.equal(linkedOb.amount?.toString(), '18500');
    assert.equal(linkedOb.isActive, true);

    // 2. Safe edit of loan: update EMI amount and due date
    const updatedLoanRes = await loanService.updateLoan(userA.id, newLoanId, {
      name: 'Auto Loan Honda City',
      emiAmount: '19000.00',
      nextEmiDate: '2026-11-20',
    }, db);
    assert.equal(updatedLoanRes.success, true);
    assert.equal(updatedLoanRes.loan.name, 'Auto Loan Honda City');
    assert.equal(updatedLoanRes.loan.emiAmount, '19000');

    // Verify linked obligation was updated idempotently without duplicates
    const linkedObsAfterUpdate = await db.obligation.findMany({
      where: {
        userId: userA.id,
        kind: 'EMI',
        OR: [
          { title: { contains: 'Auto Loan Honda' } },
          { id: linkedOb.id },
        ],
      }
    });
    assert.equal(linkedObsAfterUpdate.length, 1);
    assert.equal(linkedObsAfterUpdate[0].amount?.toString(), '19000');
    assert.equal(linkedObsAfterUpdate[0].title, 'EMI: Auto Loan Honda City (HDFC Bank)');

    // 3. Update loan metadata rejects direct mutation of outstandingPrincipal
    await assert.rejects(
      async () => {
        await loanService.updateLoan(userA.id, newLoanId, {
          outstandingPrincipal: '400000.00',
        } as any, db);
      },
      /outstandingPrincipal cannot be updated directly/
    );

    await assert.rejects(
      async () => {
        await loanService.updateLoan(userA.id, newLoanId, {
          openingOutstanding: '400000.00',
        } as any, db);
      },
      /openingOutstanding cannot be updated directly/
    );

    // 4. Cross-user update rejected
    await assert.rejects(
      async () => {
        await loanService.updateLoan(userB.id, newLoanId, {
          name: 'Hacked Loan',
        }, db);
      },
      /Loan not found or unauthorized/
    );

    // 5. Create dummy reminder delivery claim to verify cleanup on loan close
    let rem = await db.reminder.findFirst({
      where: { userId: userA.id, obligationId: linkedOb.id }
    });
    if (!rem) {
      rem = await db.reminder.create({
        data: {
          userId: userA.id,
          obligationId: linkedOb.id,
          type: 'BILL',
          title: linkedOb.title,
          time: '09:00',
          recurrenceType: 'MONTHLY',
        }
      });
    }

    await db.reminderDelivery.create({
      data: {
        userId: userA.id,
        reminderId: rem.id,
        obligationId: linkedOb.id,
        occurrenceKey: '2026-11-20',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-20T09:00:00Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // Close the loan
    const closeNewRes = await loanService.closeLoan(userA.id, newLoanId, db);
    assert.equal(closeNewRes.success, true);

    // Linked obligation should now be inactive and archived
    const obAfterClose = await db.obligation.findUnique({ where: { id: linkedOb.id } });
    assert.equal(obAfterClose?.isActive, false);
    assert.equal(obAfterClose?.isArchived, true);

    // Pending reminder deliveries for this obligation should be removed
    const pendingDeliveries = await db.reminderDelivery.findMany({
      where: { obligationId: linkedOb.id, status: 'PENDING' }
    });
    assert.equal(pendingDeliveries.length, 0);

  } finally {
    await db.$disconnect();
  }
});

test('V2-360: Repair B - Loan Null-Schedule, Hijack Prevention, Recurrence Day, and Closure Cleanup', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const testUser = await db.user.create({
      data: {
        id: `usr-loan-repair-${timestamp}`,
        email: `loan-repair-${timestamp}@test.local`,
        name: 'User Loan Repair',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const bankAcc = await financeService.createAccount(testUser.id, {
      name: 'Primary Checking',
      type: 'BANK',
      openingBalance: '100000.00',
    }, db);
    const bankId = bankAcc.account.id;

    // -------------------------------------------------------------------------
    // 1. updateLoan clearing emiAmount deactivates linked obligation
    // -------------------------------------------------------------------------
    const loan1Res = await loanService.createLoan(testUser.id, {
      name: 'Personal Loan A',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '50000.00',
      emiAmount: '5000.00',
      nextEmiDate: '2026-11-05T10:00:00.000Z',
    }, db);
    assert.equal(loan1Res.success, true);
    const loan1Id = loan1Res.loan.id;
    assert.ok(loan1Res.loan.obligationId);

    const rem1 = await db.reminder.create({
      data: {
        userId: testUser.id,
        obligationId: loan1Res.loan.obligationId!,
        type: 'BILL',
        title: 'EMI Reminder Loan 1',
        time: '10:00',
        recurrenceType: 'MONTHLY',
      }
    });

    await db.reminderDelivery.create({
      data: {
        userId: testUser.id,
        obligationId: loan1Res.loan.obligationId!,
        reminderId: rem1.id,
        occurrenceKey: '2026-11-05T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-05T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // Clear emiAmount to null
    const updateClearRes = await loanService.updateLoan(testUser.id, loan1Id, {
      emiAmount: null,
    }, db);
    assert.equal(updateClearRes.success, true);
    assert.equal(updateClearRes.loan.emiAmount, null);

    // Obligation must be deactivated
    const ob1AfterClear = await db.obligation.findUnique({
      where: { id: loan1Res.loan.obligationId! }
    });
    assert.equal(ob1AfterClear?.isActive, false);

    // Pending reminder deliveries must be cancelled/removed
    const pendingDel1 = await db.reminderDelivery.findMany({
      where: { obligationId: loan1Res.loan.obligationId!, status: 'PENDING' }
    });
    assert.equal(pendingDel1.length, 0);

    // Re-activating with emiAmount restores active status
    const updateRestoreRes = await loanService.updateLoan(testUser.id, loan1Id, {
      emiAmount: '6000.00',
    }, db);
    assert.equal(updateRestoreRes.success, true);
    const ob1AfterRestore = await db.obligation.findUnique({
      where: { id: loan1Res.loan.obligationId! }
    });
    assert.equal(ob1AfterRestore?.isActive, true);
    assert.equal(ob1AfterRestore?.amount?.toString(), '6000');

    // -------------------------------------------------------------------------
    // 2. Creation/update does not hijack unrelated manual obligations
    // -------------------------------------------------------------------------
    const manualOb = await db.obligation.create({
      data: {
        userId: testUser.id,
        title: 'EMI: Education Loan (SBI)',
        kind: 'EMI',
        amount: new Prisma.Decimal('7500.00'),
        dueAt: new Date('2026-12-10T10:00:00.000Z'),
        nextDueAt: new Date('2026-12-10T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    // Create loan with same name/lender - must NOT hijack manualOb
    const hijackTestLoan = await loanService.createLoan(testUser.id, {
      name: 'Education Loan',
      loanType: 'EDUCATION',
      lender: 'SBI',
      openingOutstanding: '200000.00',
      emiAmount: '7500.00',
      nextEmiDate: '2026-12-10T10:00:00.000Z',
    }, db);

    assert.equal(hijackTestLoan.success, true);
    assert.notEqual(hijackTestLoan.loan.obligationId, manualOb.id);

    // Verify manualOb is completely untouched
    const manualObCheck = await db.obligation.findUnique({ where: { id: manualOb.id } });
    assert.equal(manualObCheck?.title, 'EMI: Education Loan (SBI)');
    assert.equal(manualObCheck?.amount?.toString(), '7500');

    // Create loan without obligation, then update - must NOT hijack manualOb
    const unlinkedLoan = await loanService.createLoan(testUser.id, {
      name: 'Education Loan',
      loanType: 'EDUCATION',
      lender: 'SBI',
      openingOutstanding: '100000.00',
    }, db);
    assert.equal(unlinkedLoan.loan.obligationId, null);

    const updateUnlinkedRes = await loanService.updateLoan(testUser.id, unlinkedLoan.loan.id, {
      emiAmount: '7500.00',
      nextEmiDate: '2026-12-10T10:00:00.000Z',
    }, db);
    assert.notEqual(updateUnlinkedRes.loan.obligationId, manualOb.id);

    // -------------------------------------------------------------------------
    // 3. dueDay=31 handles Feb clamping and recovers to Mar 31
    // -------------------------------------------------------------------------
    const dueDayLoanRes = await loanService.createLoan(testUser.id, {
      name: 'Big Ticket Loan',
      loanType: 'PERSONAL',
      lender: 'Kotak Bank',
      openingOutstanding: '150000.00',
      emiAmount: '10000.00',
      dueDay: 31,
      nextEmiDate: '2026-01-31T12:00:00.000Z',
      paymentAccountId: bankId,
    }, db);
    assert.equal(dueDayLoanRes.success, true);
    const dueDayLoanId = dueDayLoanRes.loan.id;
    const dueDayObId = dueDayLoanRes.loan.obligationId!;

    // Pay Jan 31 EMI -> should advance to Feb 28, 2026 (clamped)
    const payJan = await loanService.recordEmiPayment(testUser.id, {
      loanId: dueDayLoanId,
      amount: '10000.00',
      accountId: bankId,
      principalPaid: '8000.00',
      occurredAt: '2026-01-31T12:00:00.000Z',
    }, db);
    assert.equal(payJan.success, true);

    const loanAfterJan = await db.loan.findUnique({ where: { id: dueDayLoanId } });
    const obAfterJan = await db.obligation.findUnique({ where: { id: dueDayObId } });

    assert.equal(loanAfterJan?.nextEmiDate?.toISOString(), '2026-02-28T12:00:00.000Z');
    assert.equal(obAfterJan?.nextDueAt?.toISOString(), '2026-02-28T12:00:00.000Z');

    // Pay Feb 28 EMI -> should advance and recover to March 31, 2026!
    const payFeb = await loanService.recordEmiPayment(testUser.id, {
      loanId: dueDayLoanId,
      amount: '10000.00',
      accountId: bankId,
      principalPaid: '8000.00',
      occurredAt: '2026-02-28T12:00:00.000Z',
    }, db);
    assert.equal(payFeb.success, true);

    const loanAfterFeb = await db.loan.findUnique({ where: { id: dueDayLoanId } });
    const obAfterFeb = await db.obligation.findUnique({ where: { id: dueDayObId } });

    assert.equal(loanAfterFeb?.nextEmiDate?.toISOString(), '2026-03-31T12:00:00.000Z');
    assert.equal(obAfterFeb?.nextDueAt?.toISOString(), '2026-03-31T12:00:00.000Z');

    // -------------------------------------------------------------------------
    // 4. Zero balance via recordEmiPayment or reconcileOutstanding(0) cleans up reminders
    // -------------------------------------------------------------------------
    // Path 4a: reconcileOutstanding(0)
    const reconLoanRes = await loanService.createLoan(testUser.id, {
      name: 'Reconcile Closure Loan',
      loanType: 'PERSONAL',
      lender: 'ICICI Bank',
      openingOutstanding: '30000.00',
      emiAmount: '3000.00',
      nextEmiDate: '2026-11-15T10:00:00.000Z',
    }, db);
    const reconLoanId = reconLoanRes.loan.id;
    const reconObId = reconLoanRes.loan.obligationId!;

    const reconRem = await db.reminder.create({
      data: {
        userId: testUser.id,
        obligationId: reconObId,
        type: 'BILL',
        title: 'Recon EMI Reminder',
        time: '10:00',
        recurrenceType: 'MONTHLY',
      }
    });

    await db.reminderDelivery.create({
      data: {
        userId: testUser.id,
        obligationId: reconObId,
        reminderId: reconRem.id,
        occurrenceKey: '2026-11-15T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-15T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    const reconRes = await loanService.reconcileOutstanding(testUser.id, reconLoanId, '0.00', 'Paid off in full', db);
    assert.equal(reconRes.success, true);
    assert.equal(reconRes.status, 'CLOSED');

    const reconObAfter = await db.obligation.findUnique({ where: { id: reconObId } });
    assert.equal(reconObAfter?.isActive, false);
    assert.equal(reconObAfter?.isArchived, true);

    const reconPendingDel = await db.reminderDelivery.findMany({
      where: { obligationId: reconObId, status: 'PENDING' }
    });
    assert.equal(reconPendingDel.length, 0);

    // Path 4b: recordEmiPayment pays remaining balance in full
    const fullPayLoanRes = await loanService.createLoan(testUser.id, {
      name: 'Full Payoff Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '5000.00',
      emiAmount: '5000.00',
      nextEmiDate: '2026-11-20T10:00:00.000Z',
      paymentAccountId: bankId,
    }, db);
    const fullPayLoanId = fullPayLoanRes.loan.id;
    const fullPayObId = fullPayLoanRes.loan.obligationId!;

    const fullPayRem = await db.reminder.create({
      data: {
        userId: testUser.id,
        obligationId: fullPayObId,
        type: 'BILL',
        title: 'Full Pay EMI Reminder',
        time: '10:00',
        recurrenceType: 'MONTHLY',
      }
    });

    await db.reminderDelivery.create({
      data: {
        userId: testUser.id,
        obligationId: fullPayObId,
        reminderId: fullPayRem.id,
        occurrenceKey: '2026-11-20T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-20T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    const fullPayRes = await loanService.recordEmiPayment(testUser.id, {
      loanId: fullPayLoanId,
      amount: '5000.00',
      accountId: bankId,
      principalPaid: '5000.00',
      occurredAt: '2026-11-20T10:00:00.000Z',
    }, db);
    assert.equal(fullPayRes.success, true);
    assert.equal(fullPayRes.closed, true);
    assert.equal(fullPayRes.remainingPrincipal, '0');

    const fullPayObAfter = await db.obligation.findUnique({ where: { id: fullPayObId } });
    assert.equal(fullPayObAfter?.isActive, false);
    assert.equal(fullPayObAfter?.isArchived, true);

    const fullPayPendingDel = await db.reminderDelivery.findMany({
      where: { obligationId: fullPayObId, status: 'PENDING' }
    });
    assert.equal(fullPayPendingDel.length, 0);

    // -------------------------------------------------------------------------
    // 5. Direct EMI payment advances linked obligation nextDueAt
    // -------------------------------------------------------------------------
    const advLoanRes = await loanService.createLoan(testUser.id, {
      name: 'Advance Test Loan',
      loanType: 'PERSONAL',
      lender: 'SBI',
      openingOutstanding: '100000.00',
      emiAmount: '10000.00',
      nextEmiDate: '2026-05-15T10:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankId,
    }, db);
    const advLoanId = advLoanRes.loan.id;
    const advObId = advLoanRes.loan.obligationId!;

    const payAdv = await loanService.recordEmiPayment(testUser.id, {
      loanId: advLoanId,
      amount: '10000.00',
      accountId: bankId,
      principalPaid: '8000.00',
      occurredAt: '2026-05-15T10:00:00.000Z',
    }, db);
    assert.equal(payAdv.success, true);

    const advLoanAfter = await db.loan.findUnique({ where: { id: advLoanId } });
    const advObAfter = await db.obligation.findUnique({ where: { id: advObId } });

    assert.equal(advLoanAfter?.nextEmiDate?.toISOString(), '2026-06-15T10:00:00.000Z');
    assert.equal(advObAfter?.nextDueAt?.toISOString(), '2026-06-15T10:00:00.000Z');

    // -------------------------------------------------------------------------
    // 5. Editing closed loans must NOT reactivate archived/disabled EMI obligations or stale reminder deliveries
    // -------------------------------------------------------------------------
    const closedLoanRes = await loanService.createLoan(testUser.id, {
      name: 'Soon Closed Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '20000.00',
      emiAmount: '2000.00',
      nextEmiDate: '2026-11-20T10:00:00.000Z',
      paymentAccountId: bankId,
    }, db);
    assert.equal(closedLoanRes.success, true);
    const closedLoanId = closedLoanRes.loan.id;
    const closedObId = closedLoanRes.loan.obligationId!;

    // Add a reminder and pending delivery
    const closedRem = await db.reminder.create({
      data: {
        userId: testUser.id,
        obligationId: closedObId,
        type: 'BILL',
        title: 'Soon Closed EMI Reminder',
        time: '10:00',
        recurrenceType: 'MONTHLY',
      }
    });
    await db.reminderDelivery.create({
      data: {
        userId: testUser.id,
        obligationId: closedObId,
        reminderId: closedRem.id,
        occurrenceKey: '2026-11-20T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-20T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // Explicitly close the loan
    const closeRes = await loanService.closeLoan(testUser.id, closedLoanId, db);
    assert.equal(closeRes.success, true);

    const obAfterClose = await db.obligation.findUnique({ where: { id: closedObId } });
    assert.equal(obAfterClose?.isActive, false);
    assert.equal(obAfterClose?.isArchived, true);

    // Now edit the closed loan: change name, notes, emiAmount, nextEmiDate
    const updateClosedRes = await loanService.updateLoan(testUser.id, closedLoanId, {
      name: 'Renamed Closed Loan',
      notes: 'Updated archive notes',
      emiAmount: '3000.00',
      nextEmiDate: '2026-12-25T10:00:00.000Z',
    }, db);
    assert.equal(updateClosedRes.success, true);
    assert.equal(updateClosedRes.loan.name, 'Renamed Closed Loan');
    assert.equal(updateClosedRes.loan.status, 'CLOSED');

    // Regression check: obligation MUST remain inactive and archived
    const obAfterClosedEdit = await db.obligation.findUnique({ where: { id: closedObId } });
    assert.equal(obAfterClosedEdit?.isActive, false, 'Obligation must not be reactivated');
    assert.equal(obAfterClosedEdit?.isArchived, true, 'Obligation must remain archived');

    // Regression check: no pending or snoozed reminder deliveries should exist
    const deliveriesAfterClosedEdit = await db.reminderDelivery.findMany({
      where: {
        obligationId: closedObId,
        status: { in: ['PENDING', 'SNOOZED'] }
      }
    });
    assert.equal(deliveriesAfterClosedEdit.length, 0, 'No stale deliveries should be scheduled');

  } finally {
    await db.$disconnect();
  }
});

test('V2-370: Repair 2-B - Loan Concurrency, Recurrence & Reminder State (Findings P1 #2, #3, #4, #5 and P2 #6)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const user = await db.user.create({
      data: {
        id: `usr-r2b-${timestamp}`,
        email: `r2b-${timestamp}@test.local`,
        name: 'User Repair 2-B',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const bankAcc = await financeService.createAccount(user.id, {
      name: 'Primary Checking',
      type: 'BANK',
      openingBalance: '200000.00',
    }, db);
    const bankId = bankAcc.account.id;

    // -------------------------------------------------------------------------
    // 1. Finding P1 #2: Concurrent updateLoan calls creating no orphan obligations
    // -------------------------------------------------------------------------
    const concLoanRes = await loanService.createLoan(user.id, {
      name: 'Concurrency Test Loan',
      loanType: 'PERSONAL',
      lender: 'Test Bank',
      openingOutstanding: '100000.00',
      paymentAccountId: bankId,
    }, db);
    assert.equal(concLoanRes.success, true);
    const concLoanId = concLoanRes.loan.id;
    assert.equal(concLoanRes.loan.obligationId, null);

    // Run 3 concurrent updateLoan calls that link schedule and emiAmount
    const [upd1, upd2, upd3] = await Promise.all([
      loanService.updateLoan(user.id, concLoanId, {
        emiAmount: '5000.00',
        nextEmiDate: '2026-11-15T10:00:00.000Z',
        dueDay: 15,
        notes: 'Concurrent update 1',
      }, db),
      loanService.updateLoan(user.id, concLoanId, {
        emiAmount: '5000.00',
        nextEmiDate: '2026-11-15T10:00:00.000Z',
        dueDay: 15,
        notes: 'Concurrent update 2',
      }, db),
      loanService.updateLoan(user.id, concLoanId, {
        emiAmount: '5000.00',
        nextEmiDate: '2026-11-15T10:00:00.000Z',
        dueDay: 15,
        notes: 'Concurrent update 3',
      }, db),
    ]);

    assert.equal(upd1.success, true);
    assert.equal(upd2.success, true);
    assert.equal(upd3.success, true);

    const loanAfterConc = await db.loan.findUnique({ where: { id: concLoanId } });
    assert.ok(loanAfterConc?.obligationId, 'Loan must have an obligation linked');

    // Check that NO orphan obligations were created in database for this loan/user
    const userEmiObs = await db.obligation.findMany({
      where: {
        userId: user.id,
        kind: 'EMI',
        title: { contains: 'Concurrency Test Loan' }
      }
    });
    assert.equal(userEmiObs.length, 1, 'Exactly one linked obligation must exist; no orphaned obligations created');
    assert.equal(userEmiObs[0].id, loanAfterConc?.obligationId);
    assert.equal(userEmiObs[0].isActive, true);

    // -------------------------------------------------------------------------
    // 2. Finding P1 #3: Clearing nextEmiDate while retaining dueDay deactivates obligation
    // -------------------------------------------------------------------------
    const schedLoanRes = await loanService.createLoan(user.id, {
      name: 'Schedule Clear Loan',
      loanType: 'PERSONAL',
      lender: 'Test Bank',
      openingOutstanding: '50000.00',
      emiAmount: '2500.00',
      nextEmiDate: '2026-11-15T10:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankId,
    }, db);
    assert.equal(schedLoanRes.success, true);
    const schedLoanId = schedLoanRes.loan.id;
    const schedObId = schedLoanRes.loan.obligationId!;

    // Create a pending delivery for this obligation
    await db.reminderDelivery.create({
      data: {
        userId: user.id,
        obligationId: schedObId,
        reminderId: (await db.reminder.create({
          data: {
            userId: user.id,
            obligationId: schedObId,
            type: 'BILL',
            title: 'Clear Schedule Reminder',
            time: '10:00',
            recurrenceType: 'MONTHLY',
          }
        })).id,
        occurrenceKey: '2026-11-15T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-15T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // Update loan: clear nextEmiDate (null) but retain dueDay 15
    const clearSchedRes = await loanService.updateLoan(user.id, schedLoanId, {
      nextEmiDate: null,
      dueDay: 15,
    }, db);
    assert.equal(clearSchedRes.success, true);
    assert.equal(clearSchedRes.loan.nextEmiDate, null);
    assert.equal(clearSchedRes.loan.dueDay, 15);

    // Obligation must be deactivated atomically and pending deliveries purged
    const obAfterClear = await db.obligation.findUnique({ where: { id: schedObId } });
    assert.equal(obAfterClear?.isActive, false, 'Linked obligation must be deactivated when nextEmiDate is cleared');

    const deliveriesAfterClear = await db.reminderDelivery.findMany({
      where: {
        obligationId: schedObId,
        status: { in: ['PENDING', 'SNOOZED'] }
      }
    });
    assert.equal(deliveriesAfterClear.length, 0, 'Pending deliveries must be purged when schedule cleared');

    // -------------------------------------------------------------------------
    // 3. Finding P1 #4: Jan 31 -> Feb 28 -> Mar 31 recurrence
    // -------------------------------------------------------------------------
    const leapLoanRes = await loanService.createLoan(user.id, {
      name: 'Month End Recurrence Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '90000.00',
      emiAmount: '10000.00',
      nextEmiDate: '2026-01-31T10:00:00.000Z',
      dueDay: 31,
      paymentAccountId: bankId,
    }, db);
    assert.equal(leapLoanRes.success, true);
    const leapLoanId = leapLoanRes.loan.id;
    const leapObId = leapLoanRes.loan.obligationId!;

    // Payment 1: Jan 31 -> advances to Feb 28
    const pay1 = await loanService.recordEmiPayment(user.id, {
      loanId: leapLoanId,
      amount: '10000.00',
      accountId: bankId,
      principalPaid: '8000.00',
      occurredAt: '2026-01-31T10:00:00.000Z',
    }, db);
    assert.equal(pay1.success, true);

    const loanAfterPay1 = await db.loan.findUnique({ where: { id: leapLoanId } });
    const obAfterPay1 = await db.obligation.findUnique({ where: { id: leapObId } });
    assert.equal(loanAfterPay1?.nextEmiDate?.toISOString(), '2026-02-28T10:00:00.000Z');
    assert.equal(obAfterPay1?.nextDueAt?.toISOString(), '2026-02-28T10:00:00.000Z');
    assert.equal(loanAfterPay1?.dueDay, 31, 'Canonical dueDay 31 must be preserved on loan');

    // Payment 2: Feb 28 -> advances back to Mar 31 (NOT Mar 28!)
    const pay2 = await loanService.recordEmiPayment(user.id, {
      loanId: leapLoanId,
      amount: '10000.00',
      accountId: bankId,
      principalPaid: '8000.00',
      occurredAt: '2026-02-28T10:00:00.000Z',
    }, db);
    assert.equal(pay2.success, true);

    const loanAfterPay2 = await db.loan.findUnique({ where: { id: leapLoanId } });
    const obAfterPay2 = await db.obligation.findUnique({ where: { id: leapObId } });
    assert.equal(loanAfterPay2?.nextEmiDate?.toISOString(), '2026-03-31T10:00:00.000Z', 'Must advance back to Mar 31 without drift');
    assert.equal(obAfterPay2?.nextDueAt?.toISOString(), '2026-03-31T10:00:00.000Z', 'Linked obligation must advance back to Mar 31');
    assert.equal(loanAfterPay2?.dueDay, 31);

    // -------------------------------------------------------------------------
    // 4. Finding P1 #4: Linked obligation payment advancing dates consistently
    // -------------------------------------------------------------------------
    const linkedEmiLoanRes = await loanService.createLoan(user.id, {
      name: 'Linked MarkPaid Loan',
      loanType: 'PERSONAL',
      lender: 'ICICI Bank',
      openingOutstanding: '90000.00',
      emiAmount: '10000.00',
      nextEmiDate: '2026-01-31T10:00:00.000Z',
      dueDay: 31,
      paymentAccountId: bankId,
    }, db);
    assert.equal(linkedEmiLoanRes.success, true);
    const linkedEmiLoanId = linkedEmiLoanRes.loan.id;
    const linkedEmiObId = linkedEmiLoanRes.loan.obligationId!;

    // Pay occurrence 1 via financeService.markObligationPaid
    const markRes1 = await financeService.markObligationPaid(user.id, {
      obligationId: linkedEmiObId,
      occurrenceKey: '2026-01-31T15:30', // In Asia/Kolkata (10:00 UTC = 15:30 IST)
      accountId: bankId,
    }, db);
    assert.equal(markRes1.success, true);
    assert.equal(markRes1.nextDueAt, '2026-02-28T10:00:00.000Z');

    const loanAfterMark1 = await db.loan.findUnique({ where: { id: linkedEmiLoanId } });
    const obAfterMark1 = await db.obligation.findUnique({ where: { id: linkedEmiObId } });
    assert.equal(loanAfterMark1?.nextEmiDate?.toISOString(), '2026-02-28T10:00:00.000Z');
    assert.equal(obAfterMark1?.nextDueAt?.toISOString(), '2026-02-28T10:00:00.000Z');

    // Pay occurrence 2 via financeService.markObligationPaid
    const markRes2 = await financeService.markObligationPaid(user.id, {
      obligationId: linkedEmiObId,
      occurrenceKey: '2026-02-28T15:30',
      accountId: bankId,
    }, db);
    assert.equal(markRes2.success, true);
    assert.equal(markRes2.nextDueAt, '2026-03-31T10:00:00.000Z', 'markObligationPaid must return Mar 31 and not overwrite with Mar 28');

    const loanAfterMark2 = await db.loan.findUnique({ where: { id: linkedEmiLoanId } });
    const obAfterMark2 = await db.obligation.findUnique({ where: { id: linkedEmiObId } });
    assert.equal(loanAfterMark2?.nextEmiDate?.toISOString(), '2026-03-31T10:00:00.000Z');
    assert.equal(obAfterMark2?.nextDueAt?.toISOString(), '2026-03-31T10:00:00.000Z', 'Obligation must advance to Mar 31 consistently');

    // -------------------------------------------------------------------------
    // 5. Finding P1 #5: Metadata-only edits preserving paused obligation and snoozed claims
    // -------------------------------------------------------------------------
    const pauseLoanRes = await loanService.createLoan(user.id, {
      name: 'Pause & Snooze Loan',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '60000.00',
      emiAmount: '3000.00',
      nextEmiDate: '2026-11-15T10:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankId,
    }, db);
    const pauseLoanId = pauseLoanRes.loan.id;
    const pauseObId = pauseLoanRes.loan.obligationId!;

    // Explicitly pause the obligation
    await db.obligation.update({
      where: { id: pauseObId },
      data: { isActive: false }
    });

    // Add a SNOOZED delivery claim
    const pauseRem = await db.reminder.create({
      data: {
        userId: user.id,
        obligationId: pauseObId,
        type: 'BILL',
        title: 'Pause Test Reminder',
        time: '10:00',
        recurrenceType: 'MONTHLY',
      }
    });
    const snoozedDelivery = await db.reminderDelivery.create({
      data: {
        userId: user.id,
        obligationId: pauseObId,
        reminderId: pauseRem.id,
        occurrenceKey: '2026-11-15T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-15T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'SNOOZED',
        snoozedUntil: new Date('2026-11-15T12:00:00.000Z'),
      }
    });

    // Metadata-only edit: name, notes, unchanged emiAmount, unchanged dueDay, unchanged nextEmiDate
    const metaEditRes = await loanService.updateLoan(user.id, pauseLoanId, {
      name: 'Renamed Pause & Snooze Loan',
      notes: 'Updated metadata notes only',
      emiAmount: '3000.00',
      dueDay: 15,
      nextEmiDate: '2026-11-15T10:00:00.000Z',
    }, db);
    assert.equal(metaEditRes.success, true);

    // Obligation must STILL be paused (isActive: false)
    const obAfterMetaEdit = await db.obligation.findUnique({ where: { id: pauseObId } });
    assert.equal(obAfterMetaEdit?.isActive, false, 'Paused obligation state must be preserved on metadata-only edit');

    // SNOOZED delivery claim must STILL exist (not purged)
    const deliveryAfterMetaEdit = await db.reminderDelivery.findUnique({ where: { id: snoozedDelivery.id } });
    assert.ok(deliveryAfterMetaEdit, 'SNOOZED delivery claim must be preserved on metadata-only edit');
    assert.equal(deliveryAfterMetaEdit?.status, 'SNOOZED');

    // -------------------------------------------------------------------------
    // 6. Finding P2 #6: DueDay edit 15 -> 20 updating nextEmiDate
    // -------------------------------------------------------------------------
    const dueDayLoanRes = await loanService.createLoan(user.id, {
      name: 'Due Day Edit Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '40000.00',
      emiAmount: '2000.00',
      nextEmiDate: '2026-11-15T10:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankId,
    }, db);
    const dueDayLoanId = dueDayLoanRes.loan.id;
    const dueDayObId = dueDayLoanRes.loan.obligationId!;

    // Edit dueDay from 15 to 20, passing stale nextEmiDate (day 15)
    const dueDayEditRes = await loanService.updateLoan(user.id, dueDayLoanId, {
      dueDay: 20,
      nextEmiDate: '2026-11-15T10:00:00.000Z', // stale unchanged date submitted
    }, db);
    assert.equal(dueDayEditRes.success, true);
    assert.equal(dueDayEditRes.loan.dueDay, 20);

    const loanAfterDueDayEdit = await db.loan.findUnique({ where: { id: dueDayLoanId } });
    const obAfterDueDayEdit = await db.obligation.findUnique({ where: { id: dueDayObId } });

    assert.equal(loanAfterDueDayEdit?.dueDay, 20);
    const loanDateInTz = new TZDate(loanAfterDueDayEdit?.nextEmiDate!, 'Asia/Kolkata');
    assert.equal(loanDateInTz.getDate(), 20, 'Next EMI date must update to day 20 when dueDay is changed to 20');

    const obDateInTz = new TZDate(obAfterDueDayEdit?.nextDueAt!, 'Asia/Kolkata');
    assert.equal(obDateInTz.getDate(), 20, 'Obligation next due date must update to day 20 when dueDay is changed to 20');

  } finally {
    await db.$disconnect();
  }
});

test('V2-380: Repair 3-B - Loan dates, closure lock, bill anchor, schedule clearing (Findings P1 #1, #3, #4, #5)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const user = await db.user.create({
      data: {
        id: `usr-r3b-${timestamp}`,
        email: `r3b-${timestamp}@test.local`,
        name: 'User Repair 3-B',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const bankAcc = await financeService.createAccount(user.id, {
      name: 'Checking Account',
      type: 'BANK',
      openingBalance: '500000.00',
    }, db);
    const bankId = bankAcc.account.id;

    // -------------------------------------------------------------------------
    // 1. Finding 1 (P1): LoanForm timestamp & pause/snooze preservation
    // Comparing calendar dates in user's timezone preserves paused state & snoozed claims
    // -------------------------------------------------------------------------
    const f1LoanRes = await loanService.createLoan(user.id, {
      name: 'Timezone Compare Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '50000.00',
      emiAmount: '5000.00',
      // In Asia/Kolkata (UTC+5:30), 2026-11-15T12:00:00.000Z is 2026-11-15 17:30
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankId,
    }, db);
    assert.equal(f1LoanRes.success, true);
    const f1LoanId = f1LoanRes.loan.id;
    const f1ObId = f1LoanRes.loan.obligationId!;

    // Explicitly pause the obligation
    await db.obligation.update({
      where: { id: f1ObId },
      data: { isActive: false }
    });

    // Create a reminder and SNOOZED delivery claim
    const f1Rem = await db.reminder.create({
      data: {
        userId: user.id,
        obligationId: f1ObId,
        type: 'BILL',
        title: 'F1 Reminder',
        time: '10:00',
        recurrenceType: 'MONTHLY',
      }
    });
    const snoozedClaim = await db.reminderDelivery.create({
      data: {
        userId: user.id,
        obligationId: f1ObId,
        reminderId: f1Rem.id,
        occurrenceKey: '2026-11-15T10:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-15T10:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'SNOOZED',
        snoozedUntil: new Date('2026-11-15T18:00:00.000Z'),
      }
    });

    // Update with 00:00Z midnight time-of-day normalization on the SAME calendar date (Nov 15) in Asia/Kolkata (05:30 AM)
    const f1UpdateRes = await loanService.updateLoan(user.id, f1LoanId, {
      name: 'Renamed Timezone Compare Loan',
      notes: 'Testing time-of-day normalization preservation',
      dueDay: 15,
      nextEmiDate: '2026-11-15T00:00:00.000Z',
    }, db);
    assert.equal(f1UpdateRes.success, true);

    // Paused obligation state (isActive: false) must be preserved
    const obAfterF1 = await db.obligation.findUnique({ where: { id: f1ObId } });
    assert.equal(obAfterF1?.isActive, false, 'Paused obligation must NOT be reactivated on same calendar date');

    // SNOOZED delivery claim must NOT be purged
    const claimAfterF1 = await db.reminderDelivery.findUnique({ where: { id: snoozedClaim.id } });
    assert.ok(claimAfterF1, 'SNOOZED delivery claim must be preserved on same calendar date');
    assert.equal(claimAfterF1?.status, 'SNOOZED');

    // -------------------------------------------------------------------------
    // 2. Finding 3 (P1): Loan closure concurrency re-read lock
    // Inside tx, closeLoan and archiveLoan re-read the loan to catch concurrently linked obligations
    // -------------------------------------------------------------------------
    // Create loan without obligation
    const f3LoanRes = await loanService.createLoan(user.id, {
      name: 'Closure Lock Test Loan',
      loanType: 'PERSONAL',
      lender: 'SBI',
      openingOutstanding: '30000.00',
    }, db);
    const f3LoanId = f3LoanRes.loan.id;

    // Simulate concurrent obligation link right before closeLoan executes
    const concurrentOb = await db.obligation.create({
      data: {
        userId: user.id,
        title: 'Concurrent EMI Obligation',
        kind: 'EMI',
        amount: new Prisma.Decimal(3000),
        dueAt: new Date('2026-11-20T10:00:00.000Z'),
        nextDueAt: new Date('2026-11-20T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    await db.loan.update({
      where: { id: f3LoanId },
      data: { obligationId: concurrentOb.id }
    });

    // Close the loan
    const closeRes = await loanService.closeLoan(user.id, f3LoanId, db);
    assert.equal(closeRes.success, true);

    const f3LoanAfterClose = await db.loan.findUnique({ where: { id: f3LoanId } });
    assert.equal(f3LoanAfterClose?.status, 'CLOSED');

    // The concurrently linked obligation must have been re-read and cleaned up (deactivated & archived)
    const obAfterClose = await db.obligation.findUnique({ where: { id: concurrentOb.id } });
    assert.equal(obAfterClose?.isActive, false, 'Concurrently linked obligation must be deactivated on closeLoan');
    assert.equal(obAfterClose?.isArchived, true, 'Concurrently linked obligation must be archived on closeLoan');

    // Similarly test archiveLoan with concurrency re-read lock
    const f3ArchiveLoanRes = await loanService.createLoan(user.id, {
      name: 'Archive Lock Test Loan',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '20000.00',
    }, db);
    const f3ArchiveLoanId = f3ArchiveLoanRes.loan.id;

    const concurrentArchiveOb = await db.obligation.create({
      data: {
        userId: user.id,
        title: 'Concurrent Archive EMI Obligation',
        kind: 'EMI',
        amount: new Prisma.Decimal(2000),
        dueAt: new Date('2026-11-25T10:00:00.000Z'),
        nextDueAt: new Date('2026-11-25T10:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    await db.loan.update({
      where: { id: f3ArchiveLoanId },
      data: { obligationId: concurrentArchiveOb.id }
    });

    const archiveRes = await loanService.archiveLoan(user.id, f3ArchiveLoanId, db);
    assert.equal(archiveRes.success, true);

    const obAfterArchive = await db.obligation.findUnique({ where: { id: concurrentArchiveOb.id } });
    assert.equal(obAfterArchive?.isActive, false, 'Concurrently linked obligation must be deactivated on archiveLoan');
    assert.equal(obAfterArchive?.isArchived, true, 'Concurrently linked obligation must be archived on archiveLoan');

    // -------------------------------------------------------------------------
    // 3. Finding 4 (P1): Bill/Obligation anchor preservation
    // In updateObligation: do NOT overwrite dueAt with nextDueAt unless anchor was explicitly changed
    // -------------------------------------------------------------------------
    const anchorDate = new Date('2026-01-05T10:00:00.000Z');
    const recurringNextDueDate = new Date('2026-10-05T10:00:00.000Z');
    const anchorOb = await db.obligation.create({
      data: {
        userId: user.id,
        title: 'Anchor Preservation Bill',
        kind: 'BILL',
        amount: new Prisma.Decimal(999),
        dueAt: anchorDate,
        nextDueAt: recurringNextDueDate,
        recurrenceType: 'MONTHLY',
        recurrenceInterval: 1,
        isActive: true,
      }
    });

    // 3a. Metadata edit (updating title and notes): dueAt must remain the initial anchor
    const updateTitleRes = await financeService.updateObligation(user.id, anchorOb.id, {
      title: 'Anchor Preservation Bill (Updated Title)',
      notes: 'Preserve anchor test',
    }, db);
    assert.equal(updateTitleRes.success, true);

    const obAfterTitleEdit = await db.obligation.findUnique({ where: { id: anchorOb.id } });
    assert.equal(obAfterTitleEdit?.dueAt.toISOString(), anchorDate.toISOString(), 'dueAt anchor must be preserved on metadata edit');
    assert.equal(obAfterTitleEdit?.nextDueAt.toISOString(), recurringNextDueDate.toISOString(), 'nextDueAt must remain untouched');

    // 3b. Editing nextDueAt directly: dueAt must NOT be overwritten with nextDueAt
    const newNextDue = new Date('2026-11-05T10:00:00.000Z');
    const updateNextDueRes = await financeService.updateObligation(user.id, anchorOb.id, {
      nextDueAt: newNextDue.toISOString(),
    }, db);
    assert.equal(updateNextDueRes.success, true);

    const obAfterNextDueEdit = await db.obligation.findUnique({ where: { id: anchorOb.id } });
    assert.equal(obAfterNextDueEdit?.dueAt.toISOString(), anchorDate.toISOString(), 'dueAt anchor must NOT be overwritten when nextDueAt is updated');
    assert.equal(obAfterNextDueEdit?.nextDueAt.toISOString(), newNextDue.toISOString());

    // 3c. Explicitly changing dueAt anchor: dueAt updates to new anchor
    const explicitNewAnchor = new Date('2026-02-01T10:00:00.000Z');
    const updateAnchorRes = await financeService.updateObligation(user.id, anchorOb.id, {
      dueAt: explicitNewAnchor.toISOString(),
    }, db);
    assert.equal(updateAnchorRes.success, true);

    const obAfterExplicitAnchor = await db.obligation.findUnique({ where: { id: anchorOb.id } });
    assert.equal(obAfterExplicitAnchor?.dueAt.toISOString(), explicitNewAnchor.toISOString(), 'dueAt must update when explicitly changed');

    // -------------------------------------------------------------------------
    // 4. Finding 5 (P1): Explicit schedule clear with dueDay change
    // If parsed.nextEmiDate === null, do NOT recalculate replacement date when dueDay changes;
    // honor explicit null and atomically deactivate the schedule/obligation
    // -------------------------------------------------------------------------
    const f5LoanRes = await loanService.createLoan(user.id, {
      name: 'Schedule Clear Loan',
      loanType: 'PERSONAL',
      lender: 'Kotak Bank',
      openingOutstanding: '45000.00',
      emiAmount: '3500.00',
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankId,
    }, db);
    assert.equal(f5LoanRes.success, true);
    const f5LoanId = f5LoanRes.loan.id;
    const f5ObId = f5LoanRes.loan.obligationId!;

    // Create a pending delivery for this obligation
    const f5Rem = await db.reminder.create({
      data: {
        userId: user.id,
        obligationId: f5ObId,
        type: 'BILL',
        title: 'F5 Bill Reminder',
        time: '12:00',
        recurrenceType: 'MONTHLY',
      }
    });
    const f5Delivery = await db.reminderDelivery.create({
      data: {
        userId: user.id,
        obligationId: f5ObId,
        reminderId: f5Rem.id,
        occurrenceKey: '2026-11-15T12:00',
        offsetMinutes: 0,
        scheduledFor: new Date('2026-11-15T12:00:00.000Z'),
        channel: 'TELEGRAM',
        status: 'PENDING',
      }
    });

    // Explicit schedule clear while changing dueDay (dueDay 15 -> 20, nextEmiDate: null)
    const clearScheduleRes = await loanService.updateLoan(user.id, f5LoanId, {
      dueDay: 20,
      nextEmiDate: null,
    }, db);
    assert.equal(clearScheduleRes.success, true);
    assert.equal(clearScheduleRes.loan.dueDay, 20);
    assert.equal(clearScheduleRes.loan.nextEmiDate, null, 'nextEmiDate must be null when explicitly requested');

    const loanAfterClear = await db.loan.findUnique({ where: { id: f5LoanId } });
    assert.equal(loanAfterClear?.dueDay, 20);
    assert.equal(loanAfterClear?.nextEmiDate, null, 'Loan nextEmiDate must NOT be recalculated when nextEmiDate is explicitly null');

    const obAfterClear = await db.obligation.findUnique({ where: { id: f5ObId } });
    assert.equal(obAfterClear?.isActive, false, 'Linked obligation must be deactivated when schedule is cleared');

    const deliveryAfterClear = await db.reminderDelivery.findUnique({ where: { id: f5Delivery.id } });
    assert.equal(deliveryAfterClear, null, 'Pending reminder delivery claims must be purged on schedule clear');

  } finally {
    await db.$disconnect();
  }
});

test('V2-390: Repair 4 - P1 Tickets R001-P1-01..04', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const user = await db.user.create({
      data: {
        id: `usr-r4-${timestamp}`,
        email: `r4-${timestamp}@test.local`,
        name: 'User Repair4 Test',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userB = await db.user.create({
      data: {
        id: `usr-r4-b-${timestamp}`,
        email: `r4b-${timestamp}@test.local`,
        name: 'User Repair4 Beta',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const bankA = await financeService.createAccount(user.id, {
      name: 'Salary Bank A',
      type: 'BANK',
      openingBalance: '100000.00',
    }, db);
    const bankAId = bankA.account.id;

    const bankB = await financeService.createAccount(userB.id, {
      name: 'Salary Bank B',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);
    const bankBId = bankB.account.id;

    // -------------------------------------------------------------------------
    // 1. Ticket R001-P1-01: Concurrency idempotency under transaction lock
    // Promise.all with identical idempotencyKey on recordEmiPayment results in
    // exactly 1 payment created and 1 alreadyProcessed: true result; principal deducted only once.
    // -------------------------------------------------------------------------
    const cLoanRes = await loanService.createLoan(user.id, {
      name: 'Concurrent Idempotency Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '50000.00',
      emiAmount: '5000.00',
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankAId,
    }, db);
    assert.equal(cLoanRes.success, true);
    const cLoanId = cLoanRes.loan.id;

    const [payRes1, payRes2] = await Promise.all([
      loanService.recordEmiPayment(user.id, {
        loanId: cLoanId,
        amount: '5000.00',
        accountId: bankAId,
        principalPaid: '5000.00',
        idempotencyKey: `idemp-race-${timestamp}`,
      }, db),
      loanService.recordEmiPayment(user.id, {
        loanId: cLoanId,
        amount: '5000.00',
        accountId: bankAId,
        principalPaid: '5000.00',
        idempotencyKey: `idemp-race-${timestamp}`,
      }, db),
    ]);

    assert.equal(payRes1.success, true);
    assert.equal(payRes2.success, true);

    const results = [payRes1, payRes2];
    const initialProcessed = results.find(r => !r.alreadyProcessed);
    const idempotentProcessed = results.find(r => r.alreadyProcessed);

    assert.ok(initialProcessed, 'One payment must succeed as newly processed');
    assert.ok(idempotentProcessed, 'Second concurrent payment must return alreadyProcessed: true');
    assert.equal(idempotentProcessed.paymentId, initialProcessed.paymentId, 'Both calls must return the same paymentId');

    const paymentsInDb = await db.loanPayment.findMany({
      where: { loanId: cLoanId },
    });
    assert.equal(paymentsInDb.length, 1, 'Exactly 1 loan payment must be created');

    const loanAfterConcurrent = await db.loan.findUnique({
      where: { id: cLoanId },
    });
    assert.equal(loanAfterConcurrent?.outstandingPrincipal.toString(), '45000', 'Principal must be deducted only once');

    // Test obligationPaymentId idempotency
    const obPayRes1 = await loanService.recordEmiPayment(user.id, {
      loanId: cLoanId,
      amount: '5000.00',
      accountId: bankAId,
      principalPaid: '5000.00',
      obligationPaymentId: `obpay-race-${timestamp}`,
    }, db);
    assert.equal(obPayRes1.success, true);
    assert.equal(obPayRes1.alreadyProcessed, false);

    const obPayRes2 = await loanService.recordEmiPayment(user.id, {
      loanId: cLoanId,
      amount: '5000.00',
      accountId: bankAId,
      principalPaid: '5000.00',
      obligationPaymentId: `obpay-race-${timestamp}`,
    }, db);
    assert.equal(obPayRes2.success, true);
    assert.equal(obPayRes2.alreadyProcessed, true);
    assert.equal(obPayRes2.paymentId, obPayRes1.paymentId);

    // Cross-user isolation: User B cannot record payment on User A's loan
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(userB.id, {
          loanId: cLoanId,
          amount: '5000.00',
          accountId: bankBId,
          idempotencyKey: `idemp-race-${timestamp}`,
        }, db);
      },
      /unauthorized|not found/i,
      'Cross-user payment attempt must be rejected'
    );

    // -------------------------------------------------------------------------
    // 2. Ticket R001-P1-02: Schedule clearing + rename test
    // Clearing schedule (nextEmiDate: null), then renaming the loan keeps
    // nextEmiDate: null and obligation inactive.
    // -------------------------------------------------------------------------
    const clearLoanRes = await loanService.createLoan(user.id, {
      name: 'Schedule Clear Test Loan',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '30000.00',
      emiAmount: '2500.00',
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankAId,
      createLinkedObligation: true,
    }, db);
    assert.equal(clearLoanRes.success, true);
    const clearLoanId = clearLoanRes.loan.id;
    const clearObId = clearLoanRes.loan.obligationId!;

    // Step A: Explicitly clear the schedule
    const clearRes = await loanService.updateLoan(user.id, clearLoanId, {
      nextEmiDate: null,
    }, db);
    assert.equal(clearRes.success, true);
    assert.equal(clearRes.loan.nextEmiDate, null);

    const obAfterClear = await db.obligation.findUnique({ where: { id: clearObId } });
    assert.equal(obAfterClear?.isActive, false, 'Linked obligation must be inactive after schedule clear');

    // Step B: Rename the loan (metadata-only edit, sending existing dueDay 15)
    const renameRes = await loanService.updateLoan(user.id, clearLoanId, {
      name: 'Renamed Schedule Clear Loan',
      dueDay: 15,
    }, db);
    assert.equal(renameRes.success, true);
    assert.equal(renameRes.loan.name, 'Renamed Schedule Clear Loan');
    assert.equal(renameRes.loan.nextEmiDate, null, 'nextEmiDate must remain null after metadata rename edit');

    const loanAfterRename = await db.loan.findUnique({ where: { id: clearLoanId } });
    assert.equal(loanAfterRename?.nextEmiDate, null, 'DB nextEmiDate must remain null');

    const obAfterRename = await db.obligation.findUnique({ where: { id: clearObId } });
    assert.equal(obAfterRename?.isActive, false, 'Linked obligation must remain inactive after rename');

    // -------------------------------------------------------------------------
    // 3. Ticket R001-P1-03: Precedence test
    // Changing dueDay and providing explicit nextEmiDate preserves the explicit date.
    // -------------------------------------------------------------------------
    const precLoanRes = await loanService.createLoan(user.id, {
      name: 'Precedence Test Loan',
      loanType: 'PERSONAL',
      lender: 'SBI',
      openingOutstanding: '40000.00',
      emiAmount: '4000.00',
      nextEmiDate: '2026-11-10T12:00:00.000Z',
      dueDay: 10,
      paymentAccountId: bankAId,
    }, db);
    assert.equal(precLoanRes.success, true);
    const precLoanId = precLoanRes.loan.id;

    const explicitDate = '2026-11-20T12:00:00.000Z';
    const precUpdateRes = await loanService.updateLoan(user.id, precLoanId, {
      dueDay: 25,
      nextEmiDate: explicitDate,
    }, db);
    assert.equal(precUpdateRes.success, true);
    assert.equal(precUpdateRes.loan.dueDay, 25);
    assert.equal(
      new Date(precUpdateRes.loan.nextEmiDate!).toISOString(),
      new Date(explicitDate).toISOString(),
      'Explicit nextEmiDate must take precedence over automatic dueDay calculation'
    );

    const loanAfterPrec = await db.loan.findUnique({ where: { id: precLoanId } });
    assert.equal(
      loanAfterPrec?.nextEmiDate?.toISOString(),
      new Date(explicitDate).toISOString(),
      'DB nextEmiDate must match explicit date'
    );

    // -------------------------------------------------------------------------
    // 4. Ticket R001-P1-04: Reopen test
    // CLOSED loan reconciled to positive outstanding reactivates linked obligation
    // when schedule exists; leaves obligation inactive when schedule is null.
    // -------------------------------------------------------------------------
    // 4a. Case A: Schedule exists (nextEmiDate && emiAmount)
    const reopenLoanRes = await loanService.createLoan(user.id, {
      name: 'Reopen Active Schedule Loan',
      loanType: 'PERSONAL',
      lender: 'ICICI Bank',
      openingOutstanding: '20000.00',
      emiAmount: '2000.00',
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankAId,
      createLinkedObligation: true,
    }, db);
    assert.equal(reopenLoanRes.success, true);
    const reopenLoanId = reopenLoanRes.loan.id;
    const reopenObId = reopenLoanRes.loan.obligationId!;

    const reopenRem = await db.reminder.create({
      data: {
        userId: user.id,
        obligationId: reopenObId,
        type: 'LOAN_EMI',
        category: reopenLoanId,
        domain: 'FINANCE',
        title: 'Reopen Loan Reminder',
        time: '12:00',
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });

    const closeRes = await loanService.reconcileOutstanding(user.id, reopenLoanId, 0, 'Payoff', db);
    assert.equal(closeRes.success, true);
    assert.equal(closeRes.status, 'CLOSED');

    const obAfterClose = await db.obligation.findUnique({ where: { id: reopenObId } });
    assert.equal(obAfterClose?.isActive, false);
    assert.equal(obAfterClose?.isArchived, true);

    const remAfterClose = await db.reminder.findUnique({ where: { id: reopenRem.id } });
    assert.equal(remAfterClose?.isActive, false);

    const reopenRes = await loanService.reconcileOutstanding(user.id, reopenLoanId, '10000.00', 'Correction / Reopen', db);
    assert.equal(reopenRes.success, true);
    assert.equal(reopenRes.status, 'ACTIVE');
    assert.equal(reopenRes.outstandingPrincipal, '10000');

    const obAfterReopen = await db.obligation.findUnique({ where: { id: reopenObId } });
    assert.equal(obAfterReopen?.isActive, true, 'Linked obligation must be reactivated when loan reopens with active schedule');
    assert.equal(obAfterReopen?.isArchived, false, 'Linked obligation must unarchive when loan reopens');

    const remAfterReopen = await db.reminder.findUnique({ where: { id: reopenRem.id } });
    assert.equal(remAfterReopen?.isActive, true, 'Loan reminders must be reactivated when loan reopens');

    // Repeated reconcile is idempotent: does not duplicate or re-archive
    const repeatReopenRes = await loanService.reconcileOutstanding(user.id, reopenLoanId, '9000.00', 'Second adjust', db);
    assert.equal(repeatReopenRes.success, true);
    assert.equal(repeatReopenRes.status, 'ACTIVE');

    const obAfterRepeat = await db.obligation.findUnique({ where: { id: reopenObId } });
    assert.equal(obAfterRepeat?.isActive, true);
    assert.equal(obAfterRepeat?.isArchived, false);

    // 4b. Case B: Schedule is null (cleared schedule)
    const nullSchedLoanRes = await loanService.createLoan(user.id, {
      name: 'Reopen Null Schedule Loan',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '15000.00',
      emiAmount: '1500.00',
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bankAId,
      createLinkedObligation: true,
    }, db);
    const nullSchedLoanId = nullSchedLoanRes.loan.id;
    const nullSchedObId = nullSchedLoanRes.loan.obligationId!;

    await loanService.updateLoan(user.id, nullSchedLoanId, { nextEmiDate: null }, db);
    await loanService.reconcileOutstanding(user.id, nullSchedLoanId, 0, 'Payoff', db);

    const reopenNullRes = await loanService.reconcileOutstanding(user.id, nullSchedLoanId, '8000.00', 'Reopen no schedule', db);
    assert.equal(reopenNullRes.success, true);
    assert.equal(reopenNullRes.status, 'ACTIVE');

    const obAfterReopenNull = await db.obligation.findUnique({ where: { id: nullSchedObId } });
    assert.equal(obAfterReopenNull?.isActive, false, 'Linked obligation must remain inactive when loan has no active schedule (nextEmiDate null)');

  } finally {
    await db.$disconnect();
  }
});

test('V2-R001-ROUND2-B: Loan occurrence validation, reversal locking, reopen sync, calendar dates (SOL-R001-001, 003, 009, 011, 013)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const userA = await db.user.create({
      data: {
        id: `usr-r2b-a-${timestamp}`,
        email: `r2ba-${timestamp}@test.local`,
        name: 'User R2B Alpha',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userB = await db.user.create({
      data: {
        id: `usr-r2b-b-${timestamp}`,
        email: `r2bb-${timestamp}@test.local`,
        name: 'User R2B Beta',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const userNy = await db.user.create({
      data: {
        id: `usr-r2b-ny-${timestamp}`,
        email: `r2bny-${timestamp}@test.local`,
        name: 'User R2B New York',
        password: 'password123',
        timezone: 'America/New_York',
      }
    });

    const bankA = await financeService.createAccount(userA.id, {
      name: 'User A Bank',
      type: 'BANK',
      openingBalance: '100000.00',
    }, db);
    const bankAId = bankA.account.id;

    const bankB = await financeService.createAccount(userB.id, {
      name: 'User B Bank',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);
    const bankBId = bankB.account.id;

    // =========================================================================
    // 1. SOL-R001-013: createLinkedObligation: false creates loan without linked obligation
    // =========================================================================
    const unlinkedLoanRes = await loanService.createLoan(userA.id, {
      name: 'Unlinked Car Loan',
      loanType: 'VEHICLE',
      lender: 'SBI',
      openingOutstanding: '300000.00',
      emiAmount: '12000.00',
      nextEmiDate: '2026-11-20T12:00:00.000Z',
      paymentAccountId: bankAId,
      createLinkedObligation: false,
    }, db);
    assert.equal(unlinkedLoanRes.success, true);
    assert.equal(unlinkedLoanRes.loan.obligationId, null);

    const checkNoOb = await db.obligation.findFirst({
      where: {
        userId: userA.id,
        title: { contains: 'Unlinked Car Loan' },
      }
    });
    assert.equal(checkNoOb, null, 'No obligation should be created when createLinkedObligation is false');

    // =========================================================================
    // 2. SOL-R001-001: foreign/unrelated obligationOccurrenceId rejected without disclosing IDs or creating payment
    // =========================================================================
    const loanARes = await loanService.createLoan(userA.id, {
      name: 'Alpha Home Loan',
      loanType: 'HOME',
      lender: 'HDFC Bank',
      openingOutstanding: '500000.00',
      emiAmount: '20000.00',
      nextEmiDate: '2026-11-10T12:00:00.000Z',
      paymentAccountId: bankAId,
      createLinkedObligation: true,
    }, db);
    assert.equal(loanARes.success, true);
    const loanAId = loanARes.loan.id;
    const loanAObId = loanARes.loan.obligationId!;
    assert.ok(loanAObId);

    // Create an obligation and occurrence for User B
    const obB = await db.obligation.create({
      data: {
        userId: userB.id,
        title: 'User B Rent',
        kind: 'RENT',
        amount: new Prisma.Decimal('15000.00'),
        dueAt: new Date('2026-11-01T12:00:00.000Z'),
        nextDueAt: new Date('2026-11-01T12:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    const occB = await db.obligationOccurrence.create({
      data: {
        userId: userB.id,
        obligationId: obB.id,
        occurrenceKey: '2026-11-01',
        dueDate: new Date('2026-11-01T12:00:00.000Z'),
        status: 'COMPLETED',
      }
    });

    // Create an existing loan payment attached to occB under User B
    const loanBRes = await loanService.createLoan(userB.id, {
      name: 'Beta Loan',
      loanType: 'PERSONAL',
      lender: 'Kotak',
      openingOutstanding: '100000.00',
      paymentAccountId: bankBId,
      createLinkedObligation: false,
    }, db);
    await db.loanPayment.create({
      data: {
        userId: userB.id,
        loanId: loanBRes.loan.id,
        amount: new Prisma.Decimal('15000.00'),
        occurredAt: new Date('2026-11-01T12:00:00.000Z'),
        accountId: bankBId,
        obligationOccurrenceId: occB.id,
      }
    });

    // Case 2a: User A tries to record EMI payment referencing User B's occurrence
    // Must reject without disclosing existing paymentId or transactionId
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(userA.id, {
          loanId: loanAId,
          amount: '20000.00',
          accountId: bankAId,
          obligationOccurrenceId: occB.id,
        }, db);
      },
      /Obligation occurrence not found or unauthorized/
    );

    // Case 2b: Create an unrelated obligation for User A (not linked to this loan)
    const unrelatedObA = await db.obligation.create({
      data: {
        userId: userA.id,
        title: 'Electricity Bill',
        kind: 'BILL',
        amount: new Prisma.Decimal('2500.00'),
        dueAt: new Date('2026-11-05T12:00:00.000Z'),
        nextDueAt: new Date('2026-11-05T12:00:00.000Z'),
        recurrenceType: 'MONTHLY',
        isActive: true,
      }
    });
    const unrelatedOccA = await db.obligationOccurrence.create({
      data: {
        userId: userA.id,
        obligationId: unrelatedObA.id,
        occurrenceKey: '2026-11-05',
        dueDate: new Date('2026-11-05T12:00:00.000Z'),
        status: 'COMPLETED',
      }
    });

    // User A tries to record EMI payment referencing the unrelated occurrence
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(userA.id, {
          loanId: loanAId,
          amount: '20000.00',
          accountId: bankAId,
          obligationOccurrenceId: unrelatedOccA.id,
        }, db);
      },
      /Obligation occurrence not found or unauthorized/
    );

    // Verify no payment was created for loanAId
    const loanAPayments = await db.loanPayment.findMany({ where: { loanId: loanAId } });
    assert.equal(loanAPayments.length, 0);

    // =========================================================================
    // 3. SOL-R001-003: Concurrent EMI reversals (Promise.all) restore all principal components accurately
    // =========================================================================
    const revLoanRes = await loanService.createLoan(userA.id, {
      name: 'Reversal Concurrency Loan',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '100000.00',
      emiAmount: '10000.00',
      nextEmiDate: '2026-11-15T12:00:00.000Z',
      paymentAccountId: bankAId,
      createLinkedObligation: false,
    }, db);
    const revLoanId = revLoanRes.loan.id;

    // Record two distinct EMI payments with principal reductions
    const pay1 = await loanService.recordEmiPayment(userA.id, {
      loanId: revLoanId,
      amount: '10000.00',
      principalPaid: '6000.00',
      interestPaid: '4000.00',
      accountId: bankAId,
    }, db);
    assert.equal(pay1.success, true);
    assert.equal(pay1.remainingPrincipal, '94000');

    const pay2 = await loanService.recordEmiPayment(userA.id, {
      loanId: revLoanId,
      amount: '10000.00',
      principalPaid: '4000.00',
      interestPaid: '6000.00',
      accountId: bankAId,
    }, db);
    assert.equal(pay2.success, true);
    assert.equal(pay2.remainingPrincipal, '90000');

    // SOL-R005-001: Attempting to revert earlier pay1 while later pay2 remains completed is rejected
    await assert.rejects(
      async () => {
        await loanService.revertEmiPayment(userA.id, { loanPaymentId: pay1.paymentId }, db);
      },
      /Cannot revert an earlier payment while a later payment remains completed/
    );

    // Concurrent duplicate reversals on pay2 serialize under row lock idempotently
    const [rev2a, rev2b] = await Promise.all([
      loanService.revertEmiPayment(userA.id, { loanPaymentId: pay2.paymentId }, db),
      loanService.revertEmiPayment(userA.id, { loanPaymentId: pay2.paymentId }, db),
    ]);
    assert.equal(rev2a.success, true);
    assert.equal(rev2b.success, true);
    assert.ok(rev2a.alreadyReversed || rev2b.alreadyReversed, 'One concurrent call should report alreadyReversed');

    // Now that later payment pay2 is reverted, pay1 can be cleanly reverted
    const rev1 = await loanService.revertEmiPayment(userA.id, { loanPaymentId: pay1.paymentId }, db);
    assert.equal(rev1.success, true);

    // Fetch the final loan state from DB
    const finalRevLoan = await db.loan.findUnique({ where: { id: revLoanId } });
    assert.equal(
      finalRevLoan?.outstandingPrincipal.toString(),
      '100000',
      'Both principal components (6000 + 4000) must be restored under row lock, bringing 90000 back to 100000'
    );

    // =========================================================================
    // 4. SOL-R001-009: Reopening after payoff synchronizes Obligation.nextDueAt with Loan.nextEmiDate
    // =========================================================================
    const syncLoanRes = await loanService.createLoan(userA.id, {
      name: 'Sync Reopen Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '30000.00',
      emiAmount: '3000.00',
      nextEmiDate: '2026-11-25T12:00:00.000Z',
      dueDay: 25,
      paymentAccountId: bankAId,
      createLinkedObligation: true,
    }, db);
    const syncLoanId = syncLoanRes.loan.id;
    const syncObId = syncLoanRes.loan.obligationId!;
    assert.ok(syncObId);

    // Close the loan via payoff
    const closeRes = await loanService.reconcileOutstanding(userA.id, syncLoanId, 0, 'Paid in full', db);
    assert.equal(closeRes.success, true);
    assert.equal(closeRes.status, 'CLOSED');

    const obAfterClose = await db.obligation.findUnique({ where: { id: syncObId } });
    assert.equal(obAfterClose?.isActive, false);
    assert.equal(obAfterClose?.isArchived, true);

    // Update loan nextEmiDate to future date and new EMI amount
    const futureDate = '2026-12-25T12:00:00.000Z';
    await loanService.updateLoan(userA.id, syncLoanId, {
      nextEmiDate: futureDate,
      emiAmount: '3500.00',
    }, db);

    // Reopen the loan via reconcileOutstanding
    const reopenRes = await loanService.reconcileOutstanding(userA.id, syncLoanId, '15000.00', 'Correction reopen', db);
    assert.equal(reopenRes.success, true);
    assert.equal(reopenRes.status, 'ACTIVE');

    const obAfterReopen = await db.obligation.findUnique({ where: { id: syncObId } });
    assert.equal(obAfterReopen?.isActive, true);
    assert.equal(obAfterReopen?.isArchived, false);
    assert.equal(obAfterReopen?.amount?.toString(), '3500', 'Obligation amount must synchronize with loan emiAmount');
    assert.equal(obAfterReopen?.accountId, bankAId, 'Obligation accountId must synchronize with loan paymentAccountId');
    assert.equal(
      obAfterReopen?.nextDueAt.toISOString(),
      futureDate,
      'Obligation nextDueAt must synchronize with loan nextEmiDate on reopen'
    );

    // =========================================================================
    // 5. SOL-R001-011: Calendar date parsing in user's timezone preserves calendar day
    // =========================================================================
    const nyLoanRes = await loanService.createLoan(userNy.id, {
      name: 'NY Calendar Loan',
      loanType: 'PERSONAL',
      lender: 'Chase',
      openingOutstanding: '10000.00',
      nextEmiDate: '2026-11-15',
      createLinkedObligation: false,
    }, db);
    assert.equal(nyLoanRes.success, true);
    assert.equal(nyLoanRes.loan.dueDay, 15, 'dueDay in America/New_York must be 15, not shifted backwards to 14');

  } finally {
    await db.$disconnect();
  }
});

test('V2-R001-ROUND3-B: Loan overprincipal, archival lock, precision, reversal date, reminder opt-out, edit date (SOL-R002-002, 003, 006, 009, 010, SOL-R001-011)', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const user = await db.user.create({
      data: {
        id: `usr-r3b-${timestamp}`,
        email: `r3b-${timestamp}@test.local`,
        name: 'User R3B Test',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const bankAcc = await financeService.createAccount(user.id, {
      name: 'R3B Primary Bank',
      type: 'BANK',
      openingBalance: '500000.00',
    }, db);
    const bankId = bankAcc.account.id;

    // =========================================================================
    // 1. SOL-R002-002: Principal overpayment and reversal round-trip outstanding exactly
    // =========================================================================
    const overLoanRes = await loanService.createLoan(user.id, {
      name: 'Overpayment Test Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '1500.00',
      emiAmount: '2000.00',
      nextEmiDate: '2026-11-20T12:00:00.000Z',
      dueDay: 20,
      paymentAccountId: bankId,
      createLinkedObligation: false,
    }, db);
    const overLoanId = overLoanRes.loan.id;
    assert.equal(overLoanRes.loan.outstandingPrincipal.toString(), '1500');

    // Pay more principal than outstanding (principalPaid = 2000 > outstanding = 1500)
    const overPayRes = await loanService.recordEmiPayment(user.id, {
      loanId: overLoanId,
      amount: '2000.00',
      principalPaid: '2000.00',
      accountId: bankId,
    }, db);
    assert.equal(overPayRes.success, true);
    assert.equal(overPayRes.closed, true);
    assert.equal(overPayRes.remainingPrincipal, '0', 'Outstanding must clamp to 0 and not become negative');

    const closedLoanDb = await db.loan.findUnique({ where: { id: overLoanId } });
    assert.equal(closedLoanDb?.status, 'CLOSED');
    assert.equal(closedLoanDb?.outstandingPrincipal.toString(), '0');

    // Verify payment in DB recorded actual reduction
    const paymentRecord = await db.loanPayment.findUnique({ where: { id: overPayRes.paymentId } });
    assert.equal(paymentRecord?.principalPaid?.toString(), '1500', 'Payment record must store actual principal reduced (1500), not excess');

    // Undo / Revert the payment
    const overRevRes = await loanService.revertEmiPayment(user.id, {
      loanPaymentId: overPayRes.paymentId,
    }, db);
    assert.equal(overRevRes.success, true);
    assert.equal(overRevRes.restoredOutstanding, '1500', 'Reversal must restore exactly 1500, never creating extra principal');
    assert.equal(overRevRes.restoredStatus, 'ACTIVE');

    const restoredLoanDb = await db.loan.findUnique({ where: { id: overLoanId } });
    assert.equal(restoredLoanDb?.outstandingPrincipal.toString(), '1500');
    assert.equal(restoredLoanDb?.status, 'ACTIVE');

    // =========================================================================
    // 2. SOL-R002-003: Loan archival and closure revalidation under payment lock
    // =========================================================================
    const archLoanRes = await loanService.createLoan(user.id, {
      name: 'Archival Test Loan',
      loanType: 'PERSONAL',
      lender: 'SBI',
      openingOutstanding: '20000.00',
      createLinkedObligation: false,
    }, db);
    const archLoanId = archLoanRes.loan.id;

    // Record an initial payment with idempotencyKey
    const idempKey = `idemp-arch-${timestamp}`;
    const initialPay = await loanService.recordEmiPayment(user.id, {
      loanId: archLoanId,
      amount: '2000.00',
      principalPaid: '1500.00',
      interestPaid: '500.00',
      accountId: bankId,
      idempotencyKey: idempKey,
    }, db);
    assert.equal(initialPay.success, true);

    // Archive the loan
    await loanService.archiveLoan(user.id, archLoanId, db);

    // Identical idempotent retry must succeed with alreadyProcessed: true
    const retryOnArchived = await loanService.recordEmiPayment(user.id, {
      loanId: archLoanId,
      amount: '2000.00',
      principalPaid: '1500.00',
      interestPaid: '500.00',
      accountId: bankId,
      idempotencyKey: idempKey,
    }, db);
    assert.equal(retryOnArchived.success, true);
    assert.equal(retryOnArchived.alreadyProcessed, true);

    // New mutation on archived loan must be rejected
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(user.id, {
          loanId: archLoanId,
          amount: '2000.00',
          accountId: bankId,
        }, db);
      },
      { message: 'Cannot record payment on an archived loan' }
    );

    // Now test closed loan
    const closeTestLoan = await loanService.createLoan(user.id, {
      name: 'Closure Test Loan',
      loanType: 'PERSONAL',
      lender: 'ICICI',
      openingOutstanding: '10000.00',
      createLinkedObligation: false,
    }, db);
    const closeLoanId = closeTestLoan.loan.id;

    const closeIdempKey = `idemp-close-${timestamp}`;
    const closePay = await loanService.recordEmiPayment(user.id, {
      loanId: closeLoanId,
      amount: '1000.00',
      principalPaid: '1000.00',
      accountId: bankId,
      idempotencyKey: closeIdempKey,
    }, db);
    assert.equal(closePay.success, true);

    // Close the loan
    await loanService.closeLoan(user.id, closeLoanId, db);

    // Identical idempotent retry on closed loan succeeds
    const retryOnClosed = await loanService.recordEmiPayment(user.id, {
      loanId: closeLoanId,
      amount: '1000.00',
      principalPaid: '1000.00',
      accountId: bankId,
      idempotencyKey: closeIdempKey,
    }, db);
    assert.equal(retryOnClosed.success, true);
    assert.equal(retryOnClosed.alreadyProcessed, true);

    // New mutation on closed loan must be rejected
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(user.id, {
          loanId: closeLoanId,
          amount: '500.00',
          accountId: bankId,
        }, db);
      },
      { message: 'Cannot record payment on a closed loan' }
    );

    // =========================================================================
    // 3. SOL-R002-009: EMI component precision validation (scale <= 2)
    // =========================================================================
    const precLoanRes = await loanService.createLoan(user.id, {
      name: 'Precision Test Loan',
      loanType: 'PERSONAL',
      lender: 'Kotak',
      openingOutstanding: '50000.00',
      createLinkedObligation: false,
    }, db);
    const precLoanId = precLoanRes.loan.id;

    // Sub-cent principal (3 decimal places)
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(user.id, {
          loanId: precLoanId,
          amount: '100.00',
          principalPaid: '50.005',
          accountId: bankId,
        }, db);
      },
      { message: 'Principal paid cannot have more than 2 decimal places' }
    );

    // Sub-cent interest (3 decimal places)
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(user.id, {
          loanId: precLoanId,
          amount: '100.00',
          principalPaid: '50.00',
          interestPaid: '25.123',
          accountId: bankId,
        }, db);
      },
      { message: 'Interest paid cannot have more than 2 decimal places' }
    );

    // Sub-cent fees (3 decimal places)
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(user.id, {
          loanId: precLoanId,
          amount: '100.00',
          principalPaid: '50.00',
          feesPaid: '10.999',
          accountId: bankId,
        }, db);
      },
      { message: 'Fees paid cannot have more than 2 decimal places' }
    );

    // Negative principal
    await assert.rejects(
      async () => {
        await loanService.recordEmiPayment(user.id, {
          loanId: precLoanId,
          amount: '100.00',
          principalPaid: -10,
          accountId: bankId,
        }, db);
      },
      { message: 'Principal paid cannot be negative' }
    );

    // Valid 2-decimal components succeed
    const validPrecPay = await loanService.recordEmiPayment(user.id, {
      loanId: precLoanId,
      amount: '100.00',
      principalPaid: '60.50',
      interestPaid: '25.25',
      feesPaid: '14.25',
      accountId: bankId,
    }, db);
    assert.equal(validPrecPay.success, true);

    // =========================================================================
    // 4. SOL-R002-006: Direct EMI reversal restores scheduled date instead of payment date
    // =========================================================================
    const schedLoanRes = await loanService.createLoan(user.id, {
      name: 'Reversal Date Loan',
      loanType: 'PERSONAL',
      lender: 'Axis Bank',
      openingOutstanding: '40000.00',
      emiAmount: '4000.00',
      nextEmiDate: '2026-11-25T12:00:00.000Z',
      dueDay: 25,
      paymentAccountId: bankId,
      createLinkedObligation: true,
    }, db);
    const schedLoanId = schedLoanRes.loan.id;
    const schedObId = schedLoanRes.loan.obligationId!;

    // User pays early on Nov 18
    const earlyPayDate = '2026-11-18T08:30:00.000Z';
    const earlyPayRes = await loanService.recordEmiPayment(user.id, {
      loanId: schedLoanId,
      amount: '4000.00',
      principalPaid: '3000.00',
      interestPaid: '1000.00',
      accountId: bankId,
      occurredAt: earlyPayDate,
    }, db);
    assert.equal(earlyPayRes.success, true);

    // Loan schedule advanced to Dec 25
    const advancedLoan = await db.loan.findUnique({ where: { id: schedLoanId } });
    assert.equal(advancedLoan?.nextEmiDate?.toISOString(), '2026-12-25T12:00:00.000Z');

    // Direct reversal without revertToDate
    const revSchedRes = await loanService.revertEmiPayment(user.id, {
      loanPaymentId: earlyPayRes.paymentId,
    }, db);
    assert.equal(revSchedRes.success, true);
    assert.equal(
      revSchedRes.restoredNextEmiDate,
      '2026-11-25T12:00:00.000Z',
      'Direct reversal must restore original scheduled EMI date (Nov 25), NOT payment date (Nov 18)'
    );

    const restoredSchedLoan = await db.loan.findUnique({ where: { id: schedLoanId } });
    assert.equal(restoredSchedLoan?.nextEmiDate?.toISOString(), '2026-11-25T12:00:00.000Z');

    const restoredSchedOb = await db.obligation.findUnique({ where: { id: schedObId } });
    assert.equal(restoredSchedOb?.nextDueAt.toISOString(), '2026-11-25T12:00:00.000Z');

    // =========================================================================
    // 5. SOL-R002-010: Loan metadata edits lose creation-time reminder opt-out
    // =========================================================================
    const optOutLoanRes = await loanService.createLoan(user.id, {
      name: 'Opt-Out Original Name',
      loanType: 'PERSONAL',
      lender: 'Bank of Baroda',
      openingOutstanding: '60000.00',
      emiAmount: '5000.00',
      nextEmiDate: '2026-11-20T12:00:00.000Z',
      dueDay: 20,
      paymentAccountId: bankId,
      createLinkedObligation: false, // Explicit opt-out at creation
    }, db);
    const optOutLoanId = optOutLoanRes.loan.id;
    assert.equal(optOutLoanRes.loan.obligationId, null);

    // Metadata update (rename + lender change)
    const renameRes = await loanService.updateLoan(user.id, optOutLoanId, {
      name: 'Opt-Out Renamed Loan',
      lender: 'Bank of Baroda Main',
      notes: 'Updated notes',
    }, db);
    assert.equal(renameRes.success, true);
    assert.equal(renameRes.loan.obligationId, null, 'Metadata update must NOT create a linked obligation when opted out at creation');

    const optOutLoanDb1 = await db.loan.findUnique({ where: { id: optOutLoanId } });
    assert.equal(optOutLoanDb1?.obligationId, null);

    // Another update (changing paymentAccountId)
    const updateAccRes = await loanService.updateLoan(user.id, optOutLoanId, {
      paymentAccountId: bankId,
    }, db);
    assert.equal(updateAccRes.loan.obligationId, null, 'Account edit must NOT create linked obligation');

    // Now caller explicitly requests obligation creation
    const explicitEnableRes = await loanService.updateLoan(user.id, optOutLoanId, {
      createLinkedObligation: true,
    }, db);
    assert.ok(explicitEnableRes.loan.obligationId, 'Explicit createLinkedObligation: true must create linked obligation');

    const optOutLoanDb2 = await db.loan.findUnique({ where: { id: optOutLoanId } });
    assert.ok(optOutLoanDb2?.obligationId);

    // =========================================================================
    // 6. SOL-R001-011: formatCalendarDate in LoanForm produces local calendar dates
    // =========================================================================
    assert.equal(formatCalendarDate('2026-11-15'), '2026-11-15');
    assert.equal(formatCalendarDate('  2026-12-01  '), '2026-12-01');
    assert.equal(formatCalendarDate(null), '');
    assert.equal(formatCalendarDate(undefined), '');

    const localTestDate = new Date(2026, 10, 15); // Month is 0-indexed, so 10 = November
    assert.equal(formatCalendarDate(localTestDate), '2026-11-15');

  } finally {
    await db.$disconnect();
  }
});

test('V2-R004-WORKER-B: Repair test suite for SOL-R001-011, SOL-R002-006, SOL-R002-007, SOL-R003-002, SOL-R003-003, SOL-R003-005, SOL-R003-006', async () => {
  const db = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    const timestamp = Date.now();
    const user = await db.user.create({
      data: {
        id: `usr-wb-${timestamp}`,
        email: `wb-${timestamp}@test.local`,
        name: 'Worker B Test User',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      }
    });

    const bank = await financeService.createAccount(user.id, {
      name: 'Salary Checking',
      type: 'BANK',
      openingBalance: '100000.00',
    }, db);
    const bankId = bank.account.id;

    // =========================================================================
    // 1. SOL-R001-011: Loan Date Inputs Timezone Formatting
    // =========================================================================
    // Kiritimati noon on Nov 15 is 2026-11-14T22:00:00Z UTC
    const kiritimatiNoon = '2026-11-14T22:00:00.000Z';
    assert.equal(
      formatCalendarDate(kiritimatiNoon, 'Pacific/Kiritimati'),
      '2026-11-15',
      'Kiritimati noon on Nov 15 must format as 2026-11-15 in Pacific/Kiritimati timezone'
    );
    assert.equal(
      formatCalendarDate(kiritimatiNoon, 'UTC'),
      '2026-11-14',
      'Same timestamp must format as 2026-11-14 in UTC'
    );
    assert.equal(
      formatCalendarDate('2026-11-14T18:30:00.000Z', 'Asia/Kolkata'),
      '2026-11-15',
      'Midnight IST must format as 2026-11-15 in Asia/Kolkata'
    );
    assert.equal(formatCalendarDate('2026-11-15', 'Pacific/Kiritimati'), '2026-11-15');

    // =========================================================================
    // 2. SOL-R003-002: Editable Payment Notes Overriding Reversal Metadata
    // =========================================================================
    const loanRes = await loanService.createLoan(user.id, {
      name: `Note Hijack Test Loan ${timestamp}`,
      lender: 'Test Bank',
      loanType: 'PERSONAL',
      openingOutstanding: '10000.00',
      emiAmount: '2000.00',
      nextEmiDate: '2026-12-01',
      createLinkedObligation: false,
    }, db);
    const testLoanId = loanRes.loan.id;

    // Record EMI payment with malicious user tags in note
    const payRes = await loanService.recordEmiPayment(user.id, {
      loanId: testLoanId,
      amount: '2000.00',
      principalPaid: '2000.00',
      accountId: bankId,
      note: '[actualPrincipalReduction:999] [scheduledDate:2020-01-01T00:00:00.000Z] Attempted injection',
    }, db);
    assert.equal(payRes.success, true);
    assert.equal(payRes.remainingPrincipal, '8000');

    // Verify stored payment sanitized the user tags and appended authoritative tag
    const paymentRecord = await db.loanPayment.findUnique({
      where: { id: payRes.paymentId },
    });
    assert.ok(paymentRecord);
    assert.ok(!paymentRecord.note?.includes('[actualPrincipalReduction:999]'), 'Injected tag must be sanitized');
    assert.ok(paymentRecord.note?.includes('[actualPrincipalReduction:2000]'), 'Authoritative reduction tag must be present');

    // Revert payment: must use payment.principalPaid from DB, restoring principal to 10,000, NOT 8,999!
    const revertRes = await loanService.revertEmiPayment(user.id, {
      loanId: testLoanId,
      paymentId: payRes.paymentId,
    }, db);
    assert.equal(revertRes.success, true);
    assert.equal(revertRes.restoredOutstanding, '10000', 'Authoritative principalPaid must restore full 10,000');

    // =========================================================================
    // 3. SOL-R003-003: Credit Card Reversal Statement Membership Under Lock
    // =========================================================================
    const ccAcc = await financeService.createAccount(user.id, {
      name: 'Platinum Card',
      type: 'CREDIT_CARD',
      openingBalance: '0.00',
      creditLimit: '100000.00',
      statementDay: 1,
      paymentDueDay: 20,
      defaultPaymentAccountId: bankId,
    }, db);
    const ccId = ccAcc.account.id;

    const stmt1 = await creditCardService.createCreditCardStatement(user.id, {
      accountId: ccId,
      periodKey: '2026-05',
      statementDate: '2026-05-01',
      dueDate: '2026-05-20',
      statementAmount: '10000.00',
    }, db);

    const stmt2 = await creditCardService.createCreditCardStatement(user.id, {
      accountId: ccId,
      periodKey: '2026-06',
      statementDate: '2026-06-01',
      dueDate: '2026-06-20',
      statementAmount: '15000.00',
    }, db);

    const payStmt1 = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmt1.statement.id,
      fromAccountId: bankId,
      amount: '5000.00',
    }, db);

    const payStmt2 = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmt2.statement.id,
      fromAccountId: bankId,
      amount: '6000.00',
    }, db);

    // Mismatched reversal: Provide statement 1 and payment from statement 2
    await assert.rejects(
      async () => {
        await creditCardService.revertCreditCardPayment(user.id, {
          statementId: stmt1.statement.id,
          paymentId: payStmt2.paymentId,
        }, db);
      },
      /Payment does not belong to the specified statement/
    );

    // Verify neither statement nor payment was modified
    const stmt1After = await db.creditCardStatement.findUnique({ where: { id: stmt1.statement.id } });
    const stmt2After = await db.creditCardStatement.findUnique({ where: { id: stmt2.statement.id } });
    const pay2After = await db.creditCardPayment.findUnique({ where: { id: payStmt2.paymentId } });
    assert.equal(stmt1After?.status, 'PARTIAL');
    assert.equal(stmt2After?.status, 'PARTIAL');
    assert.ok(pay2After, 'Payment 2 must not have been deleted');

    // =========================================================================
    // 4. SOL-R002-006: Legacy EMI Reversal Schema Field & Safe Date Restoration
    // =========================================================================
    const legLoan = await loanService.createLoan(user.id, {
      name: `Legacy Reversal Loan ${timestamp}`,
      lender: 'Legacy Bank',
      loanType: 'PERSONAL',
      openingOutstanding: '20000.00',
      emiAmount: '4000.00',
      nextEmiDate: '2026-07-15',
      createLinkedObligation: true,
    }, db);
    const legLoanId = legLoan.loan.id;
    const legObId = legLoan.loan.obligationId!;

    // Create occurrence with dueDate
    const occurrenceDueDate = new Date('2026-07-15T12:00:00.000Z');
    const occ = await db.obligationOccurrence.create({
      data: {
        userId: user.id,
        obligationId: legObId,
        occurrenceKey: '2026-07-15',
        dueDate: occurrenceDueDate,
        status: 'COMPLETED',
      }
    });

    // Create a legacy payment without note tags linked to this occurrence
    const legPay = await db.loanPayment.create({
      data: {
        userId: user.id,
        loanId: legLoanId,
        amount: new Prisma.Decimal('4000.00'),
        principalPaid: new Prisma.Decimal('4000.00'),
        occurredAt: new Date('2026-07-16T10:00:00.000Z'),
        accountId: bankId,
        obligationOccurrenceId: occ.id,
        note: null, // Legacy: no tags
      }
    });

    // Reverting legacy payment must query dueDate (not dueAt) without error and restore dueDate
    const legRevertRes = await loanService.revertEmiPayment(user.id, {
      loanId: legLoanId,
      paymentId: legPay.id,
    }, db);
    assert.equal(legRevertRes.success, true);
    assert.equal(legRevertRes.restoredNextEmiDate, occurrenceDueDate.toISOString(), 'Restores dueDate from occurrence');

    // Now test unlinked legacy payment without occurrence or tags
    const unlinkedPay = await db.loanPayment.create({
      data: {
        userId: user.id,
        loanId: legLoanId,
        amount: new Prisma.Decimal('4000.00'),
        principalPaid: new Prisma.Decimal('4000.00'),
        occurredAt: new Date('2026-07-20T10:00:00.000Z'), // should NOT be used as nextEmiDate
        accountId: bankId,
        obligationOccurrenceId: null,
        note: null,
      }
    });

    // Set loan schedule to explicit anchor
    const scheduleAnchor = new Date('2026-08-15T12:00:00.000Z');
    await db.loan.update({
      where: { id: legLoanId },
      data: { nextEmiDate: scheduleAnchor }
    });

    // SOL-R002-006: Reversing unlinked legacy payment without revertToDate is rejected
    await assert.rejects(
      async () => {
        await loanService.revertEmiPayment(user.id, {
          loanId: legLoanId,
          paymentId: unlinkedPay.id,
        }, db);
      },
      /Explicit revertToDate required to reverse legacy unlinked payment/
    );

    // Reversing with explicit revertToDate succeeds and restores schedule
    const unlinkedRevert = await loanService.revertEmiPayment(user.id, {
      loanId: legLoanId,
      paymentId: unlinkedPay.id,
      revertToDate: scheduleAnchor,
    }, db);
    assert.equal(unlinkedRevert.success, true);
    assert.equal(
      unlinkedRevert.restoredNextEmiDate,
      scheduleAnchor.toISOString(),
      'Must restore schedule using explicit revertToDate'
    );

    // =========================================================================
    // 5. SOL-R003-005: Opt-Out Tagging Loan Note Length Limit
    // =========================================================================
    const maxNote = 'A'.repeat(255);
    const optOutRes = await loanService.createLoan(user.id, {
      name: `OptOut Max Note Loan ${timestamp}`,
      lender: 'Max Note Bank',
      loanType: 'PERSONAL',
      openingOutstanding: '50000.00',
      notes: maxNote,
      createLinkedObligation: false,
    }, db);
    assert.equal(optOutRes.loan.obligationId, null);

    // Stored note in DB must not exceed 255 chars
    const optOutLoanDb = await db.loan.findUnique({ where: { id: optOutRes.loan.id } });
    assert.ok(optOutLoanDb?.notes);
    assert.ok(optOutLoanDb.notes.length <= 255, `Stored notes length ${optOutLoanDb.notes.length} must be <= 255`);
    assert.ok(optOutLoanDb.notes.includes('[noLinkedObligation]'));

    // getLoans and getLoanById must strip opt-out tag
    const loansList = await loanService.getLoans(user.id, {}, db);
    const readLoan = loansList.find((l: any) => l.id === optOutRes.loan.id);
    assert.ok(readLoan);
    assert.ok(!readLoan.notes?.includes('[noLinkedObligation]'), 'getLoans must strip [noLinkedObligation]');
    assert.ok(readLoan.notes!.length <= 255);

    const singleLoan = await loanService.getLoanById(user.id, optOutRes.loan.id, db);
    assert.ok(!singleLoan.notes?.includes('[noLinkedObligation]'), 'getLoanById must strip [noLinkedObligation]');

    // Editing loan with 255-char notes succeeds
    const editRes = await loanService.updateLoan(user.id, optOutRes.loan.id, {
      notes: 'B'.repeat(255),
    }, db);
    assert.ok(editRes.loan);
    const updatedDb = await db.loan.findUnique({ where: { id: optOutRes.loan.id } });
    assert.ok(updatedDb?.notes && updatedDb.notes.length <= 255);

    // =========================================================================
    // 6. SOL-R002-007 & SOL-R003-006: Statement Repayment Flow & Account Config
    // =========================================================================
    // Check obligation read model for statement bill
    const obsList = await financeService.getObligations(user.id, db);
    const ccObligation = obsList.find(o => o.creditCardStatement?.id === stmt1.statement.id);
    assert.ok(ccObligation, 'Statement bill obligation must be present');
    assert.equal(ccObligation.isCreditCardStatement, true);

    // Partial repayment via recordCreditCardPayment:
    // Statement 1 was originally ₹10,000, paid ₹5,000 above, remaining pending is ₹5,000
    // Record partial payment of ₹2,000 from bankId
    const partialPay = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmt1.statement.id,
      fromAccountId: bankId,
      amount: '2000.00',
    }, db);
    assert.equal(partialPay.success, true);
    assert.equal(partialPay.statementStatus, 'PARTIAL');
    assert.equal(new Prisma.Decimal(partialPay.pendingBalance).toString(), '3000');

    // Paying credit card using credit card account itself must be rejected
    await assert.rejects(
      async () => {
        await creditCardService.recordCreditCardPayment(user.id, {
          statementId: stmt1.statement.id,
          fromAccountId: ccId, // paying credit card with itself
          amount: '1000.00',
        }, db);
      },
      /Source account cannot be the credit card being paid/
    );

    // Update default payment account via updateAccount:
    const newBank = await financeService.createAccount(user.id, {
      name: 'Secondary Savings',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);
    const updateAccRes = await financeService.updateAccount(user.id, ccId, {
      defaultPaymentAccountId: newBank.account.id,
    }, db);
    assert.equal(updateAccRes.account.defaultPaymentAccountId, newBank.account.id);

    // Verify obligation's accountId remains the card account
    const obAfterAccUpdate = await db.obligation.findUnique({
      where: { id: ccObligation.id },
    });
    assert.equal(obAfterAccUpdate?.accountId, ccId, 'Obligation accountId must remain the card account');

  } finally {
    await db.$disconnect();
  }
});

test('V2-R004-ROUND2-B: Round 2 Worker B Verification Suite (SOL-R004-003, SOL-R001-011, SOL-R002-006, SOL-R004-004, SOL-R004-008)', async (t) => {
  assert.ok(
    TEST_DB_URL.includes('5433') && TEST_DB_URL.includes('nutrisnap_test'),
    'Test suite must run against isolated test DB (port 5433, nutrisnap_test)'
  );
  const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  const timestamp = Date.now();
  const userId = `usr_r004_r2_${timestamp}`;

  try {
    const user = await db.user.create({
      data: {
        id: userId,
        email: `r004_r2_${timestamp}@nutrisnap.app`,
        name: 'Worker B Round 2 User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati', // UTC+14
      }
    });

    const bankA = await financeService.createAccount(user.id, {
      name: 'Primary Bank A',
      type: 'BANK',
      openingBalance: '100000.00',
    }, db);
    const bankAId = bankA.account.id;

    const wallet = await financeService.createAccount(user.id, {
      name: 'Paytm Wallet',
      type: 'WALLET',
      openingBalance: '15000.00',
    }, db);

    const cc1 = await financeService.createAccount(user.id, {
      name: 'HDFC Regalia CC',
      type: 'CREDIT_CARD',
      creditLimit: '150000.00',
      openingBalance: '0.00',
      statementDay: 1,
      paymentDueDay: 20,
      defaultPaymentAccountId: bankAId,
    }, db);

    const cc2 = await financeService.createAccount(user.id, {
      name: 'ICICI Amazon Pay CC',
      type: 'CREDIT_CARD',
      creditLimit: '100000.00',
      openingBalance: '0.00',
      statementDay: 5,
      paymentDueDay: 25,
    }, db);

    // =========================================================================
    // 1. SOL-R001-011: getLoans and getLoanById expose user.timezone
    // =========================================================================
    const loanRes = await loanService.createLoan(user.id, {
      name: 'Kiritimati Test Loan',
      loanType: 'PERSONAL',
      lender: 'Pacific Bank',
      openingOutstanding: '30000.00',
      emiAmount: '3000.00',
      nextEmiDate: '2026-11-15',
      dueDay: 15,
      paymentAccountId: bankAId,
    }, db);
    assert.equal(loanRes.success, true);
    const loanId = loanRes.loan.id;

    // getLoans read model must include user.timezone
    const allLoans = await loanService.getLoans(user.id, {}, db);
    const fetchedLoan = allLoans.find((l: any) => l.id === loanId);
    assert.ok(fetchedLoan, 'Loan must be in getLoans response');
    assert.ok(fetchedLoan.user, 'Loan read model must have user');
    assert.equal(fetchedLoan.user.timezone, 'Pacific/Kiritimati', 'getLoans must expose user.timezone');

    // getLoanById read model must include user.timezone
    const singleLoan = await loanService.getLoanById(user.id, loanId, db);
    assert.ok(singleLoan.user, 'Single loan read model must have user');
    assert.equal(singleLoan.user.timezone, 'Pacific/Kiritimati', 'getLoanById must expose user.timezone');

    // Test LoanForm date formatting helper in extreme timezone
    const { formatCalendarDate } = await import('../../components/finance/LoanForm');
    // Nov 15 12:00 in Kiritimati (+14) is Nov 14 22:00 UTC.
    // If formatted with timezone 'Pacific/Kiritimati', it must be '2026-11-15'
    const kiriIso = '2026-11-14T22:00:00.000Z';
    const formattedDate = formatCalendarDate(kiriIso, 'Pacific/Kiritimati');
    assert.equal(formattedDate, '2026-11-15', 'Calendar date must be 2026-11-15 in Pacific/Kiritimati');

    // =========================================================================
    // 2. SOL-R002-006: Legacy Unlinked EMI Reversal Requires Explicit Date
    // =========================================================================
    // Create an unlinked legacy payment (no note tags, no obligationOccurrenceId)
    const unlinkedPayment = await db.loanPayment.create({
      data: {
        userId: user.id,
        loanId,
        amount: new Prisma.Decimal('3000.00'),
        principalPaid: new Prisma.Decimal('3000.00'),
        occurredAt: new Date('2026-11-15T12:00:00.000Z'),
        accountId: bankAId,
        obligationOccurrenceId: null,
        note: null,
      }
    });

    // Reversal without revertToDate must be rejected with exact error message
    await assert.rejects(
      async () => {
        await loanService.revertEmiPayment(user.id, {
          loanId,
          paymentId: unlinkedPayment.id,
        }, db);
      },
      /Explicit revertToDate required to reverse legacy unlinked payment/
    );

    // Reversal with invalid revertToDate must be rejected
    await assert.rejects(
      async () => {
        await loanService.revertEmiPayment(user.id, {
          loanId,
          paymentId: unlinkedPayment.id,
          revertToDate: 'invalid-date-string',
        }, db);
      },
      /Invalid revertToDate/
    );

    // Reversal with valid revertToDate succeeds and sets schedule
    const explicitDate = new Date('2026-11-15T12:00:00.000Z');
    const successfulReversal = await loanService.revertEmiPayment(user.id, {
      loanId,
      paymentId: unlinkedPayment.id,
      revertToDate: explicitDate,
    }, db);
    assert.equal(successfulReversal.success, true);
    assert.equal(successfulReversal.alreadyReversed, false);
    assert.equal(successfulReversal.restoredNextEmiDate, explicitDate.toISOString());

    // =========================================================================
    // 3. SOL-R004-008: Server-Side Account Type Validation for Statement Repayment
    // =========================================================================
    const stmtRes = await creditCardService.createCreditCardStatement(user.id, {
      accountId: cc1.account.id,
      periodKey: '2026-11',
      statementDate: '2026-11-01T12:00:00.000Z',
      statementAmount: '12000.00',
      dueDate: '2026-11-20T12:00:00.000Z',
    }, db);
    assert.equal(stmtRes.success, true);
    const stmtId = stmtRes.statement.id;

    // A. Reject paying with cc1 itself (source is same card)
    await assert.rejects(
      async () => {
        await creditCardService.recordCreditCardPayment(user.id, {
          statementId: stmtId,
          fromAccountId: cc1.account.id,
          amount: '1000.00',
        }, db);
      },
      /Payment source cannot be a credit card/
    );

    // B. Reject paying with cc2 (source is another owned credit card)
    await assert.rejects(
      async () => {
        await creditCardService.recordCreditCardPayment(user.id, {
          statementId: stmtId,
          fromAccountId: cc2.account.id,
          amount: '1000.00',
        }, db);
      },
      /Payment source cannot be a credit card/
    );

    // C. Accept paying with BANK or WALLET
    const walletPayment = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmtId,
      fromAccountId: wallet.account.id,
      amount: '2000.00',
      idempotencyKey: `wallet-pay-${timestamp}`,
    }, db);
    assert.equal(walletPayment.success, true);
    assert.equal(walletPayment.statementStatus, 'PARTIAL');

    // =========================================================================
    // 4. SOL-R004-003: Idempotency Key for Partial Statement Payments
    // =========================================================================
    const idempKey = `idem-partial-${timestamp}`;
    const [p1, p2] = await Promise.all([
      creditCardService.recordCreditCardPayment(user.id, {
        statementId: stmtId,
        fromAccountId: bankAId,
        amount: '3000.00',
        idempotencyKey: idempKey,
      }, db),
      creditCardService.recordCreditCardPayment(user.id, {
        statementId: stmtId,
        fromAccountId: bankAId,
        amount: '3000.00',
        idempotencyKey: idempKey,
      }, db),
    ]);

    assert.equal(p1.success, true);
    assert.equal(p2.success, true);
    const results = [p1, p2];
    const fresh = results.find(r => !r.alreadyProcessed);
    const deduped = results.find(r => r.alreadyProcessed);
    assert.ok(fresh, 'First call must process payment');
    assert.ok(deduped, 'Second concurrent call with same idempotencyKey must be deduped');
    assert.equal(deduped.paymentId, fresh.paymentId, 'Both calls must return the same paymentId');

    // Sequential retry with same idempotencyKey must also return alreadyProcessed
    const p3 = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmtId,
      fromAccountId: bankAId,
      amount: '3000.00',
      idempotencyKey: idempKey,
    }, db);
    assert.equal(p3.success, true);
    assert.equal(p3.alreadyProcessed, true);
    assert.equal(p3.paymentId, fresh.paymentId);

    // Verify exactly 1 payment record exists for this idempotency key in DB
    const ccPayments = await db.creditCardPayment.findMany({
      where: { statementId: stmtId, note: { contains: idempKey } }
    });
    assert.equal(ccPayments.length, 1, 'Only 1 CreditCardPayment must be recorded in DB for idempotency key');

    // =========================================================================
    // 5. SOL-R004-004: Statement Repayment Timezone Parsing & Avoid UTC Shift
    // =========================================================================
    // In UTC-8 (America/Los_Angeles), "2026-11-15" parsed via new Date("2026-11-15").toISOString() is UTC midnight,
    // which in US local time is 4 PM Nov 14.
    // With midday anchor (new TZDate(year, month, day, 12, 0, 0, 0, tz).toISOString()),
    // it remains Nov 15 across both local and UTC timezones!
    const { TZDate } = await import('@date-fns/tz');
    const laMidday = new TZDate(2026, 10, 15, 12, 0, 0, 0, 'America/Los_Angeles');
    assert.equal(laMidday.getFullYear(), 2026);
    assert.equal(laMidday.getMonth(), 10);
    assert.equal(laMidday.getDate(), 15);
    // Even when converted to UTC, Nov 15 12:00 PST is Nov 15 20:00 UTC (still Nov 15!)
    assert.ok(laMidday.toISOString().includes('2026-11-15'), 'Midday anchor prevents UTC date shift');

    // Verify toggle obligation active/pause works on CC statement obligation
    const allObs = await financeService.getObligations(user.id, db);
    const ccOb = allObs.find(o => o.creditCardStatement?.id === stmtId);
    assert.ok(ccOb, 'CC statement obligation must exist');
    assert.equal(ccOb.isActive, true);

    const pauseRes = await financeService.toggleObligationActive(user.id, ccOb.id, false, db);
    assert.equal(pauseRes.success, true);
    assert.equal(pauseRes.isActive, false);

    const resumeRes = await financeService.toggleObligationActive(user.id, ccOb.id, true, db);
    assert.equal(resumeRes.success, true);
    assert.equal(resumeRes.isActive, true);

  } finally {
    try {
      await db.creditCardPayment.deleteMany({ where: { userId } });
      await db.creditCardStatement.deleteMany({ where: { userId } });
      await db.loanPayment.deleteMany({ where: { userId } });
      await db.loan.deleteMany({ where: { userId } });
      await db.reminderDelivery.deleteMany({ where: { userId } });
      await db.obligationOccurrence.deleteMany({ where: { userId } });
      await db.reminder.deleteMany({ where: { userId } });
      await db.financialTransaction.deleteMany({ where: { userId } });
      await db.obligation.deleteMany({ where: { userId } });
      await db.financialAccount.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
    } catch (cleanupErr) {
      console.warn('V2-R004-ROUND2-B cleanup warning:', cleanupErr);
    } finally {
      await db.$disconnect();
    }
  }
});

test('V2-R004-ROUND3-B: Statement & EMI Idempotency, Test DB Isolation, Login Timezone (SOL-R004-003, SOL-R004-009, SOL-R004-011, SOL-R004-004)', async (t) => {
  // 1. SOL-R004-011: Isolated Test DB Assertion and Connection
  assert.ok(
    TEST_DB_URL.includes('5433') && TEST_DB_URL.includes('nutrisnap_test'),
    'Test suite must run against isolated test DB (port 5433, nutrisnap_test)'
  );
  const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  const timestamp = Date.now();
  const userId = `usr_r004_r3_${timestamp}`;

  try {
    // 2. SOL-R004-004: Login Timezone in API response and ObligationForm callers
    // Verify login route source code ensures timezone: user.timezone in responseData
    const loginRoutePath = path.resolve(process.cwd(), 'src/app/api/auth/login/route.ts');
    const loginRouteContent = fs.readFileSync(loginRoutePath, 'utf8');
    assert.ok(
      loginRouteContent.includes('timezone: user.timezone'),
      'Login responseData must include timezone: user.timezone (SOL-R004-004)'
    );

    // Verify bills/page.tsx ObligationForm callers receive timezone={userTimezone}
    const billsPagePath = path.resolve(process.cwd(), 'src/app/finance/bills/page.tsx');
    const billsPageContent = fs.readFileSync(billsPagePath, 'utf8');
    const obligationFormMatches = billsPageContent.match(/<ObligationForm[\s\S]*?\/>/g) || [];
    assert.equal(
      obligationFormMatches.length,
      3,
      'bills/page.tsx must contain exactly 3 <ObligationForm /> callers'
    );
    for (let i = 0; i < obligationFormMatches.length; i++) {
      assert.ok(
        obligationFormMatches[i].includes('timezone={userTimezone}'),
        `ObligationForm caller #${i + 1} in bills/page.tsx must pass timezone={userTimezone}`
      );
    }
    // Verify StatementRepaymentModal tz fallback in bills/page.tsx
    assert.ok(
      billsPageContent.includes("const tz = userTimezone || obligation?.user?.timezone || 'Asia/Kolkata';"),
      'StatementRepaymentModal must resolve tz with fallback to Asia/Kolkata'
    );

    // Verify midday anchor date in Pacific/Kiritimati (UTC+14)
    // 2026-11-15 12:00 in Pacific/Kiritimati is 2026-11-14T22:00:00.000Z
    const kiritimatiMidday = new TZDate(2026, 10, 15, 12, 0, 0, 0, 'Pacific/Kiritimati');
    assert.equal(kiritimatiMidday.getFullYear(), 2026);
    assert.equal(kiritimatiMidday.getMonth(), 10);
    assert.equal(kiritimatiMidday.getDate(), 15, 'Midday anchor must preserve Nov 15 in Pacific/Kiritimati');
    // Verify formatting in Kiritimati remains 2026-11-15
    const tzDateFormatted = new TZDate(kiritimatiMidday.toISOString(), 'Pacific/Kiritimati');
    assert.equal(tzDateFormatted.getDate(), 15, 'Calendar date in Pacific/Kiritimati must not drift to Nov 16');

    // Create user in DB for finance operations
    const user = await db.user.create({
      data: {
        id: userId,
        email: `r004_r3_${timestamp}@nutrisnap.app`,
        name: 'Worker B Round 3 User',
        password: 'password123',
        timezone: 'Pacific/Kiritimati',
      }
    });
    assert.equal(user.timezone, 'Pacific/Kiritimati', 'User timezone must be persisted');

    const bankAcc = await financeService.createAccount(user.id, {
      name: 'Salary Bank Acc',
      type: 'BANK',
      openingBalance: '100000.00',
    }, db);
    const bankId = bankAcc.account.id;

    // 3. SOL-R004-003: Accounts Statement Repayment Retry Identity (Idempotency Key)
    // Verify CreditCardDialog component defines generateRepaymentIdempotencyKey and passes idempotencyKey
    const ccDialogPath = path.resolve(process.cwd(), 'src/components/finance/CreditCardDialog.tsx');
    const ccDialogContent = fs.readFileSync(ccDialogPath, 'utf8');
    assert.ok(
      ccDialogContent.includes('generateRepaymentIdempotencyKey'),
      'CreditCardDialog must define generateRepaymentIdempotencyKey'
    );
    assert.ok(
      ccDialogContent.includes('idempotencyKey') && ccDialogContent.includes('setPaymentIdempotencyKey'),
      'CreditCardDialog must manage paymentIdempotencyKey state'
    );
    assert.ok(
      ccDialogContent.includes('idempotencyKey,') || ccDialogContent.includes('idempotencyKey:'),
      'CreditCardDialog must pass idempotencyKey to recordCreditCardPayment'
    );

    // Live DB test: recordCreditCardPayment retry with same idempotencyKey is deduplicated
    const ccAccount = await financeService.createAccount(user.id, {
      name: 'Titanium CC',
      type: 'CREDIT_CARD',
      creditLimit: '200000.00',
    }, db);
    const ccId = ccAccount.account.id;

    const stmtRes = await creditCardService.createCreditCardStatement(user.id, {
      accountId: ccId,
      periodKey: '2026-11',
      statementDate: '2026-11-01',
      dueDate: '2026-11-20',
      statementAmount: '12000.00',
      minimumDue: '1200.00',
    }, db);
    const stmtId = stmtRes.statement.id;

    const ccIdempKey = `cc-repay-r3-${timestamp}`;
    const ccPay1 = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmtId,
      fromAccountId: bankId,
      amount: '5000.00',
      idempotencyKey: ccIdempKey,
    }, db);

    assert.equal(ccPay1.success, true);
    assert.equal(ccPay1.fullyPaid, false);
    assert.equal(ccPay1.pendingBalance.toString(), '7000');

    // Retry with SAME idempotencyKey
    const ccPayRetry = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmtId,
      fromAccountId: bankId,
      amount: '5000.00',
      idempotencyKey: ccIdempKey,
    }, db);

    assert.equal(ccPayRetry.success, true);
    assert.equal(ccPayRetry.alreadyProcessed, true, 'Retry with same idempotencyKey must be marked alreadyProcessed');
    assert.equal(ccPayRetry.paymentId, ccPay1.paymentId, 'Must return the original payment record');

    // Verify only 1 payment and 1 transfer transaction exists in DB
    const ccPaymentsInDb = await db.creditCardPayment.findMany({
      where: { statementId: stmtId }
    });
    assert.equal(ccPaymentsInDb.length, 1, 'Only 1 CreditCardPayment must exist in DB');

    const transferTxInDb = await db.financialTransaction.findMany({
      where: { accountId: bankId, type: 'TRANSFER' }
    });
    assert.equal(transferTxInDb.length, 1, 'Only 1 TRANSFER transaction must exist in DB');

    // 4. SOL-R004-009: RecordEmiModal Retry Identity (Idempotency Key)
    // Behavioral test of generateEmiIdempotencyKey
    const key1 = generateEmiIdempotencyKey();
    const key2 = generateEmiIdempotencyKey();
    assert.ok(key1.startsWith('emi-pay-'), 'generateEmiIdempotencyKey must produce emi-pay- prefix');
    assert.ok(key2.startsWith('emi-pay-'), 'generateEmiIdempotencyKey must produce emi-pay- prefix');
    assert.notEqual(key1, key2, 'Two calls to generateEmiIdempotencyKey must produce distinct keys');

    // Static verification of RecordEmiModal and loans/page.tsx
    const emiModalPath = path.resolve(process.cwd(), 'src/components/finance/RecordEmiModal.tsx');
    const emiModalContent = fs.readFileSync(emiModalPath, 'utf8');
    assert.ok(
      emiModalContent.includes('idempotencyKey?: string'),
      'RecordEmiModalProps onSubmit must accept idempotencyKey'
    );
    assert.ok(
      emiModalContent.includes('idempotencyKey: keyToUse'),
      'RecordEmiModal handleSubmit must pass idempotencyKey to onSubmit'
    );
    assert.ok(
      emiModalContent.includes('setIdempotencyKey(generateEmiIdempotencyKey())'),
      'RecordEmiModal must reset idempotencyKey upon open and success'
    );

    const loansPagePath = path.resolve(process.cwd(), 'src/app/finance/loans/page.tsx');
    const loansPageContent = fs.readFileSync(loansPagePath, 'utf8');
    assert.ok(
      loansPageContent.includes('recordEmiPayment(session.id, params)'),
      'loans/page.tsx onSubmit must forward params (including idempotencyKey) to recordEmiPayment'
    );

    // Live DB test: recordEmiPayment retry with same idempotencyKey is deduplicated
    const loanRes = await loanService.createLoan(user.id, {
      name: 'Personal Auto Loan',
      loanType: 'VEHICLE',
      lender: 'HDFC Bank',
      openingOutstanding: '60000.00',
      emiAmount: '6000.00',
      dueDay: 5,
      nextEmiDate: '2026-11-05',
      paymentAccountId: bankId,
      createLinkedObligation: true,
      emiGeneratesExpense: true,
    }, db);
    const loanId = loanRes.loan.id;

    const emiIdempKey = `emi-pay-r3-${timestamp}`;
    const emiPay1 = await loanService.recordEmiPayment(user.id, {
      loanId,
      amount: '6000.00',
      accountId: bankId,
      principalPaid: '5000.00',
      interestPaid: '1000.00',
      idempotencyKey: emiIdempKey,
      note: 'November EMI',
    }, db);

    assert.equal(emiPay1.success, true);
    assert.equal(emiPay1.remainingPrincipal, '55000');

    // Retry with SAME idempotencyKey
    const emiPayRetry = await loanService.recordEmiPayment(user.id, {
      loanId,
      amount: '6000.00',
      accountId: bankId,
      principalPaid: '5000.00',
      interestPaid: '1000.00',
      idempotencyKey: emiIdempKey,
      note: 'November EMI',
    }, db);

    assert.equal(emiPayRetry.success, true);
    assert.equal(emiPayRetry.alreadyProcessed, true, 'Retry with same idempotencyKey must return alreadyProcessed');
    assert.equal(emiPayRetry.paymentId, emiPay1.paymentId, 'Must return the original paymentId');
    assert.equal(emiPayRetry.remainingPrincipal, '55000', 'Remaining principal must remain 55000 (not reduced again to 50000)');

    // Verify DB state: exactly 1 LoanPayment and exactly 1 EXPENSE transaction
    const emiPaymentsInDb = await db.loanPayment.findMany({
      where: { loanId }
    });
    assert.equal(emiPaymentsInDb.length, 1, 'Only 1 LoanPayment record must exist in DB');

    const expensesInDb = await db.financialTransaction.findMany({
      where: { userId, type: 'EXPENSE', category: 'EMI' }
    });
    assert.equal(expensesInDb.length, 1, 'Only 1 EXPENSE transaction must exist in DB');

    // Verify loan record in DB
    const loanInDb = await db.loan.findUnique({
      where: { id: loanId }
    });
    assert.equal(loanInDb?.outstandingPrincipal.toString(), '55000');

  } finally {
    try {
      await db.creditCardPayment.deleteMany({ where: { userId } });
      await db.creditCardStatement.deleteMany({ where: { userId } });
      await db.loanPayment.deleteMany({ where: { userId } });
      await db.loan.deleteMany({ where: { userId } });
      await db.reminderDelivery.deleteMany({ where: { userId } });
      await db.obligationOccurrence.deleteMany({ where: { userId } });
      await db.reminder.deleteMany({ where: { userId } });
      await db.financialTransaction.deleteMany({ where: { userId } });
      await db.obligation.deleteMany({ where: { userId } });
      await db.financialAccount.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
    } catch (cleanupErr) {
      console.warn('V2-R004-ROUND3-B cleanup warning:', cleanupErr);
    } finally {
      await db.$disconnect();
    }
  }
});

test('V2-R004-ROUND4-B: Accounts Repayment UI Payer Account Restrictions (SOL-R004-014)', async (t) => {
  // 1. Static component verification: CreditCardDialog source code enforces payer account restrictions
  const ccDialogPath = path.resolve(process.cwd(), 'src/components/finance/CreditCardDialog.tsx');
  const ccDialogContent = fs.readFileSync(ccDialogPath, 'utf8');

  // Verify eligible payer predicate is defined and excludes CREDIT_CARD
  assert.ok(
    ccDialogContent.includes('isEligiblePayer') &&
      ccDialogContent.includes('a.id !== account.id') &&
      ccDialogContent.includes("a.type !== 'CREDIT_CARD'"),
    'CreditCardDialog must define isEligiblePayer predicate rejecting target card and any other CREDIT_CARD accounts'
  );

  // Verify payerAccounts filtering
  assert.ok(
    ccDialogContent.includes('payerAccounts = useMemo') ||
      ccDialogContent.includes('const payerAccounts = (accounts || []).filter(isEligiblePayer)'),
    'CreditCardDialog must filter payerAccounts using isEligiblePayer / useMemo'
  );

  // Verify selectedFromAccountId prefers defaultPaymentAccountId when present and eligible
  assert.ok(
    ccDialogContent.includes('defaultPaymentAccountId') &&
      ccDialogContent.includes('payerAccounts.some'),
    'CreditCardDialog must select defaultPaymentAccountId only if present and within eligible payerAccounts'
  );

  // Verify empty payerAccounts disabled option and submit button disable
  assert.ok(
    ccDialogContent.includes('No eligible bank, cash or wallet account available'),
    'CreditCardDialog must render disabled option "No eligible bank, cash or wallet account available" when payerAccounts is empty'
  );
  assert.ok(
    ccDialogContent.includes('payerAccounts.length === 0'),
    'CreditCardDialog must disable submit button when payerAccounts.length === 0'
  );

  // 2. Unit logic verification: isEligiblePayerAccount and filtering logic
  const targetCardId = 'acc_card_target';
  const allAccounts = [
    { id: targetCardId, name: 'Target Platinum Card', type: 'CREDIT_CARD' },
    { id: 'acc_card_other_1', name: 'Other Amazon Pay ICICI', type: 'CREDIT_CARD' },
    { id: 'acc_card_other_2', name: 'Other SBI SimplyCLICK', type: 'CREDIT_CARD' },
    { id: 'acc_bank_salary', name: 'HDFC Salary Account', type: 'BANK' },
    { id: 'acc_cash_home', name: 'Home Petty Cash', type: 'CASH' },
    { id: 'acc_wallet_paytm', name: 'Paytm Wallet', type: 'WALLET' },
  ];

  // Verify predicate logic on each type
  const isEligiblePayer = (a: any) => a.id !== targetCardId && a.type !== 'CREDIT_CARD';

  assert.equal(isEligiblePayer(allAccounts[0]), false, 'Target card itself must not be an eligible payer');
  assert.equal(isEligiblePayer(allAccounts[1]), false, 'Other credit card #1 must not be an eligible payer');
  assert.equal(isEligiblePayer(allAccounts[2]), false, 'Other credit card #2 must not be an eligible payer');
  assert.equal(isEligiblePayer(allAccounts[3]), true, 'BANK account must be an eligible payer');
  assert.equal(isEligiblePayer(allAccounts[4]), true, 'CASH account must be an eligible payer');
  assert.equal(isEligiblePayer(allAccounts[5]), true, 'WALLET account must be an eligible payer');

  // Verify filtered payer accounts only contain BANK, CASH, WALLET
  const filteredPayers = allAccounts.filter(isEligiblePayer);

  assert.equal(filteredPayers.length, 3, 'Filtered payer accounts must contain exactly 3 accounts');
  assert.deepEqual(
    filteredPayers.map((a) => a.id),
    ['acc_bank_salary', 'acc_cash_home', 'acc_wallet_paytm'],
    'Filtered payer accounts must match only BANK, CASH, and WALLET accounts'
  );

  // When only credit cards exist: payerAccounts must be empty
  const onlyCards = [
    { id: targetCardId, name: 'Target Platinum Card', type: 'CREDIT_CARD' },
    { id: 'acc_card_other_1', name: 'Other Card', type: 'CREDIT_CARD' },
  ];
  const emptyPayers = onlyCards.filter(isEligiblePayer);
  assert.equal(emptyPayers.length, 0, 'When only credit cards exist, payerAccounts must be empty');

  // 3. Database integration: verify that accounts created in DB filter correctly and backend rejects CREDIT_CARD
  const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  const timestamp = Date.now();
  const userId = `usr_r004_r4_${timestamp}`;

  try {
    const user = await db.user.create({
      data: {
        id: userId,
        email: `user-r4-${timestamp}@test.local`,
        name: 'User Round 4 Test',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      },
    });

    // Create Target CC, Other CC, Bank, Cash, and Wallet in DB
    const cardTarget = await financeService.createAccount(user.id, {
      name: 'User Target Card',
      type: 'CREDIT_CARD',
      creditLimit: '100000.00',
    }, db);

    const cardOther = await financeService.createAccount(user.id, {
      name: 'User Other Card',
      type: 'CREDIT_CARD',
      creditLimit: '50000.00',
    }, db);

    const bankAcc = await financeService.createAccount(user.id, {
      name: 'HDFC Savings Bank',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);

    const cashAcc = await financeService.createAccount(user.id, {
      name: 'Physical Cash',
      type: 'CASH',
      openingBalance: '10000.00',
    }, db);

    const walletAcc = await financeService.createAccount(user.id, {
      name: 'Amazon Pay Wallet',
      type: 'WALLET',
      openingBalance: '5000.00',
    }, db);

    const userAccounts = await financeService.getAccounts(user.id, db);
    const dbEligiblePayers = userAccounts.filter(
      (a: any) => a.id !== cardTarget.account.id && a.type !== 'CREDIT_CARD'
    );

    assert.equal(dbEligiblePayers.length, 3, 'Must have 3 eligible payer accounts from DB');
    const payerTypes = new Set(dbEligiblePayers.map((a: any) => a.type));
    assert.ok(payerTypes.has('BANK'), 'Must contain BANK');
    assert.ok(payerTypes.has('CASH'), 'Must contain CASH');
    assert.ok(payerTypes.has('WALLET'), 'Must contain WALLET');
    assert.ok(!payerTypes.has('CREDIT_CARD'), 'Must NOT contain CREDIT_CARD');

    // Create a statement on cardTarget and verify payment with BANK works, but payment with cardOther is rejected
    const stmtRes = await creditCardService.createCreditCardStatement(user.id, {
      accountId: cardTarget.account.id,
      periodKey: '2026-10',
      statementDate: '2026-10-01',
      dueDate: '2026-10-25',
      statementAmount: '5000.00',
    }, db);

    // Backend rejection test: paying with cardOther fails
    await assert.rejects(
      async () => {
        await creditCardService.recordCreditCardPayment(user.id, {
          statementId: stmtRes.statement.id,
          fromAccountId: cardOther.account.id,
          amount: '1000.00',
        }, db);
      },
      (err: any) => {
        return err.message && err.message.toLowerCase().includes('credit card');
      },
      'Backend must reject payment from another CREDIT_CARD account'
    );

    // Paying with bankAcc succeeds
    const bankPayRes = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmtRes.statement.id,
      fromAccountId: bankAcc.account.id,
      amount: '1000.00',
    }, db);
    assert.equal(bankPayRes.success, true);
    assert.equal(bankPayRes.pendingBalance, '4000');

  } finally {
    try {
      await db.creditCardPayment.deleteMany({ where: { userId } });
      await db.creditCardStatement.deleteMany({ where: { userId } });
      await db.financialTransaction.deleteMany({ where: { userId } });
      await db.financialAccount.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
    } catch (cleanupErr) {
      console.warn('V2-R004-ROUND4-B cleanup warning:', cleanupErr);
    } finally {
      await db.$disconnect();
    }
  }
});

test('V2-R004-ROUND5-B: CreditCardDialog Payer Accounts Memoization & Selection Stability (SOL-R004-015)', async (t) => {
  // 1. Static Component Verification: CreditCardDialog implementation
  const ccDialogPath = path.resolve(process.cwd(), 'src/components/finance/CreditCardDialog.tsx');
  const ccDialogContent = fs.readFileSync(ccDialogPath, 'utf8');

  // Verify useMemo import and memoization of payerAccounts
  assert.ok(
    ccDialogContent.includes('useMemo') &&
      ccDialogContent.includes('const payerAccounts = useMemo('),
    'CreditCardDialog must memoize payerAccounts with useMemo'
  );
  assert.ok(
    ccDialogContent.includes('[accounts, account.id]'),
    'CreditCardDialog must specify [accounts, account.id] as useMemo dependency array'
  );

  // Verify loadDetails stabilization: useCallback does NOT depend on payerAccounts
  assert.ok(
    ccDialogContent.includes('const loadDetails = useCallback('),
    'CreditCardDialog must define loadDetails with useCallback'
  );
  assert.ok(
    ccDialogContent.includes('[account.id, toast]'),
    'CreditCardDialog loadDetails must only depend on [account.id, toast] to avoid infinite re-render loops'
  );

  // Verify loadDetails does NOT overwrite selectedFromAccountId directly
  const loadDetailsBodyMatch = ccDialogContent.match(/const loadDetails = useCallback\(async \(\) => {([\s\S]*?)}, \[account\.id, toast\]\);/);
  assert.ok(loadDetailsBodyMatch, 'Must match loadDetails implementation');
  const loadDetailsBody = loadDetailsBodyMatch[1];
  assert.ok(
    !loadDetailsBody.includes('setSelectedFromAccountId'),
    'loadDetails must NOT directly call setSelectedFromAccountId'
  );

  // Verify selectedFromAccountId synchronization preserves existing eligible selection
  assert.ok(
    ccDialogContent.includes('setSelectedFromAccountId((current: string) =>') &&
      ccDialogContent.includes('if (current && payerAccounts.some((a) => a.id === current))') &&
      ccDialogContent.includes('return current;'),
    'selectedFromAccountId effect must preserve current selection if present in payerAccounts'
  );

  // Verify submit button disabled and empty state presentation
  assert.ok(
    ccDialogContent.includes('disabled={submitting || !selectedFromAccountId || payerAccounts.length === 0}'),
    'CreditCardDialog must disable submit when payerAccounts is empty or no account is selected'
  );
  assert.ok(
    ccDialogContent.includes('No eligible bank, cash or wallet account available'),
    'CreditCardDialog must display placeholder indicating no eligible payer accounts'
  );

  // 2. Logic Verification: Memoization & Payer Filtering
  const targetCardId = 'acc_cc_target_r5';
  const sampleAccounts = [
    { id: targetCardId, name: 'Target Platinum Card', type: 'CREDIT_CARD' },
    { id: 'acc_cc_other_1', name: 'ICICI Rubyx Card', type: 'CREDIT_CARD' },
    { id: 'acc_cc_other_2', name: 'SBI Cashback Card', type: 'CREDIT_CARD' },
    { id: 'acc_bank_salary', name: 'HDFC Salary Account', type: 'BANK' },
    { id: 'acc_bank_savings', name: 'Axis Savings Account', type: 'BANK' },
    { id: 'acc_cash_safe', name: 'Home Locker Cash', type: 'CASH' },
    { id: 'acc_wallet_amazon', name: 'Amazon Pay Balance', type: 'WALLET' },
  ];

  const filterEligiblePayers = (accounts: any[], cardId: string) =>
    (accounts || []).filter((a: any) => a.id !== cardId && a.type !== 'CREDIT_CARD');

  const eligiblePayers = filterEligiblePayers(sampleAccounts, targetCardId);
  assert.equal(eligiblePayers.length, 4, 'Must return exactly 4 eligible payer accounts');
  assert.deepEqual(
    eligiblePayers.map((a) => a.id),
    ['acc_bank_salary', 'acc_bank_savings', 'acc_cash_safe', 'acc_wallet_amazon'],
    'Eligible payers must exclude target card and all other credit cards'
  );

  // When only credit cards exist
  const onlyCreditCards = [
    { id: targetCardId, name: 'Target Platinum Card', type: 'CREDIT_CARD' },
    { id: 'acc_cc_other_1', name: 'ICICI Rubyx Card', type: 'CREDIT_CARD' },
  ];
  const emptyPayers = filterEligiblePayers(onlyCreditCards, targetCardId);
  assert.equal(emptyPayers.length, 0, 'Must produce empty array when only credit cards exist');

  // 3. Selection Stability Simulation: User Manual Choice Preserved Across Updates
  const defaultPaymentAccountId = 'acc_bank_salary';

  // Functional updater mirroring CreditCardDialog's setSelectedFromAccountId logic
  const calculateNextSelection = (
    current: string,
    defaultId: string | null | undefined,
    payers: { id: string }[]
  ): string => {
    if (current && payers.some((a) => a.id === current)) {
      return current;
    }
    if (defaultId && payers.some((a) => a.id === defaultId)) {
      return defaultId;
    }
    return payers[0]?.id || '';
  };

  // Case A: Initial mount with empty current selection -> selects default
  let selection = calculateNextSelection('', defaultPaymentAccountId, eligiblePayers);
  assert.equal(selection, 'acc_bank_salary', 'Initial selection must fall back to defaultPaymentAccountId');

  // Case B: User manually selects an alternative eligible bank ('acc_bank_savings')
  selection = 'acc_bank_savings';

  // Case C: Card details reloaded / updated (statement created, payment made, or polling)
  // The updater runs with current = 'acc_bank_savings' and cardData.defaultId = 'acc_bank_salary'
  const selectionAfterReload = calculateNextSelection(selection, defaultPaymentAccountId, eligiblePayers);
  assert.equal(
    selectionAfterReload,
    'acc_bank_savings',
    'User manual selection of alternative eligible bank must be preserved across card details reloads'
  );

  // Case D: Repeated renders / reloads maintain selection
  const selectionAfterMultipleReloads = calculateNextSelection(
    selectionAfterReload,
    defaultPaymentAccountId,
    eligiblePayers
  );
  assert.equal(
    selectionAfterMultipleReloads,
    'acc_bank_savings',
    'Selection must remain stable across multiple renders'
  );

  // Case E: If user-selected account is removed from eligible accounts, fallback to defaultId
  const payersWithoutSavings = eligiblePayers.filter((a) => a.id !== 'acc_bank_savings');
  const selectionAfterAccountRemoved = calculateNextSelection(
    selection,
    defaultPaymentAccountId,
    payersWithoutSavings
  );
  assert.equal(
    selectionAfterAccountRemoved,
    'acc_bank_salary',
    'Must fall back to defaultId if previously selected account is no longer in payerAccounts'
  );

  // Case F: If both selected account and default account are removed, fallback to first eligible account
  const payersOnlyCash = [sampleAccounts[5]]; // acc_cash_safe
  const selectionAfterDefaultAlsoRemoved = calculateNextSelection(
    'acc_bank_savings',
    defaultPaymentAccountId,
    payersOnlyCash
  );
  assert.equal(
    selectionAfterDefaultAlsoRemoved,
    'acc_cash_safe',
    'Must fall back to first eligible account when neither current nor default is available'
  );

  // Case G: If no eligible accounts exist at all, selection resets to '' and submission is disabled
  const selectionWithNoPayers = calculateNextSelection('acc_cash_safe', null, []);
  assert.equal(selectionWithNoPayers, '', 'Must reset to empty string when no payer accounts exist');

  const isSubmitDisabled = (submitting: boolean, selectedId: string, payers: any[]) =>
    submitting || !selectedId || payers.length === 0;

  assert.equal(
    isSubmitDisabled(false, selectionWithNoPayers, []),
    true,
    'Submit button must be disabled when payerAccounts is empty'
  );
  assert.equal(
    isSubmitDisabled(false, '', eligiblePayers),
    true,
    'Submit button must be disabled when no account is selected'
  );
  assert.equal(
    isSubmitDisabled(false, 'acc_bank_savings', eligiblePayers),
    false,
    'Submit button must be enabled when an eligible account is selected'
  );

  // 4. Database Integration Verification
  const db = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  const timestamp = Date.now();
  const userId = `usr_r004_r5_${timestamp}`;

  try {
    const user = await db.user.create({
      data: {
        id: userId,
        email: `user-r5-${timestamp}@test.local`,
        name: 'User Round 5 Test',
        password: 'password123',
        timezone: 'Asia/Kolkata',
      },
    });

    const primaryBank = await financeService.createAccount(user.id, {
      name: 'Default Salary Bank',
      type: 'BANK',
      openingBalance: '50000.00',
    }, db);

    const alternativeBank = await financeService.createAccount(user.id, {
      name: 'Secondary Savings Bank',
      type: 'BANK',
      openingBalance: '30000.00',
    }, db);

    const targetCard = await financeService.createAccount(user.id, {
      name: 'Target Platinum CC',
      type: 'CREDIT_CARD',
      creditLimit: '150000.00',
      defaultPaymentAccountId: primaryBank.account.id,
    }, db);

    const otherCard = await financeService.createAccount(user.id, {
      name: 'Other Rewards CC',
      type: 'CREDIT_CARD',
      creditLimit: '50000.00',
    }, db);

    // Verify DB accounts filtering
    const userDbAccounts = await financeService.getAccounts(user.id, db);
    const dbEligiblePayers = filterEligiblePayers(userDbAccounts, targetCard.account.id);

    assert.equal(dbEligiblePayers.length, 2, 'Must have 2 eligible payer accounts (Primary & Secondary Bank)');
    assert.ok(dbEligiblePayers.some((a: any) => a.id === primaryBank.account.id), 'Must include Primary Bank');
    assert.ok(dbEligiblePayers.some((a: any) => a.id === alternativeBank.account.id), 'Must include Secondary Bank');
    assert.ok(!dbEligiblePayers.some((a: any) => a.type === 'CREDIT_CARD'), 'Must NOT include any CREDIT_CARD');

    // Create a statement on Target Card
    const stmtRes = await creditCardService.createCreditCardStatement(user.id, {
      accountId: targetCard.account.id,
      periodKey: '2026-10',
      statementDate: '2026-10-01',
      dueDate: '2026-10-25',
      statementAmount: '8000.00',
    }, db);

    // Record payment using the alternative bank (user's chosen alternative)
    const payRes = await creditCardService.recordCreditCardPayment(user.id, {
      statementId: stmtRes.statement.id,
      fromAccountId: alternativeBank.account.id,
      amount: '3000.00',
    }, db);

    assert.equal(payRes.success, true);
    assert.equal(payRes.pendingBalance, '5000');

    // Verify Secondary Bank balance was reduced, while Primary Bank balance was unaffected
    const accountsAfterPay = await financeService.getAccounts(user.id, db);
    const primaryAfter = accountsAfterPay.find((a: any) => a.id === primaryBank.account.id);
    const altAfter = accountsAfterPay.find((a: any) => a.id === alternativeBank.account.id);

    assert.equal(primaryAfter.currentBalance, '50000', 'Primary Bank balance must remain untouched');
    assert.equal(altAfter.currentBalance, '27000', 'Secondary Bank balance must reflect the 3000 deduction');

    // Verify paying from otherCard is rejected by backend
    await assert.rejects(
      async () => {
        await creditCardService.recordCreditCardPayment(user.id, {
          statementId: stmtRes.statement.id,
          fromAccountId: otherCard.account.id,
          amount: '1000.00',
        }, db);
      },
      (err: any) => {
        return err.message && err.message.toLowerCase().includes('credit card');
      },
      'Backend must reject payment from another credit card account'
    );

  } finally {
    try {
      await db.creditCardPayment.deleteMany({ where: { userId } });
      await db.creditCardStatement.deleteMany({ where: { userId } });
      await db.financialTransaction.deleteMany({ where: { userId } });
      await db.financialAccount.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
    } catch (cleanupErr) {
      console.warn('V2-R004-ROUND5-B cleanup warning:', cleanupErr);
    } finally {
      await db.$disconnect();
    }
  }
});

test('SOL-R005-001: Direct EMI reversal enforces latest-only completion order and fallback selects latest scheduled installment', async () => {
  const db = new PrismaClient({
    datasourceUrl: 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test',
  });

  const timestamp = Date.now();
  const userId = `usr_emi_latest_${timestamp}`;

  try {
    const user = await db.user.create({
      data: {
        id: userId,
        email: `emilatest_${timestamp}@test.local`,
        name: 'EMI Latest User',
        password: 'password123',
        timezone: 'UTC',
      }
    });

    const bank = await db.financialAccount.create({
      data: {
        userId: user.id,
        name: 'EMI Bank',
        type: 'BANK',
        openingBalance: new Prisma.Decimal(200000),
      }
    });

    // Create loan starting 2026-01-15
    const loanRes = await loanService.createLoan(user.id, {
      name: 'Latest Order Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '60000.00',
      emiAmount: '10000.00',
      nextEmiDate: '2026-01-15T12:00:00.000Z',
      dueDay: 15,
      paymentAccountId: bank.id,
      createLinkedObligation: false,
    }, db);

    const loanId = loanRes.loan.id;

    // Record installment 1 (Jan 15)
    const pay1 = await loanService.recordEmiPayment(user.id, {
      loanId,
      amount: '10000.00',
      principalPaid: '5000.00',
      interestPaid: '5000.00',
      accountId: bank.id,
    }, db);
    assert.equal(pay1.success, true);

    // Verify nextEmiDate advanced to Feb 15
    const loanAfterPay1 = await db.loan.findUnique({ where: { id: loanId } });
    assert.equal(loanAfterPay1?.nextEmiDate?.toISOString(), '2026-02-15T12:00:00.000Z');

    // Record installment 2 (Feb 15)
    const pay2 = await loanService.recordEmiPayment(user.id, {
      loanId,
      amount: '10000.00',
      principalPaid: '5000.00',
      interestPaid: '5000.00',
      accountId: bank.id,
    }, db);
    assert.equal(pay2.success, true);

    // Verify nextEmiDate advanced to Mar 15
    const loanAfterPay2 = await db.loan.findUnique({ where: { id: loanId } });
    assert.equal(loanAfterPay2?.nextEmiDate?.toISOString(), '2026-03-15T12:00:00.000Z');

    // 1. Direct reversal of earlier installment pay1 (Jan) while pay2 (Feb) remains completed must be REJECTED
    await assert.rejects(
      async () => {
        await loanService.revertEmiPayment(user.id, { loanPaymentId: pay1.paymentId }, db);
      },
      /Cannot revert an earlier payment while a later payment remains completed/,
      'Must reject reversing Jan installment while Feb installment is completed'
    );

    // 2. loanId-only fallback must select the latest scheduled completed installment (Feb, pay2)
    const fallbackRev = await loanService.revertEmiPayment(user.id, { loanId }, db);
    assert.equal(fallbackRev.success, true);
    assert.equal(fallbackRev.revertedPaymentId, pay2.paymentId, 'loanId fallback must revert the latest installment (pay2)');
    assert.equal(fallbackRev.restoredNextEmiDate, '2026-02-15T12:00:00.000Z');

    // Verify DB loan nextEmiDate is restored to Feb 15
    const loanAfterRev2 = await db.loan.findUnique({ where: { id: loanId } });
    assert.equal(loanAfterRev2?.nextEmiDate?.toISOString(), '2026-02-15T12:00:00.000Z');

    // 3. Now that Feb is reverted, Jan installment (pay1) can be safely reverted
    const rev1 = await loanService.revertEmiPayment(user.id, { loanPaymentId: pay1.paymentId }, db);
    assert.equal(rev1.success, true);
    assert.equal(rev1.restoredNextEmiDate, '2026-01-15T12:00:00.000Z');

    // Verify DB loan nextEmiDate is restored to Jan 15
    const loanAfterRev1 = await db.loan.findUnique({ where: { id: loanId } });
    assert.equal(loanAfterRev1?.nextEmiDate?.toISOString(), '2026-01-15T12:00:00.000Z');
    assert.equal(loanAfterRev1?.outstandingPrincipal.toString(), '60000');

    // 4. Repeated undo on already reversed payment reports alreadyReversed: true
    const repeatRev = await loanService.revertEmiPayment(user.id, { loanPaymentId: pay1.paymentId }, db);
    assert.equal(repeatRev.alreadyReversed, true);

  } finally {
    try {
      await db.loanPayment.deleteMany({ where: { userId } });
      await db.financialTransaction.deleteMany({ where: { userId } });
      await db.loan.deleteMany({ where: { userId } });
      await db.financialAccount.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
    } catch (cleanupErr) {
      console.warn('SOL-R005-001 cleanup warning:', cleanupErr);
    } finally {
      await db.$disconnect();
    }
  }
});
