import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '../../../prisma/generated/client';
import * as financeService from '../finance/finance-service';
import * as debtService from '../finance/debt-service';
import * as loanService from '../finance/loan-service';
import { wishlistService } from '../finance/wishlist-service';

const TEST_DB_URL = 'postgresql://nutrisnap_test:test_pass@localhost:5433/nutrisnap_test';

test('V2-T136: Complete NutriSnap v0.2 Money Life 21-Step Integrated Acceptance Scenario', async () => {
  const testPrisma = new PrismaClient({
    datasourceUrl: TEST_DB_URL,
  });

  try {
    // 0. Setup isolated test user
    const testUser = await testPrisma.user.create({
      data: {
        id: `usr-v02-acc-${Date.now()}`,
        email: `acc-v02-${Date.now()}@nutrisnap.test`,
        name: 'V0.2 Acceptance Tester',
        password: 'secure-test-password',
        timezone: 'Asia/Kolkata',
      },
    });
    const userId = testUser.id;

    // --- Step 1: Bank opening balance ₹50,000 ---
    const bankRes = await financeService.createAccount(userId, {
      name: 'Primary Checking Bank',
      type: 'BANK',
      openingBalance: '50000.00',
    }, testPrisma);
    assert.equal(bankRes.success, true);
    const bankId = bankRes.account.id;

    let accounts = await financeService.getAccounts(userId, testPrisma);
    let bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '50000');

    // --- Step 2: Lend friend ₹10,000 ---
    const lendRes = await debtService.createDebt(userId, {
      direction: 'RECEIVABLE',
      counterpartyName: 'Rahul',
      originalAmount: '10000.00',
      title: 'Short term loan',
      accountId: bankId,
      dueAt: new Date('2026-11-01T00:00:00.000Z'),
    }, testPrisma);
    assert.equal(lendRes.success, true);
    const debt1Id = lendRes.debt.id;

    // --- Step 3: Liquid becomes ₹40,000 ---
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '40000', 'Step 3: Liquid balance must become ₹40,000 after lending');

    // --- Step 4: Monthly Expense unchanged ---
    let monthlySummary = await financeService.getMonthlyFinanceSummary(userId, new Date(), testPrisma);
    assert.equal(monthlySummary.expense, '0', 'Step 4: Lending must NOT inflate monthly Expense');

    // --- Step 5: Friend owes me ₹10,000 ---
    let debts = await debtService.getDebts(userId, {}, testPrisma);
    let debt1 = debts.find((d: any) => d.id === debt1Id);
    assert.equal(debt1.outstandingAmount, '10000', 'Step 5: Friend owes me ₹10,000');

    // --- Step 6: Collect ₹4,000 ---
    const collectRes = await debtService.recordDebtCollection(userId, {
      debtId: debt1Id,
      amount: '4000.00',
      accountId: bankId,
      note: 'Partial payback via UPI',
    }, testPrisma);
    assert.equal(collectRes.success, true);

    // --- Step 7: Liquid becomes ₹44,000 ---
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '44000', 'Step 7: Liquid balance becomes ₹44,000 after collecting ₹4,000');

    // --- Step 8: Friend owes me ₹6,000 ---
    debts = await debtService.getDebts(userId, {}, testPrisma);
    debt1 = debts.find((d: any) => d.id === debt1Id);
    assert.equal(debt1.outstandingAmount, '6000', 'Step 8: Friend owes me ₹6,000');

    // --- Step 9: Borrow ₹5,000 from another friend ---
    const borrowRes = await debtService.createDebt(userId, {
      direction: 'PAYABLE',
      counterpartyName: 'Priya',
      originalAmount: '5000.00',
      title: 'Borrowed for festival',
      accountId: bankId,
      dueAt: new Date('2026-11-15T00:00:00.000Z'),
    }, testPrisma);
    assert.equal(borrowRes.success, true);
    const debt2Id = borrowRes.debt.id;

    // --- Step 10: Liquid becomes ₹49,000 ---
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '49000', 'Step 10: Liquid balance becomes ₹49,000 after borrowing ₹5,000');

    // --- Step 11: Monthly Income unchanged ---
    monthlySummary = await financeService.getMonthlyFinanceSummary(userId, new Date(), testPrisma);
    assert.equal(monthlySummary.income, '0', 'Step 11: Borrowing must NOT inflate monthly Income');

    // --- Step 12: I owe friend ₹5,000 ---
    debts = await debtService.getDebts(userId, {}, testPrisma);
    const debt2 = debts.find((d: any) => d.id === debt2Id);
    assert.equal(debt2.outstandingAmount, '5000', 'Step 12: I owe friend ₹5,000');

    // --- Step 13: Add existing Personal Loan outstanding ₹1,20,000, EMI ₹6,000 ---
    const loanRes = await loanService.createLoan(userId, {
      name: 'HDFC Personal Loan',
      loanType: 'PERSONAL',
      lender: 'HDFC Bank',
      openingOutstanding: '120000.00',
      emiAmount: '6000.00',
      emiGeneratesExpense: true,
      principalAlreadyRecognized: false,
      nextEmiDate: new Date('2026-10-20T00:00:00.000Z'),
      paymentAccountId: bankId,
    }, testPrisma);
    assert.equal(loanRes.success, true);
    const loanId = loanRes.loan.id;

    // --- Step 14: Liquid remains ₹49,000 ---
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '49000', 'Step 14: Adding existing loan snapshot must NOT alter liquid balance');

    // --- Step 15: Record EMI paid ₹6,000 ---
    const emiRes = await loanService.recordEmiPayment(userId, {
      loanId,
      occurredAt: new Date('2026-10-20T00:00:00.000Z'),
      amount: '6000.00',
      accountId: bankId,
      principalPaid: '4000.00',
      interestPaid: '2000.00',
      note: 'EMI Month 1',
    }, testPrisma);
    assert.equal(emiRes.success, true);

    // --- Step 16: Exactly one expense/payment created ---
    const loanPayments = await testPrisma.loanPayment.findMany({ where: { loanId } });
    assert.equal(loanPayments.length, 1, 'Step 16: Exactly one LoanPayment record created');
    assert.ok(loanPayments[0].transactionId, 'LoanPayment has linked transaction');

    const emiTransactions = await testPrisma.financialTransaction.findMany({
      where: { userId, category: 'EMI' },
    });
    assert.equal(emiTransactions.length, 1, 'Step 16: Exactly one EMI Expense transaction created');
    assert.equal(emiTransactions[0].amount.toString(), '6000');

    // Liquid became 49,000 - 6,000 = 43,000
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '43000', 'Liquid reflects EMI deduction of ₹6,000');

    // Outstanding reduced by known principal (120,000 - 4,000 = 116,000)
    const updatedLoan = await loanService.getLoanById(userId, loanId, testPrisma);
    assert.equal(updatedLoan?.outstandingPrincipal.toString(), '116000');

    // --- Step 17: Add laptop wishlist target ₹80,000 ---
    const wishItem = await wishlistService.createWishlistItem(userId, {
      name: 'Apple MacBook Pro M3',
      category: 'Electronics',
      targetPrice: '80000.00',
      maxBudget: '85000.00',
      priority: 'HIGH',
      plannedAccountId: bankId,
      targetDate: new Date('2026-12-31T00:00:00.000Z'),
    }, testPrisma);
    const wishId = wishItem.id;

    // --- Step 18: No balance change ---
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '43000', 'Step 18: Wishlist item creation must NOT alter liquid balance');

    monthlySummary = await financeService.getMonthlyFinanceSummary(userId, new Date(), testPrisma);
    assert.equal(monthlySummary.expense, '6000', 'Step 18: Wishlist item creation must NOT create premature Expense');

    // --- Step 19: Mark laptop purchased ₹75,000 with expense ---
    const purchaseRes = await wishlistService.markPurchased(userId, wishId, {
      actualPrice: '75000.00',
      accountId: bankId,
      purchasedAt: new Date(),
      createExpense: true,
      note: 'Electronics purchase',
    }, testPrisma);
    assert.equal(purchaseRes.alreadyPurchased, false);
    assert.ok(purchaseRes.transactionId);

    // --- Step 20: Exactly one purchase expense ---
    const purchasedItem = await wishlistService.getWishlistItemById(userId, wishId, testPrisma);
    assert.equal(purchasedItem?.status, 'PURCHASED');
    assert.ok(purchasedItem?.transactionId);

    const shoppingTxs = await testPrisma.financialTransaction.findMany({
      where: { userId, id: purchasedItem.transactionId! },
    });
    assert.equal(shoppingTxs.length, 1, 'Step 20: Exactly one purchase expense created');
    assert.equal(shoppingTxs[0].amount.toString(), '75000');

    // Bank balance: 43,000 - 75,000 = -32,000
    accounts = await financeService.getAccounts(userId, testPrisma);
    bankAcc = accounts.find((a: any) => a.id === bankId);
    assert.equal(bankAcc.currentBalance, '-32000');

    // --- Step 21: Full dashboard totals reconcile ---
    const overview = await financeService.getMoneyOverview(userId, new Date(), testPrisma);
    assert.equal(overview.liquidBalance, '-32000.00', 'Step 21: Dashboard liquid balance reconciles');
    assert.equal(overview.receivablesOutstanding, '6000.00', 'Step 21: Friends owe me reconciles to ₹6,000');
    assert.equal(overview.payablesOutstanding, '5000.00', 'Step 21: I owe friends reconciles to ₹5,000');
    assert.equal(overview.totalLoanOutstanding, '116000.00', 'Step 21: Loan outstanding reconciles to ₹1,16,000');
    assert.equal(overview.monthlyIncome, '0.00', 'Step 21: Monthly Income reconciles to ₹0');
    // Monthly expense: 6,000 (EMI) + 75,000 (Laptop) = 81,000
    assert.equal(overview.monthlyExpense, '81000.00', 'Step 21: Monthly Expense reconciles to ₹81,000');

    // Cleanup
    await testPrisma.user.delete({ where: { id: userId } });
  } finally {
    await testPrisma.$disconnect();
  }
});
