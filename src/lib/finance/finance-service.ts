import { prisma as defaultPrisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  isValidAccountType,
  isValidTransactionType,
  isValidObligationKind,
  isValidTransactionCategory,
  parseAndValidateAmount,
  validateTransferInvariants,
  calculateAccountBalance,
  calculateCreditCardUsage,
  calculateMonthlyTotals,
  calculateCategoryBreakdown,
  calculateDebtOutstanding,
  Decimal
} from '@/lib/finance/finance';
import { getNextOccurrence, getOccurrenceKey, RecurrenceRule } from '@/lib/recurrence/recurrence';
import { TZDate } from '@date-fns/tz';
import { recordEmiPayment, revertEmiPayment } from './loan-service';
import { recordCreditCardPayment, revertCreditCardPayment } from './credit-card-service';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.string().refine(isValidAccountType, 'Invalid account type'),
  institution: z.string().max(100).optional().nullable(),
  openingBalance: z.union([z.number(), z.string(), z.instanceof(Decimal)]).default('0'),
  creditLimit: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  statementDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentDueDay: z.number().int().min(1).max(31).optional().nullable(),
  defaultPaymentAccountId: z.string().optional().nullable(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  type: z.string().refine(isValidAccountType, 'Invalid account type').optional(),
  institution: z.string().max(100).optional().nullable(),
  openingBalance: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional(),
  creditLimit: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  statementDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentDueDay: z.number().int().min(1).max(31).optional().nullable(),
  defaultPaymentAccountId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const recordTransactionSchema = z.object({
  type: z.string().refine(isValidTransactionType, 'Invalid transaction type'),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  category: z.string().refine(isValidTransactionCategory, 'Invalid transaction category'),
  occurredAt: z.string().or(z.date()),
  accountId: z.string().min(1, 'Account is required'),
  transferAccountId: z.string().optional().nullable(),
  obligationId: z.string().optional().nullable(),
  note: z.string().max(255).optional().nullable(),
});

export const updateTransactionSchema = z.object({
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional(),
  category: z.string().refine(isValidTransactionCategory, 'Invalid transaction category').optional(),
  occurredAt: z.string().or(z.date()).optional(),
  accountId: z.string().min(1, 'Account is required').optional(),
  transferAccountId: z.string().optional().nullable(),
  note: z.string().max(255).optional().nullable(),
});

export const createObligationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  kind: z.string().refine(isValidObligationKind, 'Invalid obligation kind'),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  accountId: z.string().optional().nullable(),
  dueAt: z.string().or(z.date()),
  recurrenceType: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'EVERY_N_DAYS']),
  recurrenceInterval: z.number().int().min(1).optional().nullable(),
  reminderOffsetsMin: z.array(z.number().int().min(0)).default([0]),
  notes: z.string().max(255).optional().nullable(),
});

export const updateObligationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100).optional(),
  kind: z.string().refine(isValidObligationKind, 'Invalid obligation kind').optional(),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  accountId: z.string().optional().nullable(),
  dueAt: z.string().or(z.date()).optional(),
  recurrenceType: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'EVERY_N_DAYS']).optional(),
  recurrenceInterval: z.number().int().min(1).optional().nullable(),
  reminderOffsetsMin: z.array(z.number().int().min(0)).optional(),
  notes: z.string().max(255).optional().nullable(),
  nextDueAt: z.string().or(z.date()).optional(),
  isActive: z.boolean().optional(),
});

export const OCCURRENCE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

type PrismaClientLike = any;

/**
 * Lists all active accounts for the user, computing derived balances server-side.
 */
export async function getAccounts(userId: string, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const accounts = await db.financialAccount.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      transactions: true,
      transfersTo: true,
    }
  });

  return accounts.map((acc: any) => {
    const allTx = [
      ...acc.transactions.map((t: any) => ({
        type: t.type,
        amount: t.amount,
        accountId: t.accountId,
        transferAccountId: t.transferAccountId,
      })),
      ...acc.transfersTo.map((t: any) => ({
        type: t.type,
        amount: t.amount,
        accountId: t.accountId,
        transferAccountId: t.transferAccountId,
      }))
    ];

    const currentBalance = calculateAccountBalance(acc.openingBalance, allTx, acc.id);
    const isCreditCard = acc.type === 'CREDIT_CARD';
    const ccUsage = isCreditCard
      ? calculateCreditCardUsage(acc.openingBalance, allTx, acc.id, acc.creditLimit)
      : null;

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      institution: acc.institution,
      openingBalance: acc.openingBalance.toString(),
      currentBalance: currentBalance.toString(),
      creditLimit: acc.creditLimit ? acc.creditLimit.toString() : null,
      amountUsed: ccUsage ? ccUsage.amountUsed.toString() : null,
      availableCredit: ccUsage && ccUsage.availableCredit ? ccUsage.availableCredit.toString() : null,
      statementDay: acc.statementDay,
      paymentDueDay: acc.paymentDueDay,
      defaultPaymentAccountId: acc.defaultPaymentAccountId,
      isActive: acc.isActive,
      createdAt: acc.createdAt ? (acc.createdAt instanceof Date ? acc.createdAt.toISOString() : String(acc.createdAt)) : new Date().toISOString(),
      updatedAt: acc.updatedAt ? (acc.updatedAt instanceof Date ? acc.updatedAt.toISOString() : String(acc.updatedAt)) : new Date().toISOString(),
    };
  });
}

/**
 * Creates a new financial account owned by userId.
 */
export async function createAccount(userId: string, data: unknown, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = createAccountSchema.parse(data);

  const defaultPaymentAccountId =
    parsed.defaultPaymentAccountId && parsed.defaultPaymentAccountId.trim() !== ''
      ? parsed.defaultPaymentAccountId.trim()
      : null;

  if (defaultPaymentAccountId) {
    const defAcc = await db.financialAccount.findUnique({
      where: { id: defaultPaymentAccountId },
      select: { userId: true, type: true }
    });
    if (!defAcc || defAcc.userId !== userId || !['BANK', 'CASH', 'WALLET'].includes(defAcc.type)) {
      throw new Error('Default payment account not found or unauthorized');
    }
  }

  const openingBalanceDecimal = parsed.openingBalance
    ? new Decimal(parsed.openingBalance.toString())
    : new Decimal(0);

  const creditLimitDecimal = parsed.creditLimit
    ? new Decimal(parsed.creditLimit.toString())
    : null;

  const account = await db.financialAccount.create({
    data: {
      userId,
      name: parsed.name,
      type: parsed.type,
      institution: parsed.institution,
      openingBalance: openingBalanceDecimal,
      creditLimit: creditLimitDecimal,
      statementDay: parsed.statementDay ?? null,
      paymentDueDay: parsed.paymentDueDay ?? null,
      defaultPaymentAccountId,
      isActive: true,
    }
  });

  return {
    success: true,
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      openingBalance: account.openingBalance.toString(),
      statementDay: account.statementDay,
      paymentDueDay: account.paymentDueDay,
      defaultPaymentAccountId: account.defaultPaymentAccountId,
    }
  };
}

/**
 * Updates financial account metadata.
 * V2-1002 / V2-Q002: openingBalance is editable ONLY when account has zero posted transactions.
 */
export async function updateAccount(
  userId: string,
  accountId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = updateAccountSchema.parse(data);

  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
    select: { userId: true, openingBalance: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  const updateData: any = {};
  if (parsed.name !== undefined) updateData.name = parsed.name;
  if (parsed.type !== undefined) updateData.type = parsed.type;
  if (parsed.institution !== undefined) updateData.institution = parsed.institution;
  if (parsed.creditLimit !== undefined) {
    updateData.creditLimit = parsed.creditLimit !== null ? parseAndValidateAmount(parsed.creditLimit.toString()) : null;
  }
  if (parsed.statementDay !== undefined) updateData.statementDay = parsed.statementDay;
  if (parsed.paymentDueDay !== undefined) updateData.paymentDueDay = parsed.paymentDueDay;
  if (parsed.defaultPaymentAccountId !== undefined) {
    if (parsed.defaultPaymentAccountId !== null && parsed.defaultPaymentAccountId.trim() !== '') {
      const defId = parsed.defaultPaymentAccountId.trim();
      if (defId === accountId) {
        throw new Error('Default payment account not found or unauthorized');
      }
      const defAcc = await db.financialAccount.findUnique({
        where: { id: defId },
        select: { userId: true, type: true }
      });
      if (!defAcc || defAcc.userId !== userId || !['BANK', 'CASH', 'WALLET'].includes(defAcc.type)) {
        throw new Error('Default payment account not found or unauthorized');
      }
      updateData.defaultPaymentAccountId = defId;
    } else {
      updateData.defaultPaymentAccountId = null;
    }
  }
  if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;

  // V2-1002 / V2-Q002: openingBalance editable ONLY when account has zero posted transactions
  if (parsed.openingBalance !== undefined) {
    const txCount = await db.financialTransaction.count({
      where: {
        OR: [
          { accountId },
          { transferAccountId: accountId }
        ]
      }
    });

    if (txCount > 0) {
      throw new Error('Opening balance cannot be modified after transactions have been posted to this account');
    }

    const ob = new Decimal(parsed.openingBalance.toString());
    if (ob.lessThan(0)) {
      throw new Error('Opening balance cannot be negative');
    }
    updateData.openingBalance = ob;
  }

  const updated = await db.financialAccount.update({
    where: { id: accountId },
    data: updateData
  });

  return {
    success: true,
    account: {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      institution: updated.institution,
      openingBalance: updated.openingBalance.toString(),
      creditLimit: updated.creditLimit ? updated.creditLimit.toString() : null,
      statementDay: updated.statementDay,
      paymentDueDay: updated.paymentDueDay,
      defaultPaymentAccountId: updated.defaultPaymentAccountId,
      isActive: updated.isActive,
    }
  };
}

/**
 * Archives an account (soft delete) preserving historical transactions.
 */
export async function archiveAccount(userId: string, accountId: string, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
    select: { userId: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  await db.financialAccount.update({
    where: { id: accountId },
    data: { isActive: false }
  });

  return { success: true };
}

/**
 * Lists transactions for user with date filtering.
 */
export async function getTransactions(
  userId: string,
  options: {
    limit?: number;
    startDate?: Date | string;
    endDate?: Date | string;
    accountId?: string;
  } = {},
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const where: any = { userId };

  if (options.startDate || options.endDate) {
    where.occurredAt = {};
    if (options.startDate) where.occurredAt.gte = new Date(options.startDate);
    if (options.endDate) where.occurredAt.lte = new Date(options.endDate);
  }

  if (options.accountId) {
    where.OR = [
      { accountId: options.accountId },
      { transferAccountId: options.accountId }
    ];
  }

  const transactions = await db.financialTransaction.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: options.limit || 50,
    include: {
      account: { select: { id: true, name: true, type: true } },
      transferAccount: { select: { id: true, name: true, type: true } },
      obligation: { select: { id: true, title: true, kind: true } },
      obligationOccurrence: { select: { id: true } },
      loanPayment: { select: { id: true } },
      wishlistItem: { select: { id: true } },
      creditCardPayment: { select: { id: true } },
    }
  });

  return transactions.map((t: any) => ({
    id: t.id,
    type: t.type,
    amount: t.amount.toString(),
    category: t.category,
    occurredAt: t.occurredAt.toISOString(),
    accountId: t.accountId,
    transferAccountId: t.transferAccountId,
    account: t.account,
    transferAccount: t.transferAccount,
    obligation: t.obligation,
    personalDebtId: t.personalDebtId,
    obligationOccurrence: t.obligationOccurrence,
    loanPayment: t.loanPayment,
    wishlistItem: t.wishlistItem,
    creditCardPayment: t.creditCardPayment,
    isSystemManaged: Boolean(
      t.obligationOccurrence ||
      t.loanPayment ||
      t.wishlistItem ||
      t.creditCardPayment ||
      t.personalDebtId
    ),
    note: t.note,
    createdAt: t.createdAt.toISOString(),
  }));
}

/**
 * Records a new financial transaction enforcing server-side ownership and transfer invariants.
 */
export async function recordTransaction(userId: string, data: unknown, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = recordTransactionSchema.parse(data);

  // Validate amount > 0
  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  // Validate primary account ownership
  const sourceAccount = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!sourceAccount || sourceAccount.userId !== userId) {
    throw new Error('Primary account not found or unauthorized');
  }

  // Handle transfer invariants
  let transferAccountId: string | null = null;
  if (parsed.type === 'TRANSFER') {
    if (!parsed.transferAccountId) {
      throw new Error('Transfer requires a destination account');
    }

    const destAccount = await db.financialAccount.findUnique({
      where: { id: parsed.transferAccountId },
      select: { userId: true, isActive: true }
    });

    if (!destAccount || destAccount.userId !== userId) {
      throw new Error('Destination transfer account not found or unauthorized');
    }

    validateTransferInvariants({
      sourceAccountId: parsed.accountId,
      destinationAccountId: parsed.transferAccountId,
      sourceAccountUserId: sourceAccount.userId,
      destinationAccountUserId: destAccount.userId,
      currentUserId: userId,
      amount: amountDecimal,
    });

    transferAccountId = parsed.transferAccountId;
  }

  // Validate obligation if linked
  if (parsed.obligationId) {
    const ob = await db.obligation.findUnique({
      where: { id: parsed.obligationId },
      select: { userId: true }
    });
    if (!ob || ob.userId !== userId) {
      throw new Error('Linked obligation not found or unauthorized');
    }
  }

  const occurredAtDate = new Date(parsed.occurredAt);

  const tx = await db.financialTransaction.create({
    data: {
      userId,
      type: parsed.type,
      amount: amountDecimal,
      category: parsed.category,
      occurredAt: occurredAtDate,
      accountId: parsed.accountId,
      transferAccountId,
      obligationId: parsed.obligationId || null,
      note: parsed.note || null,
    }
  });

  return {
    success: true,
    transaction: {
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category,
    }
  };
}

/**
 * Updates a standalone transaction.
 * V2-1007: Block generic edits on obligation/debt/loan/wishlist-linked records.
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = updateTransactionSchema.parse(data);

  const tx = await db.financialTransaction.findUnique({
    where: { id: transactionId },
    include: {
      obligationOccurrence: true,
      loanPayment: true,
      wishlistItem: true,
      creditCardPayment: true,
    }
  });

  if (!tx || tx.userId !== userId) {
    throw new Error('Transaction not found or unauthorized');
  }

  // V2-1007: Linked-transaction restrictions
  if (
    tx.obligationOccurrence ||
    tx.loanPayment ||
    tx.wishlistItem ||
    tx.creditCardPayment ||
    tx.personalDebtId
  ) {
    throw new Error('Linked transaction cannot be modified directly through generic transaction editor');
  }

  const updateData: any = {};
  if (parsed.category !== undefined) updateData.category = parsed.category;
  if (parsed.occurredAt !== undefined) updateData.occurredAt = new Date(parsed.occurredAt);
  if (parsed.note !== undefined) updateData.note = parsed.note;

  if (parsed.amount !== undefined) {
    updateData.amount = parseAndValidateAmount(parsed.amount.toString());
  }

  const newAccountId = parsed.accountId ?? tx.accountId;
  if (parsed.accountId !== undefined && parsed.accountId !== tx.accountId) {
    const acc = await db.financialAccount.findUnique({
      where: { id: newAccountId },
      select: { userId: true, isActive: true }
    });
    if (!acc || acc.userId !== userId) {
      throw new Error('Primary account not found or unauthorized');
    }
    updateData.accountId = newAccountId;
  }

  if (tx.type === 'TRANSFER') {
    const newTransferAccountId = parsed.transferAccountId !== undefined ? parsed.transferAccountId : tx.transferAccountId;
    if (!newTransferAccountId) {
      throw new Error('Transfer requires a destination account');
    }

    if (newAccountId === newTransferAccountId) {
      throw new Error('Transfer source and destination accounts must be distinct');
    }

    const destAcc = await db.financialAccount.findUnique({
      where: { id: newTransferAccountId },
      select: { userId: true, isActive: true }
    });
    if (!destAcc || destAcc.userId !== userId) {
      throw new Error('Destination transfer account not found or unauthorized');
    }

    updateData.transferAccountId = newTransferAccountId;
  }

  const updated = await db.financialTransaction.update({
    where: { id: transactionId },
    data: updateData
  });

  return {
    success: true,
    transaction: {
      id: updated.id,
      type: updated.type,
      amount: updated.amount.toString(),
      category: updated.category,
      occurredAt: updated.occurredAt instanceof Date ? updated.occurredAt.toISOString() : String(updated.occurredAt),
      accountId: updated.accountId,
      transferAccountId: updated.transferAccountId,
      note: updated.note,
    }
  };
}

/**
 * Deletes a transaction with authorization verification and domain-linked protection.
 * V2-1007: Block generic delete on obligation/debt/loan/wishlist-linked records.
 */
export async function deleteTransaction(userId: string, transactionId: string, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const tx = await db.financialTransaction.findUnique({
    where: { id: transactionId },
    include: {
      obligationOccurrence: true,
      loanPayment: true,
      wishlistItem: true,
      creditCardPayment: true,
    }
  });

  if (!tx || tx.userId !== userId) {
    throw new Error('Transaction not found or unauthorized');
  }

  // V2-1007: Linked-transaction restrictions
  if (
    tx.obligationOccurrence ||
    tx.loanPayment ||
    tx.wishlistItem ||
    tx.creditCardPayment ||
    tx.personalDebtId
  ) {
    throw new Error('Linked transaction cannot be deleted directly through generic transaction editor');
  }

  await db.financialTransaction.delete({
    where: { id: transactionId }
  });

  return { success: true };
}

/**
 * Returns month-scoped financial summary (income, expense, category breakdown).
 */
export async function getMonthlyFinanceSummary(
  userId: string,
  targetDate: Date | string = new Date(),
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone || 'Asia/Kolkata';

  const parsedTargetDate = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const d = new TZDate(parsedTargetDate, tz);
  const year = d.getFullYear();
  const month = d.getMonth();
  const startOfMonth = new Date(new TZDate(year, month, 1, 0, 0, 0, 0, tz).getTime());
  const startOfNextMonth = new Date(new TZDate(year, month + 1, 1, 0, 0, 0, 0, tz).getTime());

  const monthlyTransactions = await db.financialTransaction.findMany({
    where: {
      userId,
      occurredAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      }
    }
  });

  const totals = calculateMonthlyTotals(monthlyTransactions);
  const categoryBreakdown = calculateCategoryBreakdown(monthlyTransactions);

  const accounts = await getAccounts(userId, db);
  const totalBalance = accounts.reduce(
    (acc: any, a: any) => acc.plus(new Decimal(a.currentBalance)),
    new Decimal(0)
  );

  const formattedBreakdown: Record<string, string> = {};
  for (const cat in categoryBreakdown) {
    formattedBreakdown[cat] = categoryBreakdown[cat].toString();
  }

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    income: totals.income.toString(),
    expense: totals.expense.toString(),
    totalBalance: totalBalance.toString(),
    categoryBreakdown: formattedBreakdown,
    accountCount: accounts.length,
    transactionCount: monthlyTransactions.length,
  };
}

export interface MoneyOverviewData {
  liquidBalance: string;
  monthlyIncome: string;
  monthlyExpense: string;
  receivablesOutstanding: string;
  payablesOutstanding: string;
  totalLoanOutstanding: string;
  monthlyEmiCommitment: string;
  nextEmi: {
    id: string;
    name: string;
    lender: string;
    amount: string | null;
    dueDay: number | null;
    nextEmiDate: string | null;
  } | null;
  nextObligation: {
    id: string;
    title: string;
    amount: string | null;
    nextDueAt: string;
    kind: string;
  } | null;
  wishlistPlannedTotal: string;
  wishlistReadyTotal: string;
  activeWishlistCount: number;
  highPriorityWishlist: Array<{
    id: string;
    name: string;
    category: string;
    targetPrice: string;
    priority: string;
    status: string;
  }>;
  debtsDueSoon: Array<{
    id: string;
    direction: string;
    counterpartyName: string;
    title: string | null;
    outstandingAmount: string;
    dueAt: string | null;
    isOverdue: boolean;
  }>;
  loansDueSoon: Array<{
    id: string;
    name: string;
    lender: string;
    outstandingPrincipal: string;
    emiAmount: string | null;
    nextEmiDate: string | null;
    dueDay: number | null;
  }>;
}

/**
 * Returns comprehensive v0.2 Money Overview read model:
 * liquid balance, monthly income/expense, debts owed to/by user,
 * loan liabilities & next EMI, wishlist planned totals, upcoming bills.
 */
export async function getMoneyOverview(
  userId: string,
  targetDate: Date | string = new Date(),
  db: PrismaClientLike = defaultPrisma
): Promise<MoneyOverviewData> {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone || 'Asia/Kolkata';

  const now = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const d = new TZDate(now, tz);
  const year = d.getFullYear();
  const month = d.getMonth();
  const startOfMonth = new Date(new TZDate(year, month, 1, 0, 0, 0, 0, tz).getTime());
  const startOfNextMonth = new Date(new TZDate(year, month + 1, 1, 0, 0, 0, 0, tz).getTime());

  // Parallel fetch of domain aggregates
  const [accounts, monthlyTransactions, openDebts, activeLoans, wishlistItems, obligations] =
    await Promise.all([
      getAccounts(userId, db),
      db.financialTransaction.findMany({
        where: {
          userId,
          occurredAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
      }),
      db.personalDebt.findMany({
        where: { userId, status: 'OPEN' },
        include: {
          transactions: {
            select: { type: true, amount: true, note: true },
          },
        },
        orderBy: { dueAt: 'asc' },
      }),
      db.loan.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: [{ nextEmiDate: 'asc' }, { dueDay: 'asc' }],
      }),
      db.wishlistItem.findMany({
        where: {
          userId,
          status: { in: ['WISHLIST', 'PLANNED', 'READY'] },
        },
        orderBy: [{ priority: 'desc' }, { targetDate: 'asc' }],
      }),
      db.obligation.findMany({
        where: { userId, isActive: true, isArchived: false },
        orderBy: { nextDueAt: 'asc' },
      }),
    ]);

  // 1. Liquid balance
  const liquidBalance = accounts.reduce(
    (acc: any, a: any) => acc.plus(new Decimal(a.currentBalance)),
    new Decimal(0)
  );

  // 2. Authoritative monthly income & expense
  const monthlyTotals = calculateMonthlyTotals(monthlyTransactions);

  // 3. Debts (Friends & Family)
  let receivablesSum = new Decimal(0);
  let payablesSum = new Decimal(0);
  const debtsDueSoon: MoneyOverviewData['debtsDueSoon'] = [];

  for (const d of openDebts) {
    const outstanding = calculateDebtOutstanding(d.direction, d.originalAmount, d.transactions);
    if (outstanding.gt(0)) {
      if (d.direction === 'RECEIVABLE') {
        receivablesSum = receivablesSum.plus(outstanding);
      } else {
        payablesSum = payablesSum.plus(outstanding);
      }

      const isOverdue = d.dueAt ? new Date(d.dueAt).getTime() < now.getTime() : false;
      debtsDueSoon.push({
        id: d.id,
        direction: d.direction,
        counterpartyName: d.counterpartyName,
        title: d.title,
        outstandingAmount: outstanding.toFixed(2),
        dueAt: d.dueAt ? new Date(d.dueAt).toISOString() : null,
        isOverdue,
      });
    }
  }

  debtsDueSoon.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt && !b.dueAt) return -1;
    if (!a.dueAt && b.dueAt) return 1;
    return 0;
  });

  // 4. Loans & EMI
  let totalLoanOutstanding = new Decimal(0);
  let monthlyEmiCommitment = new Decimal(0);
  const loansDueSoon: MoneyOverviewData['loansDueSoon'] = [];

  for (const l of activeLoans) {
    totalLoanOutstanding = totalLoanOutstanding.plus(new Decimal(l.outstandingPrincipal.toString()));
    if (l.emiAmount) {
      monthlyEmiCommitment = monthlyEmiCommitment.plus(new Decimal(l.emiAmount.toString()));
    }
    loansDueSoon.push({
      id: l.id,
      name: l.name,
      lender: l.lender,
      outstandingPrincipal: new Decimal(l.outstandingPrincipal.toString()).toFixed(2),
      emiAmount: l.emiAmount ? new Decimal(l.emiAmount.toString()).toFixed(2) : null,
      nextEmiDate: l.nextEmiDate ? new Date(l.nextEmiDate).toISOString() : null,
      dueDay: l.dueDay,
    });
  }

  const nextEmiLoan = loansDueSoon.length > 0 ? loansDueSoon[0] : null;

  // 5. Wishlist
  let wishlistPlannedTotal = new Decimal(0);
  let wishlistReadyTotal = new Decimal(0);

  // Sort wishlistItems by priority weight (HIGH > MEDIUM > LOW)
  const priorityWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  wishlistItems.sort((a: any, b: any) => {
    const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    if (a.targetDate && b.targetDate) return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    if (a.targetDate && !b.targetDate) return -1;
    if (!a.targetDate && b.targetDate) return 1;
    return 0;
  });

  for (const item of wishlistItems) {
    const itemPrice = new Decimal(item.targetPrice.toString());
    wishlistPlannedTotal = wishlistPlannedTotal.plus(itemPrice);
    if (item.status === 'READY') {
      wishlistReadyTotal = wishlistReadyTotal.plus(itemPrice);
    }
  }

  const highPriorityWishlist = wishlistItems.slice(0, 3).map((w: any) => ({
    id: w.id,
    name: w.name,
    category: w.category,
    targetPrice: new Decimal(w.targetPrice.toString()).toFixed(2),
    priority: w.priority,
    status: w.status,
  }));

  // 6. Nearest obligation
  const nextObligation = obligations.length > 0 ? {
    id: obligations[0].id,
    title: obligations[0].title,
    amount: obligations[0].amount ? new Decimal(obligations[0].amount.toString()).toFixed(2) : null,
    nextDueAt: obligations[0].nextDueAt.toISOString(),
    kind: obligations[0].kind,
  } : null;

  return {
    liquidBalance: liquidBalance.toFixed(2),
    monthlyIncome: monthlyTotals.income.toFixed(2),
    monthlyExpense: monthlyTotals.expense.toFixed(2),
    receivablesOutstanding: receivablesSum.toFixed(2),
    payablesOutstanding: payablesSum.toFixed(2),
    totalLoanOutstanding: totalLoanOutstanding.toFixed(2),
    monthlyEmiCommitment: monthlyEmiCommitment.toFixed(2),
    nextEmi: nextEmiLoan ? {
      id: nextEmiLoan.id,
      name: nextEmiLoan.name,
      lender: nextEmiLoan.lender,
      amount: nextEmiLoan.emiAmount,
      dueDay: nextEmiLoan.dueDay,
      nextEmiDate: nextEmiLoan.nextEmiDate,
    } : null,
    nextObligation,
    wishlistPlannedTotal: wishlistPlannedTotal.toFixed(2),
    wishlistReadyTotal: wishlistReadyTotal.toFixed(2),
    activeWishlistCount: wishlistItems.length,
    highPriorityWishlist,
    debtsDueSoon: debtsDueSoon.slice(0, 4),
    loansDueSoon: loansDueSoon.slice(0, 4),
  };
}

export interface ObligationItem {
  id: string;
  title: string;
  kind: string;
  amount: string | null;
  account: { id: string; name: string } | null;
  user?: { timezone: string } | null;
  dueAt: string;
  recurrenceType: string;
  recurrenceInterval: number | null;
  reminderOffsetsMin: number[];
  isActive: boolean;
  isArchived?: boolean;
  notes: string | null;
  lastCompletedAt: string | null;
  nextDueAt: string;
  loanId: string | null;
  linkedLoanName: string | null;
  loan?: { id: string; name: string } | null;
  isCreditCardStatement?: boolean;
  creditCardStatement?: {
    id: string;
    periodKey: string;
    status: string;
    statementAmount: string | null;
    dueDate: string | null;
    accountId: string;
    accountName?: string;
  } | null;
}

/**
 * Lists user obligations ordered by nextDueAt.
 */
export async function getObligations(
  userId: string,
  db: PrismaClientLike = defaultPrisma
): Promise<ObligationItem[]> {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const obligations = await db.obligation.findMany({
    where: {
      userId,
      OR: [
        { isArchived: false },
        { creditCardStatements: { some: {} } },
      ],
    },
    orderBy: { nextDueAt: 'asc' },
    include: {
      user: { select: { timezone: true } },
      account: { select: { id: true, name: true } },
      loan: { select: { id: true, name: true, emiAmount: true, nextEmiDate: true, dueDay: true } },
      creditCardStatements: {
        select: {
          id: true,
          periodKey: true,
          status: true,
          statementAmount: true,
          dueDate: true,
          accountId: true,
          account: { select: { id: true, name: true } },
        }
      },
      occurrences: {
        orderBy: { dueDate: 'desc' },
        take: 5,
      }
    }
  });

  return obligations.map((ob: any) => {
    const ccStmt = ob.creditCardStatements && ob.creditCardStatements.length > 0 ? ob.creditCardStatements[0] : null;
    return {
      id: ob.id,
      title: ob.title,
      kind: ob.kind,
      amount: ob.amount ? ob.amount.toString() : null,
      account: ob.account,
      user: ob.user ? { timezone: ob.user.timezone } : null,
      dueAt: ob.dueAt.toISOString(),
      recurrenceType: ob.recurrenceType,
      recurrenceInterval: ob.recurrenceInterval,
      reminderOffsetsMin: ob.reminderOffsetsMin,
      isActive: ob.isActive,
      isArchived: ob.isArchived,
      notes: ob.notes,
      lastCompletedAt: ob.lastCompletedAt ? ob.lastCompletedAt.toISOString() : null,
      nextDueAt: ob.nextDueAt.toISOString(),
      loanId: ob.loan?.id || null,
      linkedLoanName: ob.loan?.name || null,
      loan: ob.loan ? { id: ob.loan.id, name: ob.loan.name } : null,
      isCreditCardStatement: Boolean(ccStmt),
      creditCardStatement: ccStmt ? {
        id: ccStmt.id,
        periodKey: ccStmt.periodKey,
        status: ccStmt.status,
        statementAmount: ccStmt.statementAmount ? ccStmt.statementAmount.toString() : null,
        dueDate: ccStmt.dueDate ? ccStmt.dueDate.toISOString() : null,
        accountId: ccStmt.accountId,
        accountName: ccStmt.account?.name,
      } : null,
    };
  });
}

/**
 * Retrieves a single obligation by ID.
 * Exposes user.timezone in read model (SOL-R002-008).
 */
export async function getObligationById(
  userId: string,
  obligationId: string,
  db: PrismaClientLike = defaultPrisma
): Promise<ObligationItem> {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const ob = await db.obligation.findUnique({
    where: { id: obligationId },
    include: {
      user: { select: { timezone: true } },
      account: { select: { id: true, name: true } },
      loan: { select: { id: true, name: true, emiAmount: true, nextEmiDate: true, dueDay: true } },
      creditCardStatements: {
        select: {
          id: true,
          periodKey: true,
          status: true,
          statementAmount: true,
          dueDate: true,
          accountId: true,
          account: { select: { id: true, name: true } },
        }
      },
      occurrences: {
        orderBy: { dueDate: 'desc' },
        take: 5,
      }
    }
  });

  if (!ob || ob.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  const ccStmt = ob.creditCardStatements && ob.creditCardStatements.length > 0 ? ob.creditCardStatements[0] : null;
  return {
    id: ob.id,
    title: ob.title,
    kind: ob.kind,
    amount: ob.amount ? ob.amount.toString() : null,
    account: ob.account,
    user: ob.user ? { timezone: ob.user.timezone } : null,
    dueAt: ob.dueAt.toISOString(),
    recurrenceType: ob.recurrenceType,
    recurrenceInterval: ob.recurrenceInterval,
    reminderOffsetsMin: ob.reminderOffsetsMin,
    isActive: ob.isActive,
    isArchived: ob.isArchived,
    notes: ob.notes,
    lastCompletedAt: ob.lastCompletedAt ? ob.lastCompletedAt.toISOString() : null,
    nextDueAt: ob.nextDueAt.toISOString(),
    loanId: ob.loan?.id || null,
    linkedLoanName: ob.loan?.name || null,
    loan: ob.loan ? { id: ob.loan.id, name: ob.loan.name } : null,
    isCreditCardStatement: Boolean(ccStmt),
    creditCardStatement: ccStmt ? {
      id: ccStmt.id,
      periodKey: ccStmt.periodKey,
      status: ccStmt.status,
      statementAmount: ccStmt.statementAmount ? ccStmt.statementAmount.toString() : null,
      dueDate: ccStmt.dueDate ? ccStmt.dueDate.toISOString() : null,
      accountId: ccStmt.accountId,
      accountName: ccStmt.account?.name,
    } : null,
  };
}

/**
 * Creates a new recurring or one-time obligation with deterministic nextDueAt calculation.
 */
export async function createObligation(userId: string, data: unknown, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = createObligationSchema.parse(data);

  if (parsed.accountId) {
    const acc = await db.financialAccount.findUnique({
      where: { id: parsed.accountId },
      select: { userId: true }
    });
    if (!acc || acc.userId !== userId) {
      throw new Error('Default account not found or unauthorized');
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || 'UTC';

  const dueAtDate = typeof parsed.dueAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueAt.trim())
    ? (() => {
        const [y, m, d] = parsed.dueAt.trim().split('-').map(Number);
        return new Date(new TZDate(y, m - 1, d, 12, 0, 0, 0, tz).getTime());
      })()
    : new Date(parsed.dueAt);
  const amountDecimal = parsed.amount ? parseAndValidateAmount(parsed.amount.toString()) : null;

  const rule: RecurrenceRule = {
    type: parsed.recurrenceType,
    interval: parsed.recurrenceInterval,
    timezone: tz,
  };

  const now = new Date();
  const nextDueAt = dueAtDate.getTime() >= now.getTime()
    ? dueAtDate
    : (getNextOccurrence(rule, dueAtDate, now) || dueAtDate);

  const obligation = await db.obligation.create({
    data: {
      userId,
      title: parsed.title,
      kind: parsed.kind,
      amount: amountDecimal,
      accountId: parsed.accountId || null,
      dueAt: dueAtDate,
      recurrenceType: parsed.recurrenceType,
      recurrenceInterval: parsed.recurrenceInterval || null,
      reminderOffsetsMin: parsed.reminderOffsetsMin,
      isActive: true,
      notes: parsed.notes || null,
      nextDueAt,
    }
  });

  return {
    success: true,
    obligation: {
      id: obligation.id,
      title: obligation.title,
      nextDueAt: obligation.nextDueAt.toISOString(),
    }
  };
}

/**
 * Updates an obligation with authorization verification.
 * Recurrence/dueAt recalculates nextDueAt if necessary.
 * Existing completed occurrences remain immutable (V2-T086).
 */
export async function updateObligation(
  userId: string,
  obligationId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = updateObligationSchema.parse(data);

  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    select: {
      id: true,
      userId: true,
      dueAt: true,
      recurrenceType: true,
      recurrenceInterval: true,
      nextDueAt: true,
      loan: { select: { id: true, name: true } },
      creditCardStatements: { select: { id: true } },
      user: { select: { timezone: true } },
    }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  // SOL-R001-006: Protect credit card statement obligations
  if (
    obligation.creditCardStatements &&
    obligation.creditCardStatements.length > 0 &&
    (parsed.amount !== undefined ||
      parsed.dueAt !== undefined ||
      parsed.nextDueAt !== undefined ||
      parsed.recurrenceType !== undefined ||
      parsed.recurrenceInterval !== undefined)
  ) {
    throw new Error(
      'Credit card statement obligations must be managed through the Credit Card statement workflow'
    );
  }

  if (
    obligation.loan &&
    (parsed.amount !== undefined ||
      parsed.dueAt !== undefined ||
      parsed.nextDueAt !== undefined ||
      parsed.recurrenceType !== undefined ||
      parsed.recurrenceInterval !== undefined)
  ) {
    throw new Error(
      'Linked loan obligations must be updated through the Loan manager to maintain schedule consistency'
    );
  }

  const updateData: any = {};
  if (parsed.title !== undefined) updateData.title = parsed.title;
  if (parsed.kind !== undefined) updateData.kind = parsed.kind;
  if (parsed.notes !== undefined) updateData.notes = parsed.notes;
  if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;
  if (parsed.reminderOffsetsMin !== undefined) updateData.reminderOffsetsMin = parsed.reminderOffsetsMin;

  if (parsed.amount !== undefined) {
    updateData.amount = parsed.amount !== null ? parseAndValidateAmount(parsed.amount.toString()) : null;
  }

  if (parsed.accountId !== undefined) {
    if (parsed.accountId) {
      const acc = await db.financialAccount.findUnique({
        where: { id: parsed.accountId },
        select: { userId: true }
      });
      if (!acc || acc.userId !== userId) {
        throw new Error('Default account not found or unauthorized');
      }
      updateData.accountId = parsed.accountId;
    } else {
      updateData.accountId = null;
    }
  }

  let scheduleChanged = false;
  let targetDueAt = obligation.dueAt;
  let targetRecurrenceType = obligation.recurrenceType;
  let targetRecurrenceInterval = obligation.recurrenceInterval;

  // Finding 4: Do NOT overwrite dueAt on edit unless anchor was explicitly changed
  const anchorExplicitlyChanged = parsed.dueAt !== undefined && new Date(parsed.dueAt).getTime() !== obligation.dueAt.getTime();
  if (anchorExplicitlyChanged) {
    const userTz = obligation.user?.timezone || 'UTC';
    targetDueAt = typeof parsed.dueAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueAt.trim())
      ? (() => {
          const [y, m, d] = parsed.dueAt.trim().split('-').map(Number);
          return new Date(new TZDate(y, m - 1, d, 12, 0, 0, 0, userTz).getTime());
        })()
      : new Date(parsed.dueAt!);
    updateData.dueAt = targetDueAt;
    scheduleChanged = true;
  }
  if (parsed.recurrenceType !== undefined && parsed.recurrenceType !== obligation.recurrenceType) {
    targetRecurrenceType = parsed.recurrenceType;
    updateData.recurrenceType = parsed.recurrenceType;
    scheduleChanged = true;
  }
  if (parsed.recurrenceInterval !== undefined && parsed.recurrenceInterval !== obligation.recurrenceInterval) {
    targetRecurrenceInterval = parsed.recurrenceInterval;
    updateData.recurrenceInterval = parsed.recurrenceInterval;
    scheduleChanged = true;
  }

  if (parsed.nextDueAt !== undefined) {
    updateData.nextDueAt = new Date(parsed.nextDueAt);
  } else if (scheduleChanged) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    const tz = user?.timezone || 'UTC';

    const rule: RecurrenceRule = {
      type: targetRecurrenceType as any,
      interval: targetRecurrenceInterval,
      timezone: tz,
    };

    const now = new Date();
    const nextDueAt = targetDueAt.getTime() >= now.getTime()
      ? targetDueAt
      : (getNextOccurrence(rule, targetDueAt, now) || targetDueAt);

    updateData.nextDueAt = nextDueAt;
  }

  // Cancel future unsent delivery claims on schedule edit or when deactivated (V2-652)
  if (scheduleChanged || parsed.isActive === false) {
    await db.reminderDelivery.deleteMany({
      where: {
        obligationId,
        status: 'PENDING',
      }
    });
  }

  const updated = await db.obligation.update({
    where: { id: obligationId },
    data: updateData,
  });

  return {
    success: true,
    obligation: {
      id: updated.id,
      title: updated.title,
      kind: updated.kind,
      amount: updated.amount ? updated.amount.toString() : null,
      dueAt: updated.dueAt.toISOString(),
      nextDueAt: updated.nextDueAt.toISOString(),
      isActive: updated.isActive,
    }
  };
}

/**
 * Toggles an obligation between Active and Paused (V2-652).
 * Cancels pending deliveries when paused; recalculates nextDueAt if overdue on resume.
 */
export async function toggleObligationActive(
  userId: string,
  obligationId: string,
  isActive: boolean,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    select: {
      userId: true,
      isArchived: true,
      nextDueAt: true,
      dueAt: true,
      recurrenceType: true,
      recurrenceInterval: true,
    }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  if (obligation.isArchived) {
    throw new Error('Cannot toggle status of an archived obligation');
  }

  if (!isActive) {
    // Pausing: cancel unsent deliveries
    await db.reminderDelivery.deleteMany({
      where: { obligationId, status: 'PENDING' }
    });
    await db.obligation.update({
      where: { id: obligationId },
      data: { isActive: false }
    });
  } else {
    // Resuming: if past due, calculate next valid due date from now
    const now = new Date();
    let nextDueAt = obligation.nextDueAt;
    if (obligation.nextDueAt.getTime() < now.getTime()) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { timezone: true }
      });
      const tz = user?.timezone || 'UTC';
      const rule: RecurrenceRule = {
        type: obligation.recurrenceType as any,
        interval: obligation.recurrenceInterval,
        timezone: tz,
      };
      nextDueAt = getNextOccurrence(rule, obligation.dueAt, now) || obligation.nextDueAt;
    }

    await db.obligation.update({
      where: { id: obligationId },
      data: { isActive: true, nextDueAt }
    });
  }

  return { success: true, isActive };
}

/**
 * Deletes an obligation only if it has zero completed occurrences (V2-652).
 * If historical payments exist, blocks deletion and advises archiving.
 */
export async function deleteObligation(
  userId: string,
  obligationId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    include: {
      occurrences: true,
      loan: true,
    }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  if (obligation.occurrences && obligation.occurrences.length > 0) {
    throw new Error(
      'Cannot delete obligation with payment history. Archive the obligation to preserve records.'
    );
  }

  if (obligation.loan) {
    throw new Error(
      'Cannot delete obligation linked to an active loan. Manage the loan directly.'
    );
  }

  // Delete deliveries first
  await db.reminderDelivery.deleteMany({
    where: { obligationId }
  });

  await db.obligation.delete({
    where: { id: obligationId }
  });

  return { success: true };
}

/**
 * Archives an obligation (soft delete) preserving all historical occurrences.
 */
export async function archiveObligation(
  userId: string,
  obligationId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    select: { userId: true }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  // Cancel unsent pending deliveries
  await db.reminderDelivery.deleteMany({
    where: { obligationId, status: 'PENDING' }
  });

  await db.obligation.update({
    where: { id: obligationId },
    data: { isArchived: true, isActive: false }
  });

  return { success: true };
}


/**
 * SOL-R001-007: Helper to match an obligation occurrence without fuzzy substring comparisons.
 * Supports exact key, exact scheduled instant, timezone-aware local/UTC occurrence keys,
 * and date-only calendar date matching in the user's timezone.
 * Eliminates false matches between adjacent daily occurrences in extreme timezones.
 */
export function matchesOccurrence(
  occ: { occurrenceKey?: string | null; dueDate?: Date | null },
  reqKey: string,
  tz: string = 'UTC',
  occurrenceScheduledDate?: Date
): boolean {
  if (!reqKey || !occ) return false;
  const key = reqKey.trim();
  if (!occ.dueDate) return occ.occurrenceKey === key;
  const dueTime = occ.dueDate.getTime();
  if (Number.isNaN(dueTime)) return false;
  // A legacy alias cannot override the authoritative scheduled instant.
  if (occurrenceScheduledDate && dueTime !== occurrenceScheduledDate.getTime()) return false;

  const localKey = getOccurrenceKey(occ.dueDate, tz);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return key === localKey.slice(0, 10);
  }
  // Offset-free timestamp keys are local or UTC schedule representations,
  // never dates parsed in the host timezone. Both must agree with dueDate.
  if (key === localKey || key === getOccurrenceKey(occ.dueDate, 'UTC')) return true;
  if (/(Z|[+-]\d{2}:\d{2})$/.test(key)) {
    return new Date(key).getTime() === dueTime;
  }
  return false;
}

/**
 * SOL-R001-004: Helper to resolve callback occurrenceKey against locked loan's active nextEmiDate.
 * Matches local key, UTC key, local date, and exact instant across timezones.
 * Identifies overtaken (past) and future occurrences to prevent corrupting loan state.
 */
export function matchesLoanActiveEmi(
  occurrenceKey: string,
  loanNextEmiDate: Date,
  tz: string = 'UTC'
): { isMatch: boolean; isOvertaken: boolean; isFuture: boolean } {
  const loanInstant = loanNextEmiDate.getTime();
  const loanLocalKey = getOccurrenceKey(loanNextEmiDate, tz);
  const loanUtcKey = getOccurrenceKey(loanNextEmiDate, 'UTC');
  const loanLocalDate = loanLocalKey.substring(0, 10);

  const trimmed = occurrenceKey.trim();

  // 1. Date-only comparison YYYY-MM-DD: strictly match scheduled user-local calendar date
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (trimmed === loanLocalDate) {
      return { isMatch: true, isOvertaken: false, isFuture: false };
    }
    return {
      isMatch: false,
      isOvertaken: trimmed < loanLocalDate,
      isFuture: trimmed > loanLocalDate,
    };
  }

  // 2. Exact string matches against active loan EMI timestamp representations
  if (
    trimmed === loanLocalKey ||
    trimmed === loanUtcKey
  ) {
    return { isMatch: true, isOvertaken: false, isFuture: false };
  }

  // 3. Timestamp comparison
  if (trimmed.includes('T')) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const parsedTime = parsed.getTime();
      if (parsedTime === loanInstant) {
        return { isMatch: true, isOvertaken: false, isFuture: false };
      }
      return {
        isMatch: false,
        isOvertaken: parsedTime < loanInstant,
        isFuture: parsedTime > loanInstant,
      };
    }
  }

  return { isMatch: false, isOvertaken: false, isFuture: false };
}

/**
 * Marks an obligation occurrence as Paid with transactional idempotency.
 * Repeated calls with identical (obligationId, occurrenceKey) return the existing result
 * without creating a second expense or double-advancing recurrence.
 *
 * Strict Invariants:
 * - Validates occurrenceKey format.
 * - Only an occurrenceKey matching the current nextDueAt advances the obligation's schedule.
 */
export async function markObligationPaid(
  userId: string,
  params: {
    obligationId: string;
    occurrenceKey: string;
    createExpense?: boolean;
    accountId?: string;
  },
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const { obligationId, occurrenceKey, createExpense = false, accountId } = params;

  // 1. Format validation
  if (!occurrenceKey || !OCCURRENCE_KEY_REGEX.test(occurrenceKey)) {
    throw new Error('Invalid occurrence key format: must be YYYY-MM-DD or YYYY-MM-DDTHH:mm');
  }

  // 2. Load obligation & check ownership (including creditCardStatements)
  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    include: {
      account: true,
      loan: true,
      creditCardStatements: {
        include: {
          account: true,
          payments: true,
        }
      }
    }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  // 3. User timezone for canonical occurrence key & recurrence
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || 'UTC';

  // SOL-R001-007: Canonicalize occurrence key using user timezone
  const canonicalActiveKey = getOccurrenceKey(obligation.nextDueAt, tz);
  const utcKey = getOccurrenceKey(obligation.nextDueAt, 'UTC');
  const localDate = canonicalActiveKey.substring(0, 10);

  const isCurrentOccurrence = (() => {
    if (occurrenceKey === canonicalActiveKey || occurrenceKey === utcKey) return true;
    return occurrenceKey.trim() === localDate;
  })();

  // Scheduled date/instant for this occurrence (SOL-R001-007)
  const occurrenceScheduledDate = (() => {
    if (isCurrentOccurrence) {
      return obligation.nextDueAt;
    }
    const anchorInTz = new TZDate(obligation.dueAt, tz);
    const targetHour = anchorInTz.getHours();
    const targetMinute = anchorInTz.getMinutes();
    const targetSecond = anchorInTz.getSeconds();
    const targetMs = anchorInTz.getMilliseconds();
    const anchorUtcHour = obligation.dueAt.getUTCHours();
    const anchorUtcMinute = obligation.dueAt.getUTCMinutes();

    if (/^\d{4}-\d{2}-\d{2}$/.test(occurrenceKey.trim())) {
      const [y, m, d] = occurrenceKey.trim().split('-').map(Number);
      return new Date(new TZDate(y, m - 1, d, targetHour, targetMinute, targetSecond, targetMs, tz).getTime());
    }

    if (occurrenceKey.includes('T')) {
      const [datePart, timePart] = occurrenceKey.trim().split('T');
      const [y, m, d] = datePart.split('-').map(Number);
      const cleanTime = timePart.replace('Z', '');
      const timeParts = cleanTime.split(':').map(Number);
      const hh = timeParts[0];
      const mm = timeParts[1];

      if (tz === 'UTC') {
        return new Date(Date.UTC(y, m - 1, d, hh, mm, targetSecond, targetMs));
      }

      if (hh === targetHour && mm === targetMinute) {
        // Directly matches user timezone scheduled time
        return new Date(new TZDate(y, m - 1, d, targetHour, targetMinute, targetSecond, targetMs, tz).getTime());
      }

      // Next, evaluate whether this is an absolute UTC timestamp alias:
      const utcInstant = new Date(Date.UTC(y, m - 1, d, hh, mm, targetSecond, targetMs));
      const utcInTz = new TZDate(utcInstant, tz);
      if (utcInTz.getHours() === targetHour && utcInTz.getMinutes() === targetMinute) {
        // This absolute UTC instant projects to the user's scheduled local hour and minute!
        return utcInstant;
      }

      // Fallback: if neither matches, construct localCandidate
      const localCandidate = new Date(new TZDate(y, m - 1, d, hh, mm, targetSecond, targetMs, tz).getTime());
      return localCandidate;
    }

    return obligation.nextDueAt;
  })();

  // If caller provided a timestamp with time (e.g. from scheduler UTC payload), canonicalize to user timezone;
  // If caller provided a date-only key (e.g. YYYY-MM-DD), preserve the caller's date key format.
  let canonicalKey = occurrenceKey;
  if (occurrenceKey.includes('T')) {
    if (occurrenceKey === utcKey || isCurrentOccurrence) {
      canonicalKey = canonicalActiveKey;
    } else {
      canonicalKey = getOccurrenceKey(occurrenceScheduledDate, tz);
    }
  }

  // SOL-R001-007: Build candidate keys only for this resolved occurrence.
  // Historical occurrences must NOT include active occurrence keys.
  const scheduledUtcIso = occurrenceScheduledDate.toISOString().slice(0, 16);
  const scheduledUserTzKey = getOccurrenceKey(occurrenceScheduledDate, tz);
  const scheduledUserTzDate = scheduledUserTzKey.slice(0, 10);

  const candidateKeys = isCurrentOccurrence
    ? Array.from(new Set([
        occurrenceKey,
        canonicalKey,
        canonicalActiveKey,
        utcKey,
        localDate,
      ]))
    : Array.from(new Set([
        occurrenceKey,
        canonicalKey,
        scheduledUtcIso,
        scheduledUserTzKey,
        scheduledUserTzDate,
      ]));

  // 4. Early check if occurrence is already completed (fast idempotency check)
  let existingCompletion: any = null;

  if (typeof db.obligationOccurrence?.findMany === 'function') {
    const pastCompletions = await db.obligationOccurrence.findMany({
      where: {
        obligationId,
        status: { in: ['COMPLETED', 'COMPLETED_HISTORICAL'] },
      },
      include: { transaction: true },
      orderBy: { dueDate: 'desc' },
    });

    for (const occ of pastCompletions) {
      if (matchesOccurrence(occ, occurrenceKey, tz, occurrenceScheduledDate)) {
        existingCompletion = occ;
        break;
      }
    }
  }

  if (!existingCompletion) {
    if (typeof db.obligationOccurrence?.findFirst === 'function') {
      existingCompletion = await db.obligationOccurrence.findFirst({
        where: {
          obligationId,
          occurrenceKey: { in: candidateKeys },
          dueDate: occurrenceScheduledDate,
          status: { in: ['COMPLETED', 'COMPLETED_HISTORICAL'] },
        },
        include: { transaction: true }
      });
    } else if (typeof db.obligationOccurrence?.findUnique === 'function') {
      for (const key of candidateKeys) {
        existingCompletion = await db.obligationOccurrence.findUnique({
          where: {
            obligationId_occurrenceKey: {
              obligationId,
              occurrenceKey: key,
            }
          },
          include: { transaction: true }
        });
        if (existingCompletion && matchesOccurrence(existingCompletion, occurrenceKey, tz, occurrenceScheduledDate)) break;
        existingCompletion = null;
      }
    }
  }

  if (existingCompletion && !matchesOccurrence(existingCompletion, occurrenceKey, tz, occurrenceScheduledDate)) {
    existingCompletion = null;
  }

  if (existingCompletion) {
    return {
      success: true,
      alreadyCompleted: true,
      alreadyProcessed: true,
      occurrenceId: existingCompletion.id,
      transactionId: existingCompletion.transactionId,
      nextDueAt: obligation.nextDueAt.toISOString(),
    };
  }

  // SOL-R001-004: Linked loan obligation guard - verify occurrence against loan state before advancing schedule
  if (obligation.loan) {
    const isLoanClosed = obligation.loan.status === 'CLOSED' || !obligation.loan.nextEmiDate;
    if (isLoanClosed) {
      return {
        success: true,
        alreadyCompleted: true,
        alreadyProcessed: true,
        occurrenceId: null,
        transactionId: null,
        nextDueAt: obligation.nextDueAt ? obligation.nextDueAt.toISOString() : null,
      };
    }
    const earlyLoanMatch = matchesLoanActiveEmi(occurrenceKey, obligation.loan.nextEmiDate, tz);
    if (!earlyLoanMatch.isMatch) {
      return {
        success: true,
        alreadyCompleted: true,
        alreadyProcessed: true,
        occurrenceId: null,
        transactionId: null,
        nextDueAt: obligation.loan.nextEmiDate.toISOString(),
      };
    }
  }

  // SOL-R001-005: Credit card statement obligation delegation
  if (obligation.creditCardStatements && obligation.creditCardStatements.length > 0) {
    const ccStmt = obligation.creditCardStatements.find((s: any) => s.status !== 'PAID') || obligation.creditCardStatements[0];
    if (ccStmt.status === 'PAID') {
      return {
        success: true,
        alreadyCompleted: true,
        alreadyProcessed: true,
        occurrenceId: null,
        transactionId: null,
        nextDueAt: obligation.nextDueAt.toISOString(),
        statementStatus: 'PAID',
      };
    }

    let sourceAccountId = accountId;
    if (!sourceAccountId && obligation.accountId) {
      const cardAcc = await db.financialAccount.findUnique({
        where: { id: obligation.accountId },
        select: { defaultPaymentAccountId: true }
      });
      if (cardAcc?.defaultPaymentAccountId) {
        sourceAccountId = cardAcc.defaultPaymentAccountId;
      }
    }
    if (!sourceAccountId) {
      const bankAcc = await db.financialAccount.findFirst({
        where: {
          userId,
          type: { in: ['BANK', 'CASH', 'WALLET'] },
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      if (bankAcc) {
        sourceAccountId = bankAcc.id;
      }
    }

    if (!sourceAccountId) {
      throw new Error('Payment account required for credit card statement payment');
    }

    const payAmount = obligation.amount || ccStmt.statementAmount;
    const ccRes = await recordCreditCardPayment(userId, {
      statementId: ccStmt.id,
      fromAccountId: sourceAccountId,
      amount: payAmount,
      paidAt: new Date(),
      note: `Paid: ${obligation.title}`,
    }, db);

    // The card service owns the single canonical completion inside its payment transaction.

    return {
      success: true,
      alreadyCompleted: Boolean(ccRes.alreadyProcessed),
      alreadyProcessed: Boolean(ccRes.alreadyProcessed),
      occurrenceId: ccRes.occurrenceId,
      transactionId: ccRes.transactionId,
      nextDueAt: obligation.nextDueAt.toISOString(),
      statementStatus: ccRes.statementStatus,
    };
  }

  const targetDay = obligation.recurrenceType === 'MONTHLY'
    ? (obligation.loan?.dueDay ?? new TZDate(obligation.dueAt, tz).getDate())
    : undefined;

  const rule: RecurrenceRule = {
    type: obligation.recurrenceType as any,
    interval: obligation.recurrenceInterval,
    targetDayOfMonth: targetDay,
    timezone: tz,
  };

  const nextDue = isCurrentOccurrence
    ? getNextOccurrence(rule, obligation.dueAt, obligation.nextDueAt)
    : obligation.nextDueAt;

  // 5. Execute atomically with row locks (SOL-R001-007, SOL-R001-004)
  const executeInTransaction = async (tx: any) => {
    let createdTxId: string | null = null;
    let emiRes: any = null;

    // Acquire row locks inside transaction
    // SOL-R004-001: Acquire Loan lock first, then Obligation lock, to maintain consistent hierarchy
    if (typeof tx.$queryRaw === 'function') {
      const linkedLoanId = obligation.loan?.id || obligation.loanId;
      if (linkedLoanId) {
        await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${linkedLoanId} FOR UPDATE`;
      }
      await tx.$queryRaw`SELECT id FROM "Obligation" WHERE id = ${obligation.id} FOR UPDATE`;
    }

    const currentObligation = await tx.obligation.findUnique({
      where: { id: obligation.id },
      include: {
        loan: true,
        creditCardStatements: true,
      }
    });

    if (!currentObligation || currentObligation.userId !== userId) {
      throw new Error('Obligation not found or unauthorized');
    }

    // SOL-R001-007: Re-verify idempotency under obligation row lock
    if (typeof tx.obligationOccurrence?.findMany === 'function') {
      const lockedPastCompletions = await tx.obligationOccurrence.findMany({
        where: {
          obligationId: currentObligation.id,
          status: { in: ['COMPLETED', 'COMPLETED_HISTORICAL'] },
        },
        include: { transaction: true },
        orderBy: { dueDate: 'desc' },
      });

      const lockedMatch = lockedPastCompletions.find((occ: any) =>
        matchesOccurrence(occ, occurrenceKey, tz, occurrenceScheduledDate)
      );
      if (lockedMatch) {
        return {
          alreadyCompleted: true,
          alreadyProcessed: true,
          occurrenceId: lockedMatch.id,
          transactionId: lockedMatch.transactionId,
          nextDueAt: currentObligation.nextDueAt.toISOString(),
        };
      }
    }

    // Linked EMI Obligation delegation under loan row lock (SOL-R001-004)
    if (currentObligation.loan) {
      const currentLoan = await tx.loan.findUnique({
        where: { id: currentObligation.loan.id },
        select: {
          id: true,
          status: true,
          nextEmiDate: true,
          paymentAccountId: true,
          emiAmount: true,
          dueDay: true,
        }
      });

      if (!currentLoan || currentLoan.status === 'CLOSED' || !currentLoan.nextEmiDate) {
        return {
          alreadyCompleted: true,
          alreadyProcessed: true,
          occurrenceId: null,
          transactionId: null,
          nextDueAt: currentLoan?.nextEmiDate ? currentLoan.nextEmiDate.toISOString() : (currentObligation.nextDueAt?.toISOString() ?? null),
        };
      }

      // SOL-R001-004: Validate occurrence against currently locked loan's active nextEmiDate
      const loanMatch = matchesLoanActiveEmi(occurrenceKey, currentLoan.nextEmiDate, tz);
      if (!loanMatch.isMatch) {
        return {
          alreadyCompleted: true,
          alreadyProcessed: true,
          occurrenceId: null,
          transactionId: null,
          nextDueAt: currentLoan.nextEmiDate.toISOString(),
        };
      }

      // Derive persisted completion key and scheduled instant consistently from locked scheduled instant
      const loanScheduledInstant = currentLoan.nextEmiDate;
      const loanCompletionKey = getOccurrenceKey(loanScheduledInstant, tz);

      // Record occurrence completion with canonicalKey
      const occurrence = await tx.obligationOccurrence.create({
        data: {
          userId,
          obligationId: currentObligation.id,
          occurrenceKey: loanCompletionKey,
          dueDate: loanScheduledInstant,
          status: 'COMPLETED',
          paidAt: new Date(),
          transactionId: null,
        }
      });

      const targetAccountId = accountId || currentLoan.paymentAccountId || currentObligation.accountId;
      if (!targetAccountId) {
        throw new Error('Payment account required for linked loan EMI');
      }

      emiRes = await recordEmiPayment(userId, {
        loanId: currentObligation.loan.id,
        amount: currentObligation.amount || currentLoan.emiAmount || '0',
        accountId: targetAccountId,
        obligationOccurrenceId: occurrence.id,
        obligationPaymentId: loanCompletionKey,
        occurredAt: loanScheduledInstant,
        note: `EMI: ${currentObligation.title}`,
      }, tx);

      if (emiRes.alreadyProcessed) {
        return {
          alreadyCompleted: true,
          alreadyProcessed: true,
          occurrenceId: occurrence.id,
          transactionId: emiRes.transactionId || null,
          nextDueAt: emiRes.nextEmiDate ? (emiRes.nextEmiDate instanceof Date ? emiRes.nextEmiDate.toISOString() : new Date(emiRes.nextEmiDate).toISOString()) : (currentObligation.nextDueAt?.toISOString() ?? null),
        };
      }

      if (emiRes.transactionId) {
        createdTxId = emiRes.transactionId;
        await tx.obligationOccurrence.update({
          where: { id: occurrence.id },
          data: { transactionId: createdTxId }
        });
      }

      return {
        occurrence,
        createdTxId,
        emiRes,
      };
    }

    // SOL-R001-007: Check if occurrence is current under lock and resolve actual scheduled dueDate
    const lockActiveKey = getOccurrenceKey(currentObligation.nextDueAt, tz);
    const lockUtcKey = getOccurrenceKey(currentObligation.nextDueAt, 'UTC');
    const lockLocalDate = lockActiveKey.substring(0, 10);
    const isCurrentUnderLock = (() => {
      if (occurrenceKey === lockActiveKey || occurrenceKey === lockUtcKey) return true;
      return occurrenceKey.trim() === lockLocalDate;
    })();

    const resolvedDueDate = isCurrentUnderLock ? currentObligation.nextDueAt : occurrenceScheduledDate;

    // Record occurrence completion with canonicalKey for standard obligation
    const occurrence = await tx.obligationOccurrence.create({
      data: {
        userId,
        obligationId: currentObligation.id,
        occurrenceKey: canonicalKey,
        dueDate: resolvedDueDate,
        status: isCurrentUnderLock ? 'COMPLETED' : 'COMPLETED_HISTORICAL',
        paidAt: new Date(),
        transactionId: null,
      }
    });

    // SOL-R004-007: Expense creation validation for non-loan obligations
    const hasAmount = currentObligation.amount && Number(currentObligation.amount) > 0;
    if (createExpense && hasAmount) {
      const targetAccountId = accountId || currentObligation.accountId;
      if (!targetAccountId) {
        throw new Error('Payment account required to record expense');
      }
      const acc = await tx.financialAccount.findUnique({
        where: { id: targetAccountId },
        select: { userId: true, isActive: true }
      });
      if (!acc || acc.userId !== userId) {
        throw new Error('Payment account not found or unauthorized');
      }
      if (acc.isActive === false) {
        throw new Error('Cannot create expense with an inactive payment account');
      }

      const expenseTx = await tx.financialTransaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount: currentObligation.amount,
          category: currentObligation.kind === 'RECHARGE' ? 'Recharge' : 'Utilities',
          occurredAt: new Date(),
          accountId: targetAccountId,
          obligationId: currentObligation.id,
          note: `Paid: ${currentObligation.title}`,
        }
      });
      createdTxId = expenseTx.id;
      await tx.obligationOccurrence.update({
        where: { id: occurrence.id },
        data: { transactionId: createdTxId }
      });
    }

    const targetDay = currentObligation.recurrenceType === 'MONTHLY'
      ? (currentObligation.loan?.dueDay ?? new TZDate(currentObligation.dueAt, tz).getDate())
      : undefined;

    const rule: RecurrenceRule = {
      type: currentObligation.recurrenceType as any,
      interval: currentObligation.recurrenceInterval,
      targetDayOfMonth: targetDay,
      timezone: tz,
    };

    const nextDue = isCurrentUnderLock
      ? getNextOccurrence(rule, currentObligation.dueAt, currentObligation.nextDueAt)
      : currentObligation.nextDueAt;

    // Advance obligation nextDueAt ONLY if this occurrence matches the current active due date
    if (isCurrentUnderLock) {
      await tx.obligation.update({
        where: { id: currentObligation.id },
        data: {
          lastCompletedAt: new Date(),
          nextDueAt: nextDue || currentObligation.nextDueAt,
          isActive: nextDue !== null,
        }
      });
    } else {
      await tx.obligation.update({
        where: { id: currentObligation.id },
        data: {
          lastCompletedAt: new Date(),
        }
      });
    }

    // SOL-R001-007: Build acknowledgement aliases only for this resolved occurrence.
    // Prevent old callbacks from acknowledging or suppressing current day's reminder deliveries.
    const ackCandidateKeys = isCurrentUnderLock
      ? Array.from(new Set([
          occurrenceKey,
          canonicalKey,
          lockActiveKey,
          lockUtcKey,
          lockLocalDate,
        ]))
      : Array.from(new Set([
          occurrenceKey,
          canonicalKey,
          getOccurrenceKey(resolvedDueDate, tz),
          getOccurrenceKey(resolvedDueDate, 'UTC'),
          getOccurrenceKey(resolvedDueDate, tz).substring(0, 10),
        ]));

    // Acknowledge any pending deliveries for this occurrence
    await tx.reminderDelivery.updateMany({
      where: {
        obligationId: currentObligation.id,
        occurrenceKey: { in: ackCandidateKeys },
        status: { in: ['PENDING', 'SENT', 'SNOOZED', 'FAILED'] }
      },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        nextRetryAt: null,
      }
    });

    const finalNextDueAtStr = (isCurrentUnderLock && nextDue ? nextDue : currentObligation.nextDueAt).toISOString();

    return {
      occurrenceId: occurrence.id,
      transactionId: createdTxId,
      nextDueAt: finalNextDueAtStr,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  if (result.alreadyProcessed || result.alreadyCompleted) {
    return {
      success: true,
      alreadyCompleted: true,
      alreadyProcessed: true,
      occurrenceId: result.occurrenceId || null,
      transactionId: result.transactionId || null,
      nextDueAt: result.nextDueAt || obligation.nextDueAt.toISOString(),
    };
  }

  // For loan EMI payments that succeeded, handle delivery acknowledgement and schedule sync
  if (obligation.loan && result.occurrence) {
    await db.reminderDelivery.updateMany({
      where: {
        obligationId: obligation.id,
        occurrenceKey: { in: candidateKeys },
        status: { in: ['PENDING', 'SENT', 'SNOOZED', 'FAILED'] }
      },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        nextRetryAt: null,
      }
    });

    const nextDueStr = result.emiRes?.nextEmiDate
      ? (result.emiRes.nextEmiDate instanceof Date ? result.emiRes.nextEmiDate.toISOString() : new Date(result.emiRes.nextEmiDate).toISOString())
      : obligation.nextDueAt.toISOString();

    return {
      success: true,
      alreadyCompleted: false,
      alreadyProcessed: false,
      occurrenceId: result.occurrence.id,
      transactionId: result.createdTxId,
      nextDueAt: nextDueStr,
    };
  }

  return {
    success: true,
    alreadyCompleted: false,
    ...result,
  };
}

export interface RevertObligationPaymentInput {
  obligationId: string;
  occurrenceKey?: string;
  occurrenceId?: string;
}

/**
 * Reverts an obligation payment occurrence atomically (V2-651 / Architecture Gate C):
 * - Enforces latest-only completion revert rule (cannot revert earlier while later remains completed)
 * - If linked to Loan, delegates to LoanService.revertEmiPayment
 * - Deletes linked FinancialTransaction (if created)
 * - Deletes ObligationOccurrence record (making it payable again)
 * - Restores Obligation.nextDueAt to the occurrence's dueDate
 * - Restores Obligation.lastCompletedAt to the previous completion or null
 * - Reactivates obligation (isActive = true)
 * - Cancels future unsent ReminderDelivery claims while preserving historical SENT/ACKNOWLEDGED logs
 * - Idempotent on repeated calls
 */
export async function revertObligationPayment(
  userId: string,
  params: RevertObligationPaymentInput,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const { obligationId, occurrenceKey, occurrenceId } = params;

  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    include: {
      loan: true,
      creditCardStatements: true,
      occurrences: {
        orderBy: { dueDate: 'desc' },
      }
    }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || 'UTC';

  // Find target occurrence
  let targetOccurrence: any = null;
  if (occurrenceId) {
    targetOccurrence = obligation.occurrences.find((o: any) => o.id === occurrenceId);
  } else if (occurrenceKey) {
    targetOccurrence = obligation.occurrences.find((o: any) =>
      matchesOccurrence(o, occurrenceKey, tz)
    );
  } else {
    // Latest completed occurrence
    targetOccurrence = obligation.occurrences.find((o: any) => o.status === 'COMPLETED' || o.status === 'COMPLETED_HISTORICAL') || obligation.occurrences[0] || null;
  }

  // SOL-R002-001: Statement-linked obligation reversal
  if (obligation.creditCardStatements && obligation.creditCardStatements.length > 0) {
    const ccStmt = obligation.creditCardStatements.find((s: any) =>
      targetOccurrence && s.dueDate.getTime() === targetOccurrence.dueDate.getTime()
    ) || obligation.creditCardStatements[0];

    // If no target occurrence is found, it was already reversed on a previous Undo call
    if (!targetOccurrence) {
      return {
        success: true,
        alreadyReversed: true,
        message: 'Credit card payment not found or already reversed',
        revertedOccurrenceId: null,
        restoredNextDueAt: obligation.dueAt ? obligation.dueAt.toISOString() : null,
        creditCardReversed: true,
      };
    }

    // Identify specific payment linked to this occurrence
    let targetPayment: any = null;
    if (targetOccurrence.transactionId) {
      targetPayment = await db.creditCardPayment.findFirst({
        where: { transactionId: targetOccurrence.transactionId, userId },
      });
    }

    if (!targetPayment) {
      targetPayment = await db.creditCardPayment.findFirst({
        where: { statementId: ccStmt.id, userId, paidAt: targetOccurrence.paidAt },
      });
    }

    // If still no payment found, the payment was already reversed
    if (!targetPayment) {
      await db.obligationOccurrence.deleteMany({
        where: { obligationId: obligation.id, dueDate: ccStmt.dueDate },
      });
      return {
        success: true,
        alreadyReversed: true,
        message: 'Credit card payment not found or already reversed',
        revertedOccurrenceId: targetOccurrence.id,
        restoredNextDueAt: obligation.dueAt ? obligation.dueAt.toISOString() : null,
        creditCardReversed: true,
      };
    }

    // Call revertCreditCardPayment with SPECIFIC paymentId
    const ccRes = await revertCreditCardPayment(userId, { paymentId: targetPayment.id, statementId: ccStmt.id }, db);

    // The card reversal transaction removes all aliases for this statement dueDate.

    return {
      success: true,
      alreadyReversed: Boolean(ccRes.alreadyReversed),
      revertedOccurrenceId: targetOccurrence.id,
      restoredNextDueAt: obligation.dueAt ? obligation.dueAt.toISOString() : null,
      creditCardReversed: true,
      statementStatus: ccRes.restoredStatus || ccRes.statementStatus || null,
      restoredStatus: ccRes.restoredStatus || null,
      pendingBalance: ccRes.pendingBalance || null,
      creditCardDetails: ccRes,
    };
  }

  if (!targetOccurrence) {
    return {
      success: true,
      alreadyReversed: true,
      message: 'Obligation occurrence not found or already reversed',
    };
  }

  // Enforce latest-only revert rule (preliminary check)
  const targetDueDate = new Date(targetOccurrence.dueDate).getTime();
  const laterOccurrence = obligation.occurrences.find(
    (o: any) => new Date(o.dueDate).getTime() > targetDueDate && (o.status === 'COMPLETED' || o.status === 'COMPLETED_HISTORICAL')
  );
  if (laterOccurrence) {
    throw new Error(
      'Cannot revert an earlier occurrence while a later occurrence remains completed. Please revert occurrences in reverse chronological order.'
    );
  }

  // SOL-R001-010: If linked to Loan, delegate in a single interactive transaction
  if (obligation.loan) {
    const executeLoanReversal = async (tx: any) => {
      // SOL-R004-001 & SOL-R004-002: Row locks in consistent order: Loan -> Obligation
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${obligation.loan.id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Obligation" WHERE id = ${obligation.id} FOR UPDATE`;
      }

      // SOL-R004-002: Reread all occurrences for obligation under lock
      const lockedOccurrences = typeof tx.obligationOccurrence?.findMany === 'function'
        ? await tx.obligationOccurrence.findMany({
            where: { obligationId: obligation.id },
            orderBy: { dueDate: 'desc' }
          })
        : obligation.occurrences;

      const lockedTarget = lockedOccurrences.find((o: any) => o.id === targetOccurrence.id);
      if (!lockedTarget) {
        return { alreadyReversed: true };
      }

      // Enforce latest-only revert rule under lock
      const lockedTargetDueDate = new Date(lockedTarget.dueDate).getTime();
      const lockedLaterOccurrence = lockedOccurrences.find(
        (o: any) => (o.status === 'COMPLETED' || o.status === 'COMPLETED_HISTORICAL') && new Date(o.dueDate).getTime() > lockedTargetDueDate
      );
      if (lockedLaterOccurrence) {
        throw new Error(
          'Cannot revert an earlier occurrence while a later occurrence remains completed. Please revert occurrences in reverse chronological order.'
        );
      }

      const loanRes = await revertEmiPayment(
        userId,
        {
          obligationOccurrenceId: lockedTarget.id,
          loanId: obligation.loan.id,
          revertToDate: lockedTarget.dueDate,
        },
        tx
      );

      if (loanRes.alreadyReversed) {
        return {
          alreadyReversed: true,
          revertedOccurrenceId: lockedTarget.id,
          restoredNextDueAt: obligation.nextDueAt ? obligation.nextDueAt.toISOString() : null,
          loanRes,
        };
      }

      // Delete occurrence record
      await tx.obligationOccurrence.deleteMany({
        where: { id: lockedTarget.id }
      });

      // Find previous completed occurrence
      const prevOccurrences = lockedOccurrences.filter(
        (o: any) => o.id !== lockedTarget.id && (o.status === 'COMPLETED' || o.status === 'COMPLETED_HISTORICAL')
      );
      const lastCompletedAt = prevOccurrences.length > 0 ? prevOccurrences[0].paidAt : null;

      // Restore obligation schedule
      await tx.obligation.update({
        where: { id: obligation.id },
        data: {
          nextDueAt: lockedTarget.dueDate,
          lastCompletedAt,
          isActive: true,
        }
      });

      // Cancel future unsent delivery claims
      await tx.reminderDelivery.deleteMany({
        where: {
          obligationId: obligation.id,
          status: 'PENDING',
          scheduledFor: { gte: lockedTarget.dueDate },
        }
      });

      return {
        alreadyReversed: false,
        revertedOccurrenceId: lockedTarget.id,
        restoredNextDueAt: lockedTarget.dueDate,
        loanRes,
      };
    };

    const loanRes = typeof db.$transaction === 'function'
      ? await db.$transaction(executeLoanReversal)
      : await executeLoanReversal(db);

    if (loanRes.alreadyReversed) {
      return {
        success: true,
        alreadyReversed: true,
        revertedOccurrenceId: targetOccurrence.id,
        restoredNextDueAt: obligation.nextDueAt ? obligation.nextDueAt.toISOString() : null,
        message: 'Obligation occurrence not found or already reversed',
      };
    }

    return {
      success: true,
      alreadyReversed: false,
      revertedOccurrenceId: targetOccurrence.id,
      restoredNextDueAt: new Date(targetOccurrence.dueDate).toISOString(),
      loanReversed: true,
      loanDetails: loanRes.loanRes,
    };
  }

  // Standard obligation reversal
  const executeInTransaction = async (tx: any) => {
    // SOL-R004-002: Acquire row lock on Obligation inside transaction
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Obligation" WHERE id = ${obligation.id} FOR UPDATE`;
    }

    // SOL-R004-002: Reread all occurrences for obligation under lock
    const lockedOccurrences = typeof tx.obligationOccurrence?.findMany === 'function'
      ? await tx.obligationOccurrence.findMany({
          where: { obligationId: obligation.id },
          orderBy: { dueDate: 'desc' }
        })
      : obligation.occurrences;

    const lockedTarget = lockedOccurrences.find((o: any) => o.id === targetOccurrence.id);
    if (!lockedTarget) {
      return { alreadyReversed: true };
    }

    // Enforce latest-only revert rule under lock
    const lockedTargetDueDate = new Date(lockedTarget.dueDate).getTime();
    const lockedLaterOccurrence = lockedOccurrences.find(
      (o: any) => (o.status === 'COMPLETED' || o.status === 'COMPLETED_HISTORICAL') && new Date(o.dueDate).getTime() > lockedTargetDueDate
    );
    if (lockedLaterOccurrence) {
      throw new Error(
        'Cannot revert an earlier occurrence while a later occurrence remains completed. Please revert occurrences in reverse chronological order.'
      );
    }

    // 1. Delete linked FinancialTransaction if created
    if (lockedTarget.transactionId) {
      await tx.financialTransaction.delete({
        where: { id: lockedTarget.transactionId }
      });
    }

    // 2. Delete the occurrence record
    await tx.obligationOccurrence.delete({
      where: { id: lockedTarget.id }
    });

    // 3. Find previous completion (if any)
    const prevOccurrences = lockedOccurrences.filter(
      (o: any) => o.id !== lockedTarget.id && (o.status === 'COMPLETED' || o.status === 'COMPLETED_HISTORICAL')
    );
    const lastCompletedAt = prevOccurrences.length > 0 ? prevOccurrences[0].paidAt : null;

    // SOL-R004-010: Check whether the occurrence being undone was historical
    const currentOb = await tx.obligation.findUnique({
      where: { id: obligation.id },
      select: {
        dueAt: true,
        nextDueAt: true,
        isActive: true,
        recurrenceType: true,
        recurrenceInterval: true,
        loan: { select: { dueDay: true } }
      }
    });

    const currentDueAt = currentOb?.dueAt || obligation.dueAt;
    const currentNextDue = currentOb?.nextDueAt || obligation.nextDueAt;
    const currentIsActive = currentOb ? currentOb.isActive : obligation.isActive;
    const recType = currentOb?.recurrenceType || obligation.recurrenceType;

    const targetDay = recType === 'MONTHLY'
      ? (currentOb?.loan?.dueDay ?? (currentDueAt ? new TZDate(currentDueAt, tz).getDate() : undefined))
      : undefined;

    const rule: RecurrenceRule = {
      type: recType as any,
      interval: currentOb?.recurrenceInterval ?? obligation.recurrenceInterval,
      targetDayOfMonth: targetDay,
      timezone: tz,
    };

    const lockedTargetDueTime = new Date(lockedTarget.dueDate).getTime();
    const anchorTime = new Date(currentDueAt).getTime();
    const currentNextDueTime = new Date(currentNextDue).getTime();

    let isHistorical = lockedTarget.status === 'COMPLETED_HISTORICAL';
    if (!isHistorical) {
      // Legacy compatibility fallback
      if (lockedTargetDueTime < anchorTime) {
        isHistorical = true;
      } else if (recType === 'ONCE') {
        isHistorical = lockedTargetDueTime !== currentNextDueTime;
      } else {
        const expectedNext = getNextOccurrence(rule, currentDueAt, lockedTarget.dueDate);
        if (!expectedNext || expectedNext.getTime() !== currentNextDueTime) {
          isHistorical = true;
        }
      }
    }

    const restoredDueAt = isHistorical ? currentNextDue : lockedTarget.dueDate;
    const restoredIsActive = isHistorical
      ? currentIsActive
      : (recType === 'ONCE' ? true : currentIsActive);

    // 4. Restore nextDueAt and active state
    await tx.obligation.update({
      where: { id: obligation.id },
      data: {
        nextDueAt: restoredDueAt,
        lastCompletedAt,
        isActive: restoredIsActive,
      }
    });

    // 5. Cancel future unsent reminder deliveries (status == 'PENDING')
    if (isHistorical) {
      await tx.reminderDelivery.deleteMany({
        where: {
          obligationId: obligation.id,
          status: 'PENDING',
          occurrenceKey: lockedTarget.occurrenceKey,
        }
      });
    } else {
      await tx.reminderDelivery.deleteMany({
        where: {
          obligationId: obligation.id,
          status: 'PENDING',
          scheduledFor: { gte: lockedTarget.dueDate },
        }
      });
    }

    return {
      alreadyReversed: false,
      revertedOccurrenceId: lockedTarget.id,
      restoredNextDueAt: restoredDueAt,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  if (result.alreadyReversed) {
    return {
      success: true,
      alreadyReversed: true,
      revertedOccurrenceId: targetOccurrence.id,
      restoredNextDueAt: obligation.nextDueAt ? obligation.nextDueAt.toISOString() : null,
      message: 'Obligation occurrence not found or already reversed',
    };
  }

  return {
    success: true,
    alreadyReversed: false,
    revertedOccurrenceId: result.revertedOccurrenceId,
    restoredNextDueAt: new Date(result.restoredNextDueAt).toISOString(),
  };
}
