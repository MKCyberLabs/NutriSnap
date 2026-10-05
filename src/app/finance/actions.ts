'use server';

import { requireUser } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import * as financeService from '@/lib/finance/finance-service';

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
