import { Prisma } from '../../../prisma/generated/client';

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const ACCOUNT_TYPES = ['BANK', 'CASH', 'WALLET', 'CREDIT_CARD'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TRANSACTION_TYPES = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'LEND',
  'BORROW',
  'DEBT_COLLECT',
  'DEBT_REPAY'
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const OBLIGATION_KINDS = [
  'RECHARGE',
  'CREDIT_CARD',
  'BILL',
  'SUBSCRIPTION',
  'RENT',
  'EMI',
  'INSURANCE',
  'OTHER'
] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];

export const TRANSACTION_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Rent',
  'Utilities',
  'Recharge',
  'Subscription',
  'EMI',
  'Credit Card',
  'Insurance',
  'Investment',
  'Medical',
  'Entertainment',
  'Salary',
  'Freelance',
  'Transfer',
  'Other'
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

/**
 * Validates that an account type is one of the supported types.
 */
export function isValidAccountType(type: string): type is AccountType {
  return ACCOUNT_TYPES.includes(type as AccountType);
}

/**
 * Validates that a transaction type is one of the supported types.
 */
export function isValidTransactionType(type: string): type is TransactionType {
  return TRANSACTION_TYPES.includes(type as TransactionType);
}

/**
 * Validates that an obligation kind is one of the supported kinds.
 */
export function isValidObligationKind(kind: string): kind is ObligationKind {
  return OBLIGATION_KINDS.includes(kind as ObligationKind);
}

/**
 * Validates that a transaction category is one of the approved categories.
 */
export function isValidTransactionCategory(category: string): category is TransactionCategory {
  return TRANSACTION_CATEGORIES.includes(category as TransactionCategory);
}

/**
 * Normalizes a transaction category string by case-insensitive matching against approved categories.
 * Defaults to 'Other' if no match is found.
 */
export function normalizeTransactionCategory(category: string): TransactionCategory {
  const trimmed = category.trim().toLowerCase();
  const match = TRANSACTION_CATEGORIES.find((c) => c.toLowerCase() === trimmed);
  return match || 'Other';
}

/**
 * Validates and normalizes monetary amount to a positive Prisma.Decimal.
 * Rejects 0, negative amounts, non-numeric values, or values with more than 2 decimal places.
 */
export const MAX_FINANCIAL_AMOUNT = new Prisma.Decimal('999999999999.99');

export function parseAndValidateAmount(raw: Prisma.Decimal | number | string): Prisma.Decimal {
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(raw);
  } catch {
    throw new Error('Invalid monetary amount');
  }

  if (d.isNaN() || !d.isFinite()) {
    throw new Error('Invalid monetary amount: must be a finite number');
  }

  if (d.lessThanOrEqualTo(0)) {
    throw new Error('Monetary amount must be strictly positive');
  }

  // Check decimal places (max 2 decimal places for INR/currency)
  if (d.decimalPlaces() > 2) {
    throw new Error('Monetary amount cannot have more than 2 decimal places');
  }

  // Check upper bound for Decimal(14,2) precision
  if (d.greaterThan(MAX_FINANCIAL_AMOUNT)) {
    throw new Error('Monetary amount exceeds maximum allowable limit');
  }

  return d;
}

/**
 * Validates that a transfer operation meets all business invariants:
 * 1. Source and destination accounts are distinct.
 * 2. Both accounts belong to the same authenticated user.
 * 3. Amount is strictly positive.
 */
export function validateTransferInvariants(params: {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAccountUserId: string;
  destinationAccountUserId: string;
  currentUserId: string;
  amount: Prisma.Decimal | number | string;
}): Prisma.Decimal {
  const {
    sourceAccountId,
    destinationAccountId,
    sourceAccountUserId,
    destinationAccountUserId,
    currentUserId,
    amount
  } = params;

  if (sourceAccountId === destinationAccountId) {
    throw new Error('Transfer source and destination accounts must be distinct');
  }

  if (sourceAccountUserId !== currentUserId || destinationAccountUserId !== currentUserId) {
    throw new Error('Both transfer accounts must belong to the authenticated user');
  }

  return parseAndValidateAmount(amount);
}

/**
 * Computes derived account balance from opening balance and list of posted transactions.
 * - INCOME to this account: + amount
 * - EXPENSE from this account: - amount
 * - TRANSFER where this account is source: - amount
 * - TRANSFER where this account is destination (transferAccountId): + amount
 */
export function calculateAccountBalance(
  openingBalance: Prisma.Decimal | number | string,
  transactions: Array<{
    type: string;
    amount: Prisma.Decimal | number | string;
    accountId: string;
    transferAccountId?: string | null;
  }>,
  targetAccountId: string
): Prisma.Decimal {
  let balance = new Prisma.Decimal(openingBalance);

  for (const tx of transactions) {
    const amount = new Prisma.Decimal(tx.amount);
    if (tx.type === 'INCOME' && tx.accountId === targetAccountId) {
      balance = balance.plus(amount);
    } else if (tx.type === 'EXPENSE' && tx.accountId === targetAccountId) {
      balance = balance.minus(amount);
    } else if (tx.type === 'TRANSFER') {
      if (tx.accountId === targetAccountId) {
        // Outgoing transfer
        balance = balance.minus(amount);
      } else if (tx.transferAccountId === targetAccountId) {
        // Incoming transfer
        balance = balance.plus(amount);
      }
    } else if (tx.type === 'LEND' && tx.accountId === targetAccountId) {
      // Cash lent to friend/family: account decreases
      balance = balance.minus(amount);
    } else if (tx.type === 'DEBT_COLLECT' && tx.accountId === targetAccountId) {
      // Cash collected back from friend/family: account increases
      balance = balance.plus(amount);
    } else if (tx.type === 'BORROW' && tx.accountId === targetAccountId) {
      // Cash borrowed from friend/family: account increases
      balance = balance.plus(amount);
    } else if (tx.type === 'DEBT_REPAY' && tx.accountId === targetAccountId) {
      // Cash repaid to friend/family: account decreases
      balance = balance.minus(amount);
    }
  }

  return balance;
}

/**
 * Computes credit card usage (amount used / outstanding) and available credit
 * from opening balance and ledger transactions.
 * - Card expenses increase used
 * - Payments (transfers into card) decrease used
 * - Income / refunds to card decrease used
 * - Transfers out of card increase used
 * Available Credit = Credit Limit - Amount Used
 */
export function calculateCreditCardUsage(
  openingBalance: Prisma.Decimal | number | string = 0,
  transactions: Array<{
    type: string;
    amount: Prisma.Decimal | number | string;
    accountId: string;
    transferAccountId?: string | null;
  }>,
  creditCardAccountId: string,
  creditLimit?: Prisma.Decimal | number | string | null
): {
  amountUsed: Prisma.Decimal;
  availableCredit: Prisma.Decimal | null;
} {
  let used = new Prisma.Decimal(openingBalance);

  for (const tx of transactions) {
    const amount = new Prisma.Decimal(tx.amount);
    if (tx.accountId === creditCardAccountId) {
      if (tx.type === 'EXPENSE' || tx.type === 'DEBT_REPAY' || tx.type === 'LEND') {
        used = used.plus(amount);
      } else if (tx.type === 'INCOME' || tx.type === 'DEBT_COLLECT' || tx.type === 'BORROW') {
        used = used.minus(amount);
      } else if (tx.type === 'TRANSFER') {
        used = used.plus(amount);
      }
    } else if (tx.transferAccountId === creditCardAccountId) {
      if (tx.type === 'TRANSFER') {
        used = used.minus(amount);
      }
    }
  }

  let availableCredit: Prisma.Decimal | null = null;
  if (creditLimit !== undefined && creditLimit !== null) {
    const limit = new Prisma.Decimal(creditLimit);
    availableCredit = limit.minus(used);
  }

  return { amountUsed: used, availableCredit };
}

/**
 * Computes monthly income and expense totals from transactions.
 * Non-negotiable invariant: TRANSFER and personal debt transactions (LEND, BORROW,
 * DEBT_COLLECT, DEBT_REPAY) move value between accounts/persons and must NEVER
 * inflate income or expense totals.
 */
export function calculateMonthlyTotals(
  transactions: Array<{
    type: string;
    amount: Prisma.Decimal | number | string;
  }>
): { income: Prisma.Decimal; expense: Prisma.Decimal } {
  let income = new Prisma.Decimal(0);
  let expense = new Prisma.Decimal(0);

  for (const tx of transactions) {
    const amount = new Prisma.Decimal(tx.amount);
    if (tx.type === 'INCOME') {
      income = income.plus(amount);
    } else if (tx.type === 'EXPENSE') {
      expense = expense.plus(amount);
    }
    // Note: TRANSFER, LEND, BORROW, DEBT_COLLECT, DEBT_REPAY are strictly excluded from income and expense!
  }

  return { income, expense };
}

/**
 * Computes category-wise expense breakdown.
 * Invariant: Sum of category breakdown reconciles exactly to total expense.
 */
export function calculateCategoryBreakdown(
  transactions: Array<{
    type: string;
    category: string;
    amount: Prisma.Decimal | number | string;
  }>
): Record<string, Prisma.Decimal> {
  const breakdown: Record<string, Prisma.Decimal> = {};

  for (const tx of transactions) {
    if (tx.type === 'EXPENSE') {
      const cat = tx.category || 'Other';
      const amount = new Prisma.Decimal(tx.amount);
      breakdown[cat] = (breakdown[cat] || new Prisma.Decimal(0)).plus(amount);
    }
  }

  return breakdown;
}

/**
 * Formats a monetary amount into INR string representation (e.g., ₹1,250.00).
 */
export function formatINR(amount: Prisma.Decimal | number | string): string {
  const d = new Prisma.Decimal(amount);
  const num = d.toNumber();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Computes outstanding balance for a PersonalDebt.
 * For RECEIVABLE: sum(LEND) - sum(DEBT_COLLECT)
 * For PAYABLE:    sum(BORROW) - sum(DEBT_REPAY)
 * Opening principal is added unless an initial LEND/BORROW already posted it.
 * Invariant: Outstanding must never be negative.
 */
export function calculateDebtOutstanding(
  direction: string,
  originalAmount: Prisma.Decimal | number | string,
  transactions: Array<{
    type: string;
    amount: Prisma.Decimal | number | string;
    note?: string | null;
  }>
): Prisma.Decimal {
  const orig = new Prisma.Decimal(originalAmount);
  let lendsOrBorrows = new Prisma.Decimal(0);
  let collectsOrRepays = new Prisma.Decimal(0);
  const principalType = direction === 'RECEIVABLE' ? 'LEND' : 'BORROW';
  const hasInitialPosted = transactions.some(t => t.type === principalType && (
    t.note?.includes('[initialPrincipal:true]') ||
    (new Prisma.Decimal(t.amount).equals(orig) && !t.note?.startsWith('Additional'))
  ));

  for (const t of transactions) {
    const amt = new Prisma.Decimal(t.amount);
    if (direction === 'RECEIVABLE') {
      if (t.type === 'LEND') {
        lendsOrBorrows = lendsOrBorrows.plus(amt);
      } else if (t.type === 'DEBT_COLLECT') {
        collectsOrRepays = collectsOrRepays.plus(amt);
      }
    } else if (direction === 'PAYABLE') {
      if (t.type === 'BORROW') {
        lendsOrBorrows = lendsOrBorrows.plus(amt);
      } else if (t.type === 'DEBT_REPAY') {
        collectsOrRepays = collectsOrRepays.plus(amt);
      }
    }
  }

  const totalPrincipal = hasInitialPosted ? lendsOrBorrows : orig.plus(lendsOrBorrows);
  const outstanding = totalPrincipal.minus(collectsOrRepays);

  return outstanding.greaterThan(0) ? outstanding : new Prisma.Decimal(0);
}
