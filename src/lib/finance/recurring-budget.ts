/**
 * Recurring Budget Utility Functions
 *
 * Normalizes recurring obligations into their monthly equivalent for budgeting.
 */

export interface RecurringAmountInput {
  amount?: number | string | null;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
}

/**
 * Normalizes an obligation amount to its monthly recurring equivalent based on recurrenceType.
 * Excludes one-time (ONCE) obligations (returns 0).
 */
export function calculateMonthlyRecurringAmount(
  amountOrObligation:
    | number
    | string
    | null
    | undefined
    | RecurringAmountInput,
  recurrenceTypeArg?: string,
  recurrenceIntervalArg?: number | null
): number {
  let amount: number | string | null | undefined;
  let recurrenceType: string;
  let recurrenceInterval: number | null | undefined;

  if (typeof amountOrObligation === 'object' && amountOrObligation !== null) {
    amount = amountOrObligation.amount;
    recurrenceType = amountOrObligation.recurrenceType || '';
    recurrenceInterval = amountOrObligation.recurrenceInterval;
  } else {
    amount = amountOrObligation;
    recurrenceType = recurrenceTypeArg || '';
    recurrenceInterval = recurrenceIntervalArg;
  }

  const numericAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || '0')) || 0;
  if (!numericAmount || numericAmount <= 0) return 0;

  const interval = recurrenceInterval && recurrenceInterval > 0 ? recurrenceInterval : 1;

  switch (recurrenceType) {
    case 'MONTHLY':
      return numericAmount / interval;
    case 'YEARLY':
      return (numericAmount / 12) / interval;
    case 'WEEKLY':
      return ((numericAmount * 52) / 12) / interval;
    case 'DAILY':
      return (numericAmount * (365 / 12)) / interval;
    case 'EVERY_N_DAYS':
      return numericAmount * (30.4375 / interval);
    case 'ONCE':
    default:
      return 0;
  }
}
