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
  calculateMonthlyTotals,
  calculateCategoryBreakdown,
  Decimal
} from '@/lib/finance/finance';
import { getNextOccurrence, getOccurrenceKey, RecurrenceRule } from '@/lib/recurrence/recurrence';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.string().refine(isValidAccountType, 'Invalid account type'),
  institution: z.string().max(100).optional().nullable(),
  openingBalance: z.union([z.number(), z.string(), z.instanceof(Decimal)]).default('0'),
  creditLimit: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
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

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      institution: acc.institution,
      openingBalance: acc.openingBalance.toString(),
      currentBalance: currentBalance.toString(),
      creditLimit: acc.creditLimit ? acc.creditLimit.toString() : null,
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
    }
  });

  return transactions.map((t: any) => ({
    id: t.id,
    type: t.type,
    amount: t.amount.toString(),
    category: t.category,
    occurredAt: t.occurredAt.toISOString(),
    account: t.account,
    transferAccount: t.transferAccount,
    obligation: t.obligation,
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
 * Deletes a transaction with authorization verification.
 */
export async function deleteTransaction(userId: string, transactionId: string, db: PrismaClientLike = defaultPrisma) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const tx = await db.financialTransaction.findUnique({
    where: { id: transactionId },
    select: { userId: true }
  });

  if (!tx || tx.userId !== userId) {
    throw new Error('Transaction not found or unauthorized');
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
  const date = new Date(targetDate);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthlyTransactions = await db.financialTransaction.findMany({
    where: {
      userId,
      occurredAt: {
        gte: startOfMonth,
        lte: endOfMonth,
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
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    income: totals.income.toString(),
    expense: totals.expense.toString(),
    totalBalance: totalBalance.toString(),
    categoryBreakdown: formattedBreakdown,
    accountCount: accounts.length,
    transactionCount: monthlyTransactions.length,
  };
}

export interface ObligationItem {
  id: string;
  title: string;
  kind: string;
  amount: string | null;
  account: { id: string; name: string } | null;
  dueAt: string;
  recurrenceType: string;
  recurrenceInterval: number | null;
  reminderOffsetsMin: number[];
  isActive: boolean;
  notes: string | null;
  lastCompletedAt: string | null;
  nextDueAt: string;
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
    where: { userId, isArchived: false },
    orderBy: { nextDueAt: 'asc' },
    include: {
      account: { select: { id: true, name: true } },
      occurrences: {
        orderBy: { dueDate: 'desc' },
        take: 5,
      }
    }
  });

  return obligations.map((ob: any) => ({
    id: ob.id,
    title: ob.title,
    kind: ob.kind,
    amount: ob.amount ? ob.amount.toString() : null,
    account: ob.account,
    dueAt: ob.dueAt.toISOString(),
    recurrenceType: ob.recurrenceType,
    recurrenceInterval: ob.recurrenceInterval,
    reminderOffsetsMin: ob.reminderOffsetsMin,
    isActive: ob.isActive,
    notes: ob.notes,
    lastCompletedAt: ob.lastCompletedAt ? ob.lastCompletedAt.toISOString() : null,
    nextDueAt: ob.nextDueAt.toISOString(),
  }));
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

  const dueAtDate = new Date(parsed.dueAt);
  const amountDecimal = parsed.amount ? parseAndValidateAmount(parsed.amount.toString()) : null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || 'UTC';

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

  // 2. Load obligation & check ownership
  const obligation = await db.obligation.findUnique({
    where: { id: obligationId },
    include: { account: true }
  });

  if (!obligation || obligation.userId !== userId) {
    throw new Error('Obligation not found or unauthorized');
  }

  // 3. Check if occurrence is already completed (idempotency check)
  const existingCompletion = await db.obligationOccurrence.findUnique({
    where: {
      obligationId_occurrenceKey: {
        obligationId,
        occurrenceKey,
      }
    },
    include: { transaction: true }
  });

  if (existingCompletion) {
    return {
      success: true,
      alreadyCompleted: true,
      occurrenceId: existingCompletion.id,
      transactionId: existingCompletion.transactionId,
      nextDueAt: obligation.nextDueAt.toISOString(),
    };
  }

  // 4. User timezone for recurrence
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || 'UTC';

  const expectedKey = getOccurrenceKey(obligation.nextDueAt, tz);
  const isCurrentOccurrence = occurrenceKey === expectedKey || occurrenceKey === expectedKey.substring(0, 10);

  const rule: RecurrenceRule = {
    type: obligation.recurrenceType as any,
    interval: obligation.recurrenceInterval,
    timezone: tz,
  };

  const nextDue = isCurrentOccurrence
    ? getNextOccurrence(rule, obligation.dueAt, obligation.nextDueAt)
    : obligation.nextDueAt;

  // 5. Execute atomically
  const executeInTransaction = async (tx: any) => {
    let createdTxId: string | null = null;

    // Optional expense creation
    if (createExpense && obligation.amount) {
      const targetAccountId = accountId || obligation.accountId;
      if (targetAccountId) {
        const acc = await tx.financialAccount.findUnique({
          where: { id: targetAccountId },
          select: { userId: true }
        });
        if (acc && acc.userId === userId) {
          const expenseTx = await tx.financialTransaction.create({
            data: {
              userId,
              type: 'EXPENSE',
              amount: obligation.amount,
              category: obligation.kind === 'RECHARGE' ? 'Recharge' : 'Utilities',
              occurredAt: new Date(),
              accountId: targetAccountId,
              obligationId: obligation.id,
              note: `Paid: ${obligation.title}`,
            }
          });
          createdTxId = expenseTx.id;
        }
      }
    }

    // Record occurrence completion
    const occurrence = await tx.obligationOccurrence.create({
      data: {
        userId,
        obligationId: obligation.id,
        occurrenceKey,
        dueDate: obligation.nextDueAt,
        status: 'COMPLETED',
        paidAt: new Date(),
        transactionId: createdTxId,
      }
    });

    // Advance obligation nextDueAt ONLY if this occurrence matches the current active due date
    if (isCurrentOccurrence) {
      await tx.obligation.update({
        where: { id: obligation.id },
        data: {
          lastCompletedAt: new Date(),
          nextDueAt: nextDue || obligation.nextDueAt,
          isActive: nextDue !== null,
        }
      });
    } else {
      await tx.obligation.update({
        where: { id: obligation.id },
        data: {
          lastCompletedAt: new Date(),
        }
      });
    }

    // Acknowledge any pending deliveries for this occurrence
    await tx.reminderDelivery.updateMany({
      where: {
        obligationId: obligation.id,
        occurrenceKey,
        status: { in: ['PENDING', 'SENT', 'SNOOZED'] }
      },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      }
    });

    return {
      occurrenceId: occurrence.id,
      transactionId: createdTxId,
      nextDueAt: (isCurrentOccurrence && nextDue ? nextDue : obligation.nextDueAt).toISOString(),
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyCompleted: false,
    ...result,
  };
}
