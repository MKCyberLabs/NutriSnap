'use server';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  isValidAccountType,
  isValidTransactionType,
  isValidObligationKind,
  parseAndValidateAmount,
  validateTransferInvariants,
  calculateAccountBalance,
  calculateMonthlyTotals,
  calculateCategoryBreakdown,
  AccountType,
  TransactionType,
  ObligationKind,
  Decimal
} from '@/lib/finance/finance';
import { getNextOccurrence, RecurrenceRule } from '@/lib/recurrence/recurrence';

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.string().refine(isValidAccountType, 'Invalid account type'),
  institution: z.string().max(100).optional().nullable(),
  openingBalance: z.union([z.number(), z.string()]).default('0'),
  creditLimit: z.union([z.number(), z.string()]).optional().nullable(),
});

const recordTransactionSchema = z.object({
  type: z.string().refine(isValidTransactionType, 'Invalid transaction type'),
  amount: z.union([z.number(), z.string()]),
  category: z.string().min(1, 'Category is required').max(50),
  occurredAt: z.string().or(z.date()),
  accountId: z.string().min(1, 'Account is required'),
  transferAccountId: z.string().optional().nullable(),
  obligationId: z.string().optional().nullable(),
  note: z.string().max(255).optional().nullable(),
});

const createObligationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  kind: z.string().refine(isValidObligationKind, 'Invalid obligation kind'),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  accountId: z.string().optional().nullable(),
  dueAt: z.string().or(z.date()),
  recurrenceType: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'EVERY_N_DAYS']),
  recurrenceInterval: z.number().int().min(1).optional().nullable(),
  reminderOffsetsMin: z.array(z.number().int().min(0)).default([0]),
  notes: z.string().max(255).optional().nullable(),
});

async function verifyAuth(userId?: string) {
  return await requireUser(userId);
}

/**
 * Lists all active accounts for the authenticated user, including derived balance.
 */
export async function getAccounts(userId: string) {
  const authUser = await verifyAuth(userId);

  const accounts = await prisma.financialAccount.findMany({
    where: { userId: authUser.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      transactions: true,
      transfersTo: true,
    }
  });

  return accounts.map((acc: any) => {
    // Collect all transactions affecting this account
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
      createdAt: acc.createdAt.toISOString(),
      updatedAt: acc.updatedAt.toISOString(),
    };
  });
}

/**
 * Creates a new financial account.
 */
export async function createAccount(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const parsed = createAccountSchema.parse(data);

  const openingBalanceDecimal = parsed.openingBalance
    ? new Decimal(parsed.openingBalance)
    : new Decimal(0);

  const creditLimitDecimal = parsed.creditLimit
    ? new Decimal(parsed.creditLimit)
    : null;

  const account = await prisma.financialAccount.create({
    data: {
      userId: authUser.id,
      name: parsed.name,
      type: parsed.type,
      institution: parsed.institution,
      openingBalance: openingBalanceDecimal,
      creditLimit: creditLimitDecimal,
      isActive: true,
    }
  });

  revalidatePath('/finance');
  revalidatePath('/today');
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
 * Archives an account (soft delete) preserving all historical transactions.
 */
export async function archiveAccount(userId: string, accountId: string) {
  const authUser = await verifyAuth(userId);

  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId },
    select: { userId: true }
  });

  if (!account || account.userId !== authUser.id) {
    throw new Error('Account not found or unauthorized');
  }

  await prisma.financialAccount.update({
    where: { id: accountId },
    data: { isActive: false }
  });

  revalidatePath('/finance');
  revalidatePath('/today');
  return { success: true };
}

/**
 * Lists transactions for user with date filtering and server-side aggregation.
 */
export async function getTransactions(userId: string, options: {
  limit?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  accountId?: string;
} = {}) {
  const authUser = await verifyAuth(userId);

  const where: any = { userId: authUser.id };

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

  const transactions = await prisma.financialTransaction.findMany({
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
 * Records a new financial transaction (INCOME, EXPENSE, or TRANSFER) with invariant validation.
 */
export async function recordTransaction(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const parsed = recordTransactionSchema.parse(data);

  // Validate amount > 0
  const amountDecimal = parseAndValidateAmount(parsed.amount);

  // Validate primary account ownership
  const sourceAccount = await prisma.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!sourceAccount || sourceAccount.userId !== authUser.id) {
    throw new Error('Primary account not found or unauthorized');
  }

  // Handle transfer invariants
  let transferAccountId: string | null = null;
  if (parsed.type === 'TRANSFER') {
    if (!parsed.transferAccountId) {
      throw new Error('Transfer requires a destination account');
    }

    const destAccount = await prisma.financialAccount.findUnique({
      where: { id: parsed.transferAccountId },
      select: { userId: true, isActive: true }
    });

    if (!destAccount || destAccount.userId !== authUser.id) {
      throw new Error('Destination transfer account not found or unauthorized');
    }

    validateTransferInvariants({
      sourceAccountId: parsed.accountId,
      destinationAccountId: parsed.transferAccountId,
      sourceAccountUserId: sourceAccount.userId,
      destinationAccountUserId: destAccount.userId,
      currentUserId: authUser.id,
      amount: amountDecimal,
    });

    transferAccountId = parsed.transferAccountId;
  }

  // Validate obligation if linked
  if (parsed.obligationId) {
    const ob = await prisma.obligation.findUnique({
      where: { id: parsed.obligationId },
      select: { userId: true }
    });
    if (!ob || ob.userId !== authUser.id) {
      throw new Error('Linked obligation not found or unauthorized');
    }
  }

  const occurredAtDate = new Date(parsed.occurredAt);

  const tx = await prisma.financialTransaction.create({
    data: {
      userId: authUser.id,
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

  revalidatePath('/finance');
  revalidatePath('/today');
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
export async function deleteTransaction(userId: string, transactionId: string) {
  const authUser = await verifyAuth(userId);

  const tx = await prisma.financialTransaction.findUnique({
    where: { id: transactionId },
    select: { userId: true }
  });

  if (!tx || tx.userId !== authUser.id) {
    throw new Error('Transaction not found or unauthorized');
  }

  await prisma.financialTransaction.delete({
    where: { id: transactionId }
  });

  revalidatePath('/finance');
  revalidatePath('/today');
  return { success: true };
}

/**
 * Returns month-scoped financial summary (income, expense, category breakdown).
 */
export async function getMonthlyFinanceSummary(userId: string, targetDate: Date | string = new Date()) {
  const authUser = await verifyAuth(userId);
  const date = new Date(targetDate);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthlyTransactions = await prisma.financialTransaction.findMany({
    where: {
      userId: authUser.id,
      occurredAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      }
    }
  });

  const totals = calculateMonthlyTotals(monthlyTransactions);
  const categoryBreakdown = calculateCategoryBreakdown(monthlyTransactions);

  const accounts = await getAccounts(authUser.id);
  const totalBalance = accounts.reduce(
    (acc, a) => acc.plus(new Decimal(a.currentBalance)),
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

/**
 * Lists user obligations ordered by nextDueAt.
 */
export async function getObligations(userId: string) {
  const authUser = await verifyAuth(userId);

  const obligations = await prisma.obligation.findMany({
    where: { userId: authUser.id, isArchived: false },
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
export async function createObligation(userId: string, data: unknown) {
  const authUser = await verifyAuth(userId);
  const parsed = createObligationSchema.parse(data);

  if (parsed.accountId) {
    const acc = await prisma.financialAccount.findUnique({
      where: { id: parsed.accountId },
      select: { userId: true }
    });
    if (!acc || acc.userId !== authUser.id) {
      throw new Error('Default account not found or unauthorized');
    }
  }

  const dueAtDate = new Date(parsed.dueAt);
  const amountDecimal = parsed.amount ? parseAndValidateAmount(parsed.amount) : null;

  // Compute nextDueAt: if dueAt is in the future, nextDueAt is dueAt; otherwise calculate next occurrence
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
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

  const obligation = await prisma.obligation.create({
    data: {
      userId: authUser.id,
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

  revalidatePath('/finance');
  revalidatePath('/today');
  revalidatePath('/reminders');
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
  const { obligationId, occurrenceKey, createExpense = false, accountId } = params;

  // 1. Load obligation & check ownership
  const obligation = await prisma.obligation.findUnique({
    where: { id: obligationId },
    include: { account: true }
  });

  if (!obligation || obligation.userId !== authUser.id) {
    throw new Error('Obligation not found or unauthorized');
  }

  // 2. Check if occurrence is already completed (idempotency check)
  const existingCompletion = await prisma.obligationOccurrence.findUnique({
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

  // 3. User timezone for recurrence
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { timezone: true }
  });
  const tz = user?.timezone || 'UTC';

  const rule: RecurrenceRule = {
    type: obligation.recurrenceType as any,
    interval: obligation.recurrenceInterval,
    timezone: tz,
  };

  const nextDue = getNextOccurrence(rule, obligation.dueAt, obligation.nextDueAt);

  // 4. Atomic transaction
  const result = await prisma.$transaction(async (tx: any) => {
    let createdTxId: string | null = null;

    // Optional expense creation
    if (createExpense && obligation.amount) {
      const targetAccountId = accountId || obligation.accountId;
      if (targetAccountId) {
        const acc = await tx.financialAccount.findUnique({
          where: { id: targetAccountId },
          select: { userId: true }
        });
        if (acc && acc.userId === authUser.id) {
          const expenseTx = await tx.financialTransaction.create({
            data: {
              userId: authUser.id,
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
        userId: authUser.id,
        obligationId: obligation.id,
        occurrenceKey,
        dueDate: obligation.nextDueAt,
        status: 'COMPLETED',
        paidAt: new Date(),
        transactionId: createdTxId,
      }
    });

    // Advance obligation nextDueAt
    await tx.obligation.update({
      where: { id: obligation.id },
      data: {
        lastCompletedAt: new Date(),
        nextDueAt: nextDue || obligation.nextDueAt,
        isActive: nextDue !== null, // If ONCE and completed, set isActive to false
      }
    });

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
      nextDueAt: (nextDue || obligation.nextDueAt).toISOString(),
    };
  });

  revalidatePath('/finance');
  revalidatePath('/today');
  revalidatePath('/reminders');

  return {
    success: true,
    alreadyCompleted: false,
    ...result,
  };
}
