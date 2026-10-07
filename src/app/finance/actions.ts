'use server';

import { requireUser } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import * as financeService from '@/lib/finance/finance-service';
import * as debtService from '@/lib/finance/debt-service';
import * as loanService from '@/lib/finance/loan-service';
import * as creditCardService from '@/lib/finance/credit-card-service';
import { wishlistService } from '@/lib/finance/wishlist-service';

async function verifyAuth(userId?: string) {
  return await requireUser(userId);
}

/**
 * Lists all active accounts for the authenticated user, including derived balance.
 */
export async function getAccounts(userId: string) {
  const authUser = await verifyAuth(userId);
  return await financeService.getAccounts(authUser.id);
}

/**
 * Creates a new financial account.
 */
export async function createAccount(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.createAccount(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/today');
  return result;
}

/**
 * Updates financial account metadata.
 */
export async function updateAccount(userId: string, accountId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.updateAccount(authUser.id, accountId, data);
  revalidatePath('/finance');
  revalidatePath('/today');
  return result;
}

/**
 * Archives an account (soft delete) preserving all historical transactions.
 */
export async function archiveAccount(userId: string, accountId: string) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.archiveAccount(authUser.id, accountId);
  revalidatePath('/finance');
  revalidatePath('/today');
  return result;
}

/**
 * Lists transactions for user with date filtering and server-side aggregation.
 */
export async function getTransactions(
  userId: string,
  options: {
    limit?: number;
    startDate?: Date | string;
    endDate?: Date | string;
    accountId?: string;
  } = {}
) {
  const authUser = await verifyAuth(userId);
  return await financeService.getTransactions(authUser.id, options);
}

/**
 * Records a new financial transaction (INCOME, EXPENSE, or TRANSFER) with invariant validation.
 */
export async function recordTransaction(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.recordTransaction(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/today');
  return result;
}

/**
 * Updates a standalone transaction.
 */
export async function updateTransaction(userId: string, transactionId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.updateTransaction(authUser.id, transactionId, data);
  revalidatePath('/finance');
  revalidatePath('/today');
  return result;
}

/**
 * Deletes a transaction with authorization verification.
 */
export async function deleteTransaction(userId: string, transactionId: string) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.deleteTransaction(authUser.id, transactionId);
  revalidatePath('/finance');
  revalidatePath('/today');
  return result;
}

/**
 * Returns month-scoped financial summary (income, expense, category breakdown).
 */
export async function getMonthlyFinanceSummary(
  userId: string,
  targetDate: Date | string = new Date()
) {
  const authUser = await verifyAuth(userId);
  return await financeService.getMonthlyFinanceSummary(authUser.id, targetDate);
}

/**
 * Returns comprehensive v0.2 Money Overview read model for the dashboard.
 */
export async function getMoneyOverview(
  userId: string,
  targetDate: Date | string = new Date()
) {
  const authUser = await verifyAuth(userId);
  return await financeService.getMoneyOverview(authUser.id, targetDate);
}

/**
 * Lists user obligations ordered by nextDueAt.
 */
export async function getObligations(userId: string) {
  const authUser = await verifyAuth(userId);
  return await financeService.getObligations(authUser.id);
}

/**
 * Creates a new recurring or one-time obligation with deterministic nextDueAt calculation.
 */
export async function createObligation(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.createObligation(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Updates an obligation with authorization verification.
 */
export async function updateObligation(userId: string, obligationId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.updateObligation(authUser.id, obligationId, data);
  revalidatePath('/finance');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Archives an obligation (soft delete) preserving historical occurrences.
 */
export async function archiveObligation(userId: string, obligationId: string) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.archiveObligation(authUser.id, obligationId);
  revalidatePath('/finance');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Marks an obligation occurrence as Paid with transactional idempotency.
 */
export async function markObligationPaid(
  userId: string,
  params: {
    obligationId: string;
    occurrenceKey: string;
    createExpense?: boolean;
    accountId?: string;
  }
) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.markObligationPaid(authUser.id, params);
  revalidatePath('/finance');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Creates a personal debt (RECEIVABLE or PAYABLE).
 */
export async function createDebt(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.createDebt(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/today');
  return result;
}

/**
 * Lists debts for a user with calculated outstanding balances.
 */
export async function getDebts(
  userId: string,
  options: { status?: string; direction?: string } = {}
) {
  const authUser = await verifyAuth(userId);
  return await debtService.getDebts(authUser.id, options);
}

/**
 * Retrieves a single debt by ID.
 */
export async function getDebtById(userId: string, debtId: string) {
  const authUser = await verifyAuth(userId);
  return await debtService.getDebtById(authUser.id, debtId);
}

/**
 * Records collection on a RECEIVABLE debt.
 */
export async function recordDebtCollection(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.recordDebtCollection(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Records repayment on a PAYABLE debt.
 */
export async function recordDebtRepayment(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.recordDebtRepayment(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Records additional lending on a RECEIVABLE debt.
 */
export async function recordAdditionalLend(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.recordAdditionalLend(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Records additional borrowing on a PAYABLE debt.
 */
export async function recordAdditionalBorrow(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.recordAdditionalBorrow(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Marks a debt as settled.
 */
export async function settleDebt(userId: string, debtId: string) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.settleDebt(authUser.id, debtId);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/today');
  return result;
}

/**
 * Archives a debt (soft delete).
 */
export async function archiveDebt(userId: string, debtId: string) {
  const authUser = await verifyAuth(userId);
  const result = await debtService.archiveDebt(authUser.id, debtId);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/today');
  return result;
}

/**
 * Updates personal debt metadata (safe mutable fields).
 */
export async function updateDebt(userId: string, debtId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await (debtService as any).updateDebt(authUser.id, debtId, data);
  revalidatePath('/finance');
  revalidatePath('/finance/debts');
  revalidatePath('/today');
  return result;
}

/**
 * Creates a loan liability snapshot.
 */
export async function createLoan(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await loanService.createLoan(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/today');
  return result;
}

/**
 * Lists user loans with payment history.
 */
export async function getLoans(userId: string, options: { status?: string } = {}) {
  const authUser = await verifyAuth(userId);
  return await loanService.getLoans(authUser.id, options);
}

/**
 * Retrieves a single loan by ID.
 */
export async function getLoanById(userId: string, loanId: string) {
  const authUser = await verifyAuth(userId);
  return await loanService.getLoanById(authUser.id, loanId);
}

/**
 * Records an EMI payment on a loan.
 */
export async function recordEmiPayment(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await loanService.recordEmiPayment(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Reconciles loan outstanding balance manually.
 */
export async function reconcileOutstanding(
  userId: string,
  loanId: string,
  newOutstanding: string | number,
  note?: string
) {
  const authUser = await verifyAuth(userId);
  const result = await loanService.reconcileOutstanding(authUser.id, loanId, newOutstanding, note);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/today');
  return result;
}

/**
 * Closes a loan.
 */
export async function closeLoan(userId: string, loanId: string) {
  const authUser = await verifyAuth(userId);
  const result = await loanService.closeLoan(authUser.id, loanId);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/today');
  return result;
}

/**
 * Archives a loan (soft delete).
 */
export async function archiveLoan(userId: string, loanId: string) {
  const authUser = await verifyAuth(userId);
  const result = await loanService.archiveLoan(authUser.id, loanId);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/today');
  return result;
}

/**
 * Updates loan metadata (safe mutable fields).
 */
export async function updateLoan(userId: string, loanId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await (loanService as any).updateLoan(authUser.id, loanId, data);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Creates a new wishlist item.
 */
export async function createWishlistItem(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await wishlistService.createWishlistItem(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/wishlist');
  revalidatePath('/today');
  return result;
}

/**
 * Lists wishlist items for user.
 */
export async function getWishlistItems(
  userId: string,
  options: { status?: string; priority?: string } = {}
) {
  const authUser = await verifyAuth(userId);
  return await wishlistService.getWishlistItems(authUser.id, options);
}

/**
 * Retrieves a single wishlist item.
 */
export async function getWishlistItemById(userId: string, itemId: string) {
  const authUser = await verifyAuth(userId);
  return await wishlistService.getWishlistItemById(authUser.id, itemId);
}

/**
 * Updates wishlist item metadata before purchase.
 */
export async function updateWishlistItem(userId: string, itemId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await wishlistService.updateWishlistItem(authUser.id, itemId, data);
  revalidatePath('/finance');
  revalidatePath('/finance/wishlist');
  revalidatePath('/today');
  return result;
}

/**
 * Marks a wishlist item as purchased, optionally posting an expense transaction.
 */
export async function markWishlistPurchased(userId: string, itemId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await wishlistService.markPurchased(authUser.id, itemId, data);
  revalidatePath('/finance');
  revalidatePath('/finance/wishlist');
  revalidatePath('/finance/transactions');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Reverts a wishlist purchase ("Unmark as Purchased" atomic flow).
 */
export async function unmarkWishlistPurchased(
  userId: string,
  itemId: string,
  targetStatus: 'READY' | 'PLANNED' | 'WISHLIST' = 'READY'
) {
  const authUser = await verifyAuth(userId);
  const result = await wishlistService.unmarkPurchased(authUser.id, itemId, targetStatus);
  revalidatePath('/finance');
  revalidatePath('/finance/wishlist');
  revalidatePath('/finance/transactions');
  revalidatePath('/finance/accounts');
  revalidatePath('/today');
  return result;
}

/**
 * Archives a wishlist item.
 */
export async function archiveWishlistItem(userId: string, itemId: string) {
  const authUser = await verifyAuth(userId);
  const result = await wishlistService.archiveWishlistItem(authUser.id, itemId);
  revalidatePath('/finance');
  revalidatePath('/finance/wishlist');
  revalidatePath('/today');
  return result;
}

/**
 * Deletes a wishlist item.
 */
export async function deleteWishlistItem(userId: string, itemId: string) {
  const authUser = await verifyAuth(userId);
  const result = await wishlistService.deleteWishlistItem(authUser.id, itemId);
  revalidatePath('/finance');
  revalidatePath('/finance/wishlist');
  revalidatePath('/today');
  return result;
}

/**
 * Reverts an obligation payment occurrence atomically (V2-651).
 */
export async function revertObligationPayment(
  userId: string,
  params: {
    obligationId: string;
    occurrenceKey?: string;
    occurrenceId?: string;
  }
) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.revertObligationPayment(authUser.id, params);
  revalidatePath('/finance');
  revalidatePath('/finance/bills');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Toggles an obligation between Active and Paused (V2-652).
 */
export async function toggleObligationActive(
  userId: string,
  obligationId: string,
  isActive: boolean
) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.toggleObligationActive(authUser.id, obligationId, isActive);
  revalidatePath('/finance');
  revalidatePath('/finance/bills');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Deletes an obligation only if it has zero completed occurrences (V2-652).
 */
export async function deleteObligation(userId: string, obligationId: string) {
  const authUser = await verifyAuth(userId);
  const result = await financeService.deleteObligation(authUser.id, obligationId);
  revalidatePath('/finance');
  revalidatePath('/finance/bills');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Reverts an EMI payment atomically (V2-651).
 */
export async function revertEmiPayment(
  userId: string,
  params: {
    loanPaymentId?: string;
    obligationOccurrenceId?: string;
    loanId?: string;
    revertToDate?: Date | string;
  }
) {
  const authUser = await verifyAuth(userId);
  const result = await loanService.revertEmiPayment(authUser.id, params);
  revalidatePath('/finance');
  revalidatePath('/finance/loans');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Creates a monthly credit card statement (V2-653).
 */
export async function createCreditCardStatement(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await creditCardService.createCreditCardStatement(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/accounts');
  revalidatePath('/finance/bills');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Records a payment against a credit card statement (V2-653).
 */
export async function recordCreditCardPayment(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const result = await creditCardService.recordCreditCardPayment(authUser.id, data);
  revalidatePath('/finance');
  revalidatePath('/finance/accounts');
  revalidatePath('/finance/bills');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Reverts a credit card payment atomically (V2-653).
 */
export async function revertCreditCardPayment(
  userId: string,
  params: { paymentId?: string; statementId?: string }
) {
  const authUser = await verifyAuth(userId);
  const result = await creditCardService.revertCreditCardPayment(authUser.id, params);
  revalidatePath('/finance');
  revalidatePath('/finance/accounts');
  revalidatePath('/finance/bills');
  revalidatePath('/today');
  revalidatePath('/reminders');
  return result;
}

/**
 * Returns comprehensive credit card details including statement and payments.
 */
export async function getCreditCardDetails(userId: string, accountId: string) {
  const authUser = await verifyAuth(userId);
  return await creditCardService.getCreditCardDetails(authUser.id, accountId);
}
