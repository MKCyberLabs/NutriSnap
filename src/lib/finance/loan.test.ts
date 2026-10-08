import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
import { TZDate } from '@date-fns/tz';
import * as loanService from './loan-service';
import * as financeService from './finance-service';
import { calculateMonthlyTotals } from './finance';

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
