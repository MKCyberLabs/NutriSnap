import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '../../../prisma/generated/client';
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

  } finally {
    await db.$disconnect();
  }
});
