import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import {
  parseAndValidateAmount,
  calculateDebtOutstanding,
} from './finance';

const defaultPrisma = prisma;
type PrismaClientLike = any;

export const updateDebtSchema = z.object({
  counterpartyName: z.string().trim().min(1, 'Person name is required').max(100).optional(),
  title: z.string().trim().max(100).optional().nullable(),
  dueAt: z.string().or(z.date()).optional().nullable(),
  reminderOffsetsMin: z.array(z.number().int().min(0)).optional(),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const createDebtSchema = z.object({
  direction: z.enum(['RECEIVABLE', 'PAYABLE']),
  counterpartyName: z.string().trim().min(1, 'Person name is required').max(100),
  title: z.string().trim().max(100).optional().nullable(),
  originalAmount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  startedAt: z.string().or(z.date()).optional(),
  dueAt: z.string().or(z.date()).optional().nullable(),
  reminderOffsetsMin: z.array(z.number().int().min(0)).default([0]),
  notes: z.string().trim().max(255).optional().nullable(),
  accountId: z.string().optional().nullable(),
});

export const recordDebtPaymentSchema = z.object({
  debtId: z.string().min(1, 'Debt ID is required'),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  accountId: z.string().min(1, 'Account ID is required'),
  occurredAt: z.string().or(z.date()).optional(),
  note: z.string().trim().max(255).optional().nullable(),
  idempotencyKey: z.string().trim().max(100).optional().nullable(),
});

export const additionalDebtMovementSchema = z.object({
  debtId: z.string().min(1, 'Debt ID is required'),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  accountId: z.string().min(1, 'Account ID is required'),
  occurredAt: z.string().or(z.date()).optional(),
  note: z.string().trim().max(255).optional().nullable(),
});

/**
 * Creates a new personal debt (RECEIVABLE or PAYABLE).
 * If accountId is provided, atomically records the initial LEND or BORROW transaction.
 */
export async function createDebt(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = createDebtSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.originalAmount.toString());

  if (parsed.accountId) {
    const acc = await db.financialAccount.findUnique({
      where: { id: parsed.accountId },
      select: { userId: true, isActive: true }
    });
    if (!acc || acc.userId !== userId) {
      throw new Error('Account not found or unauthorized');
    }
  }

  const startedAtDate = parsed.startedAt ? new Date(parsed.startedAt) : new Date();
  const dueAtDate = parsed.dueAt ? new Date(parsed.dueAt) : null;

  const executeInTransaction = async (tx: any) => {
    const debt = await tx.personalDebt.create({
      data: {
        userId,
        direction: parsed.direction,
        counterpartyName: parsed.counterpartyName,
        title: parsed.title || null,
        originalAmount: amountDecimal,
        startedAt: startedAtDate,
        dueAt: dueAtDate,
        reminderOffsetsMin: parsed.reminderOffsetsMin,
        status: 'OPEN',
        notes: parsed.notes || null,
      }
    });

    let initialTxId: string | null = null;
    if (parsed.accountId) {
      const txType = parsed.direction === 'RECEIVABLE' ? 'LEND' : 'BORROW';
      const defaultNote = parsed.direction === 'RECEIVABLE'
        ? `Lent to ${parsed.counterpartyName}`
        : `Borrowed from ${parsed.counterpartyName}`;

      const createdTx = await tx.financialTransaction.create({
        data: {
          userId,
          type: txType,
          amount: amountDecimal,
          category: 'Personal Debt',
          accountId: parsed.accountId,
          personalDebtId: debt.id,
          occurredAt: startedAtDate,
          note: parsed.notes || defaultNote,
        }
      });
      initialTxId = createdTx.id;
    }

    return {
      debt,
      initialTransactionId: initialTxId,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    debt: {
      id: result.debt.id,
      direction: result.debt.direction,
      counterpartyName: result.debt.counterpartyName,
      title: result.debt.title,
      originalAmount: result.debt.originalAmount.toString(),
      outstandingAmount: result.debt.originalAmount.toString(),
      startedAt: result.debt.startedAt.toISOString(),
      dueAt: result.debt.dueAt ? result.debt.dueAt.toISOString() : null,
      status: result.debt.status,
      initialTransactionId: result.initialTransactionId,
    }
  };
}

/**
 * Lists debts for a user with calculated outstanding balances.
 */
export async function getDebts(
  userId: string,
  options: { status?: string; direction?: string } = {},
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const where: any = { userId };
  if (options.status) {
    where.status = options.status;
  } else {
    where.status = { not: 'ARCHIVED' };
  }

  if (options.direction) {
    where.direction = options.direction;
  }

  const debts = await db.personalDebt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      transactions: {
        select: {
          id: true,
          type: true,
          amount: true,
          occurredAt: true,
          note: true,
          accountId: true,
          account: { select: { id: true, name: true } },
        },
        orderBy: { occurredAt: 'desc' },
      }
    }
  });

  const now = new Date();

  return debts.map((d: any) => {
    const outstanding = calculateDebtOutstanding(d.direction, d.originalAmount, d.transactions);
    const isOverdue = d.dueAt && new Date(d.dueAt).getTime() < now.getTime() && d.status === 'OPEN';

    return {
      id: d.id,
      direction: d.direction,
      counterpartyName: d.counterpartyName,
      title: d.title,
      originalAmount: d.originalAmount.toString(),
      outstandingAmount: outstanding.toString(),
      startedAt: d.startedAt.toISOString(),
      dueAt: d.dueAt ? d.dueAt.toISOString() : null,
      reminderOffsetsMin: d.reminderOffsetsMin,
      status: d.status,
      notes: d.notes,
      isOverdue,
      createdAt: d.createdAt.toISOString(),
      transactionCount: d.transactions.length,
      transactions: d.transactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toString(),
        occurredAt: t.occurredAt.toISOString(),
        note: t.note,
        account: t.account,
      }))
    };
  });
}

/**
 * Retrieves a single debt by ID with transactions and outstanding calculation.
 */
export async function getDebtById(
  userId: string,
  debtId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const debt = await db.personalDebt.findUnique({
    where: { id: debtId },
    include: {
      transactions: {
        include: { account: { select: { id: true, name: true } } },
        orderBy: { occurredAt: 'desc' },
      }
    }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  const outstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, debt.transactions);
  const isOverdue = debt.dueAt && new Date(debt.dueAt).getTime() < Date.now() && debt.status === 'OPEN';

  return {
    id: debt.id,
    direction: debt.direction,
    counterpartyName: debt.counterpartyName,
    title: debt.title,
    originalAmount: debt.originalAmount.toString(),
    outstandingAmount: outstanding.toString(),
    startedAt: debt.startedAt.toISOString(),
    dueAt: debt.dueAt ? debt.dueAt.toISOString() : null,
    reminderOffsetsMin: debt.reminderOffsetsMin,
    status: debt.status,
    notes: debt.notes,
    isOverdue,
    createdAt: debt.createdAt.toISOString(),
    transactions: debt.transactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toString(),
      occurredAt: t.occurredAt.toISOString(),
      note: t.note,
      account: t.account,
    }))
  };
}

/**
 * Records collection on a RECEIVABLE (person pays back user).
 * Increases account balance, decreases debt outstanding.
 * Outstanding must never become negative (V2-T026).
 * Reaching 0 sets status = 'SETTLED' (V2-T027).
 * Supports idempotencyKey (V2-T030).
 */
export async function recordDebtCollection(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = recordDebtPaymentSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  const debt = await db.personalDebt.findUnique({
    where: { id: parsed.debtId },
    include: { transactions: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  if (debt.direction !== 'RECEIVABLE') {
    throw new Error('Collection can only be recorded on a RECEIVABLE debt');
  }

  if (debt.status === 'ARCHIVED') {
    throw new Error('Cannot record collection on an archived debt');
  }

  // Account ownership check (V2-T029)
  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  // Idempotency check (V2-T030)
  if (parsed.idempotencyKey) {
    const keyTag = `[idempotency:${parsed.idempotencyKey}]`;
    const existing = debt.transactions.find((t: any) => t.note && t.note.includes(keyTag));
    if (existing) {
      const currentOutstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, debt.transactions);
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: existing.id,
        remainingOutstanding: currentOutstanding.toString(),
        settled: debt.status === 'SETTLED',
      };
    }
  }

  const currentOutstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, debt.transactions);

  // V2-T026: outstanding never negative
  if (amountDecimal.greaterThan(currentOutstanding)) {
    throw new Error(`Cannot collect more than outstanding balance of ₹${currentOutstanding.toString()}`);
  }

  const newOutstanding = currentOutstanding.minus(amountDecimal);
  const isSettled = newOutstanding.isZero();

  const occurredAtDate = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const noteTag = parsed.idempotencyKey ? ` [idempotency:${parsed.idempotencyKey}]` : '';
  const txNote = parsed.note
    ? `${parsed.note}${noteTag}`
    : `Collected from ${debt.counterpartyName}${noteTag}`;

  const executeInTransaction = async (tx: any) => {
    const createdTx = await tx.financialTransaction.create({
      data: {
        userId,
        type: 'DEBT_COLLECT',
        amount: amountDecimal,
        category: 'Personal Debt',
        accountId: parsed.accountId,
        personalDebtId: debt.id,
        occurredAt: occurredAtDate,
        note: txNote,
      }
    });

    if (isSettled) {
      await tx.personalDebt.update({
        where: { id: debt.id },
        data: { status: 'SETTLED' }
      });
    }

    return createdTx;
  };

  const createdTx = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyProcessed: false,
    transactionId: createdTx.id,
    remainingOutstanding: newOutstanding.toString(),
    settled: isSettled,
  };
}

/**
 * Records repayment on a PAYABLE (user pays back friend).
 * Decreases account balance, decreases debt outstanding.
 * Outstanding must never become negative (V2-T026).
 * Reaching 0 sets status = 'SETTLED' (V2-T027).
 * Supports idempotencyKey (V2-T030).
 */
export async function recordDebtRepayment(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = recordDebtPaymentSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  const debt = await db.personalDebt.findUnique({
    where: { id: parsed.debtId },
    include: { transactions: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  if (debt.direction !== 'PAYABLE') {
    throw new Error('Repayment can only be recorded on a PAYABLE debt');
  }

  if (debt.status === 'ARCHIVED') {
    throw new Error('Cannot record repayment on an archived debt');
  }

  // Account ownership check (V2-T029)
  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  // Idempotency check (V2-T030)
  if (parsed.idempotencyKey) {
    const keyTag = `[idempotency:${parsed.idempotencyKey}]`;
    const existing = debt.transactions.find((t: any) => t.note && t.note.includes(keyTag));
    if (existing) {
      const currentOutstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, debt.transactions);
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: existing.id,
        remainingOutstanding: currentOutstanding.toString(),
        settled: debt.status === 'SETTLED',
      };
    }
  }

  const currentOutstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, debt.transactions);

  // V2-T026: outstanding never negative
  if (amountDecimal.greaterThan(currentOutstanding)) {
    throw new Error(`Cannot repay more than outstanding balance of ₹${currentOutstanding.toString()}`);
  }

  const newOutstanding = currentOutstanding.minus(amountDecimal);
  const isSettled = newOutstanding.isZero();

  const occurredAtDate = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const noteTag = parsed.idempotencyKey ? ` [idempotency:${parsed.idempotencyKey}]` : '';
  const txNote = parsed.note
    ? `${parsed.note}${noteTag}`
    : `Repaid to ${debt.counterpartyName}${noteTag}`;

  const executeInTransaction = async (tx: any) => {
    const createdTx = await tx.financialTransaction.create({
      data: {
        userId,
        type: 'DEBT_REPAY',
        amount: amountDecimal,
        category: 'Personal Debt',
        accountId: parsed.accountId,
        personalDebtId: debt.id,
        occurredAt: occurredAtDate,
        note: txNote,
      }
    });

    if (isSettled) {
      await tx.personalDebt.update({
        where: { id: debt.id },
        data: { status: 'SETTLED' }
      });
    }

    return createdTx;
  };

  const createdTx = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyProcessed: false,
    transactionId: createdTx.id,
    remainingOutstanding: newOutstanding.toString(),
    settled: isSettled,
  };
}

/**
 * Records additional lending on a RECEIVABLE (V2-T024).
 * Increases debt outstanding, decreases account balance.
 * Reopens debt to 'OPEN' if it was settled.
 */
export async function recordAdditionalLend(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = additionalDebtMovementSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  const debt = await db.personalDebt.findUnique({
    where: { id: parsed.debtId },
    include: { transactions: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  if (debt.direction !== 'RECEIVABLE') {
    throw new Error('Additional lend can only be recorded on a RECEIVABLE debt');
  }

  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  const occurredAtDate = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const txNote = parsed.note || `Additional lend to ${debt.counterpartyName}`;

  const executeInTransaction = async (tx: any) => {
    const createdTx = await tx.financialTransaction.create({
      data: {
        userId,
        type: 'LEND',
        amount: amountDecimal,
        category: 'Personal Debt',
        accountId: parsed.accountId,
        personalDebtId: debt.id,
        occurredAt: occurredAtDate,
        note: txNote,
      }
    });

    if (debt.status !== 'OPEN') {
      await tx.personalDebt.update({
        where: { id: debt.id },
        data: { status: 'OPEN' }
      });
    }

    return createdTx;
  };

  const createdTx = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  const currentOutstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, [
    ...debt.transactions,
    createdTx
  ]);

  return {
    success: true,
    transactionId: createdTx.id,
    newOutstanding: currentOutstanding.toString(),
  };
}

/**
 * Records additional borrowing on a PAYABLE (V2-T025).
 * Increases debt outstanding, increases account balance.
 * Reopens debt to 'OPEN' if it was settled.
 */
export async function recordAdditionalBorrow(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = additionalDebtMovementSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  const debt = await db.personalDebt.findUnique({
    where: { id: parsed.debtId },
    include: { transactions: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  if (debt.direction !== 'PAYABLE') {
    throw new Error('Additional borrow can only be recorded on a PAYABLE debt');
  }

  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  const occurredAtDate = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const txNote = parsed.note || `Additional borrow from ${debt.counterpartyName}`;

  const executeInTransaction = async (tx: any) => {
    const createdTx = await tx.financialTransaction.create({
      data: {
        userId,
        type: 'BORROW',
        amount: amountDecimal,
        category: 'Personal Debt',
        accountId: parsed.accountId,
        personalDebtId: debt.id,
        occurredAt: occurredAtDate,
        note: txNote,
      }
    });

    if (debt.status !== 'OPEN') {
      await tx.personalDebt.update({
        where: { id: debt.id },
        data: { status: 'OPEN' }
      });
    }

    return createdTx;
  };

  const createdTx = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  const currentOutstanding = calculateDebtOutstanding(debt.direction, debt.originalAmount, [
    ...debt.transactions,
    createdTx
  ]);

  return {
    success: true,
    transactionId: createdTx.id,
    newOutstanding: currentOutstanding.toString(),
  };
}

/**
 * Marks a debt as settled.
 */
export async function settleDebt(
  userId: string,
  debtId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const debt = await db.personalDebt.findUnique({
    where: { id: debtId },
    select: { userId: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  await db.personalDebt.update({
    where: { id: debtId },
    data: { status: 'SETTLED' }
  });

  return { success: true };
}

/**
 * Archives a debt (soft delete).
 */
export async function archiveDebt(
  userId: string,
  debtId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const debt = await db.personalDebt.findUnique({
    where: { id: debtId },
    select: { userId: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  await db.personalDebt.update({
    where: { id: debtId },
    data: { status: 'ARCHIVED' }
  });

  return { success: true };
}

/**
 * Updates personal debt metadata (safe mutable fields).
 * Invariant: Historical transactions are never rewritten; originalAmount cannot be altered directly.
 * Verifies authenticated user ownership; rejects foreign debt IDs.
 */
export async function updateDebt(
  userId: string,
  debtId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  if (typeof data === 'object' && data !== null) {
    if ('originalAmount' in data && (data as any).originalAmount !== undefined) {
      throw new Error('originalAmount cannot be updated directly; use additional lend/borrow transactions instead');
    }
    if ('direction' in data && (data as any).direction !== undefined) {
      throw new Error('direction cannot be updated directly');
    }
  }

  const parsed = updateDebtSchema.parse(data);

  const debt = await db.personalDebt.findUnique({
    where: { id: debtId },
    select: { id: true, userId: true, status: true }
  });

  if (!debt || debt.userId !== userId) {
    throw new Error('Debt not found or unauthorized');
  }

  if (debt.status === 'ARCHIVED') {
    throw new Error('Cannot update an archived debt');
  }

  const updateData: any = {};
  if (parsed.counterpartyName !== undefined) updateData.counterpartyName = parsed.counterpartyName;
  if (parsed.title !== undefined) updateData.title = parsed.title;
  if (parsed.dueAt !== undefined) {
    updateData.dueAt = parsed.dueAt ? new Date(parsed.dueAt) : null;
  }
  if (parsed.reminderOffsetsMin !== undefined) updateData.reminderOffsetsMin = parsed.reminderOffsetsMin;
  if (parsed.notes !== undefined) updateData.notes = parsed.notes;

  const updated = await db.personalDebt.update({
    where: { id: debtId },
    data: updateData,
  });

  return {
    success: true,
    debt: {
      id: updated.id,
      counterpartyName: updated.counterpartyName,
      title: updated.title,
      direction: updated.direction,
      originalAmount: updated.originalAmount.toString(),
      dueAt: updated.dueAt ? updated.dueAt.toISOString() : null,
      reminderOffsetsMin: updated.reminderOffsetsMin,
      status: updated.status,
      notes: updated.notes,
    }
  };
}
