import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { parseAndValidateAmount, calculateCreditCardUsage } from './finance';
import { getOccurrenceKey, getNextOccurrence, RecurrenceRule } from '../recurrence/recurrence';

const defaultPrisma = prisma;
type PrismaClientLike = any;

/**
 * Month-end clamping helper (Architecture Gate C):
 * For statementDay (1..31) and paymentDueDay (1..31), clamps targetDay
 * to the exact last day of that specific calendar month (e.g. Feb 28/29, Apr 30).
 * Never overflows or spills into subsequent months.
 */
export function clampDayToMonth(year: number, monthIndexZeroBased: number, targetDay: number): number {
  // Day 0 of next month is the last day of the current month in UTC
  const maxDays = new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).getUTCDate();
  return Math.min(Math.max(1, targetDay), maxDays);
}

/**
 * Calculates deterministic clamped statement date and due date given reference year/month.
 */
export function calculateStatementDates(
  statementDay: number,
  paymentDueDay: number,
  year: number,
  monthIndexZeroBased: number
): { statementDate: Date; dueDate: Date; periodKey: string } {
  const clampedStatementDay = clampDayToMonth(year, monthIndexZeroBased, statementDay);
  const statementDate = new Date(Date.UTC(year, monthIndexZeroBased, clampedStatementDay, 12, 0, 0));

  // Determine due date month:
  // If paymentDueDay <= statementDay, due date falls in the next calendar month.
  // Otherwise, due date falls in the same calendar month.
  let dueYear = year;
  let dueMonth = monthIndexZeroBased;
  if (paymentDueDay <= statementDay) {
    dueMonth = monthIndexZeroBased + 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  const clampedDueDay = clampDayToMonth(dueYear, dueMonth, paymentDueDay);
  const dueDate = new Date(Date.UTC(dueYear, dueMonth, clampedDueDay, 12, 0, 0));

  const monthStr = String(monthIndexZeroBased + 1).padStart(2, '0');
  const periodKey = `${year}-${monthStr}`;

  return { statementDate, dueDate, periodKey };
}

export const createCreditCardStatementSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  periodKey: z.string().regex(/^\d{4}-\d{2}$/, 'periodKey must be in format YYYY-MM'),
  statementDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  statementAmount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  minimumDue: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const recordCreditCardPaymentSchema = z.object({
  statementId: z.string().min(1, 'Statement ID is required'),
  fromAccountId: z.string().min(1, 'Payment source account ID is required'),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  paidAt: z.string().or(z.date()).optional(),
  note: z.string().trim().max(255).optional().nullable(),
  idempotencyKey: z.string().trim().max(100).optional().nullable(),
});

/**
 * Creates a monthly credit card statement and links/syncs the card obligation reminder.
 * Enforces durable 1:1 statement/obligation identity across all statement cycles.
 * Historical obligations from previous or paid cycles must NEVER be reused.
 * Serializes statement creation per account to prevent concurrent duplicate cycle creation.
 */
export async function createCreditCardStatement(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = createCreditCardStatementSchema.parse(data);

  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { id: true, userId: true, name: true, type: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Credit card account not found or unauthorized');
  }

  if (account.type !== 'CREDIT_CARD') {
    throw new Error('Account is not a credit card');
  }

  const statementAmount = parseAndValidateAmount(parsed.statementAmount.toString());
  const minimumDue = parsed.minimumDue
    ? parseAndValidateAmount(parsed.minimumDue.toString())
    : null;

  const statementDate = new Date(parsed.statementDate);
  const dueDate = new Date(parsed.dueDate);

  const executeInTransaction = async (tx: any) => {
    // 1. Serialize statement creation per credit card account using row-level lock
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "FinancialAccount" WHERE id = ${account.id} FOR UPDATE`;
    }

    // 2. Check if statement already exists for this card and periodKey (idempotent deduplication)
    const existing = await tx.creditCardStatement.findUnique({
      where: {
        accountId_periodKey: {
          accountId: parsed.accountId,
          periodKey: parsed.periodKey,
        }
      }
    });

    if (existing) {
      return {
        statement: existing,
        alreadyExists: true,
      };
    }

    // 3. Create a dedicated 1:1 obligation for this statement cycle.
    // Crucial: Historical obligations from previous/paid cycles must NEVER be reused.
    const obligation = await tx.obligation.create({
      data: {
        userId,
        title: `${account.name} Bill (${parsed.periodKey})`,
        kind: 'CREDIT_CARD',
        accountId: account.id,
        amount: statementAmount,
        dueAt: dueDate,
        nextDueAt: dueDate,
        recurrenceType: 'ONCE',
        recurrenceInterval: 1,
        reminderOffsetsMin: [0, 1440, 4320], // 0d, 1d, 3d
        isActive: true,
      }
    });

    const statement = await tx.creditCardStatement.create({
      data: {
        userId,
        accountId: account.id,
        periodKey: parsed.periodKey,
        statementDate,
        dueDate,
        statementAmount,
        minimumDue,
        status: 'OPEN',
        obligationId: obligation.id,
        notes: parsed.notes || null,
      }
    });

    return {
      statement,
      alreadyExists: false,
    };
  };

  let result: any;
  try {
    result = typeof db.$transaction === 'function'
      ? await db.$transaction(executeInTransaction)
      : await executeInTransaction(db);
  } catch (err: any) {
    if (err?.code === 'P2002' || err?.message?.includes('Unique constraint failed')) {
      const existing = await db.creditCardStatement.findUnique({
        where: {
          accountId_periodKey: {
            accountId: parsed.accountId,
            periodKey: parsed.periodKey,
          }
        }
      });
      if (existing) {
        result = {
          statement: existing,
          alreadyExists: true,
        };
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const s = result.statement;
  return {
    success: true,
    alreadyExists: Boolean(result.alreadyExists),
    statement: {
      id: s.id,
      accountId: s.accountId,
      periodKey: s.periodKey,
      statementDate: (s.statementDate instanceof Date ? s.statementDate : new Date(s.statementDate)).toISOString(),
      dueDate: (s.dueDate instanceof Date ? s.dueDate : new Date(s.dueDate)).toISOString(),
      statementAmount: s.statementAmount.toString(),
      minimumDue: s.minimumDue ? s.minimumDue.toString() : null,
      status: s.status,
    }
  };
}

/**
 * Records a payment against a Credit Card statement (V2-653):
 * - Creates a TRANSFER transaction from fromAccountId to creditCard account
 * - Reduces statement pending balance: statementAmount - sum(payments)
 * - If pending > 0: status = PARTIAL, syncs remaining amount into Obligation.amount
 * - If pending == 0: status = PAID, marks obligation occurrence COMPLETED (transactionId = null), advances nextDueAt
 * - Strictly does NOT create Income or Expense
 */
export async function recordCreditCardPayment(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = recordCreditCardPaymentSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  // Verify fromAccountId ownership and type (SOL-R004-008)
  const fromAccount = await db.financialAccount.findUnique({
    where: { id: parsed.fromAccountId },
    select: { id: true, userId: true, name: true, isActive: true, type: true }
  });

  if (!fromAccount || fromAccount.userId !== userId) {
    throw new Error('Source payment account not found or unauthorized');
  }

  if (fromAccount.type === 'CREDIT_CARD') {
    throw new Error('Payment source cannot be a credit card (Source account cannot be the credit card being paid)');
  }

  if (!['BANK', 'CASH', 'WALLET'].includes(fromAccount.type)) {
    throw new Error('Payment source must be a BANK, CASH, or WALLET account');
  }

  const paidAtDate = parsed.paidAt ? new Date(parsed.paidAt) : new Date();
  const noteTag = parsed.idempotencyKey ? ` [idempotency:${parsed.idempotencyKey}]` : '';

  const executeInTransaction = async (tx: any) => {
    // 1. SOL-R001-002: Acquire row lock on CreditCardStatement inside transaction
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "CreditCardStatement" WHERE id = ${parsed.statementId} FOR UPDATE`;
    }

    // 2. Re-read statement under row lock
    const statement = await tx.creditCardStatement.findUnique({
      where: { id: parsed.statementId },
      include: {
        account: true,
        obligation: true,
        payments: true,
      }
    });

    if (!statement || statement.userId !== userId) {
      throw new Error('Credit card statement not found or unauthorized');
    }

    if (fromAccount.id === statement.accountId) {
      throw new Error('Source account cannot be the credit card being paid');
    }

    // 3. Re-check idempotency key inside transaction under lock
    if (parsed.idempotencyKey) {
      const keyTag = `[idempotency:${parsed.idempotencyKey}]`;
      const existingPayment = statement.payments.find(
        (p: any) => p.note && p.note.includes(keyTag)
      );
      if (existingPayment) {
        let sumPaid = new Decimal(0);
        for (const p of statement.payments) {
          sumPaid = sumPaid.plus(p.amount);
        }
        const pending = statement.statementAmount.minus(sumPaid);
        return {
          alreadyProcessed: true,
          payment: existingPayment,
          transferTx: { id: existingPayment.transactionId },
          newStatus: statement.status,
          pendingAfter: pending.lt(0) ? new Decimal(0) : pending,
          isFullyPaid: statement.status === 'PAID',
        };
      }
    }

    // 4. Re-read payments and verify remaining statement balance under lock
    let sumPaidBefore = new Decimal(0);
    for (const p of statement.payments) {
      sumPaidBefore = sumPaidBefore.plus(p.amount);
    }
    const pendingBefore = statement.statementAmount.minus(sumPaidBefore);

    // If already paid, or if concurrent request already completed payment, return existing result without duplicate transfers or overpaying
    if (statement.status === 'PAID' || pendingBefore.lte(0)) {
      const latestPayment = statement.payments.length > 0 ? statement.payments[statement.payments.length - 1] : null;
      return {
        alreadyProcessed: true,
        payment: latestPayment,
        transferTx: latestPayment?.transactionId ? { id: latestPayment.transactionId } : null,
        newStatus: statement.status,
        pendingAfter: new Decimal(0),
        isFullyPaid: true,
      };
    }

    if (amountDecimal.greaterThan(pendingBefore)) {
      throw new Error(
        `Payment amount (${amountDecimal}) cannot exceed pending balance (${pendingBefore})`
      );
    }

    const paymentNote = parsed.note
      ? `${parsed.note}${noteTag}`
      : `CC Payment: ${statement.account.name} (${statement.periodKey})${noteTag}`;

    // 5. Create TRANSFER transaction from bank account to credit card
    const transferTx = await tx.financialTransaction.create({
      data: {
        userId,
        type: 'TRANSFER',
        amount: amountDecimal,
        category: 'Credit Card Payment',
        accountId: fromAccount.id,
        transferAccountId: statement.accountId,
        occurredAt: paidAtDate,
        note: paymentNote,
      }
    });

    // 6. Create CreditCardPayment record
    const payment = await tx.creditCardPayment.create({
      data: {
        userId,
        statementId: statement.id,
        fromAccountId: fromAccount.id,
        amount: amountDecimal,
        paidAt: paidAtDate,
        transactionId: transferTx.id,
        note: paymentNote,
      }
    });

    // 7. Recalculate status
    const sumPaidAfter = sumPaidBefore.plus(amountDecimal);
    const pendingAfter = statement.statementAmount.minus(sumPaidAfter);
    const isFullyPaid = pendingAfter.isZero();
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';

    await tx.creditCardStatement.update({
      where: { id: statement.id },
      data: { status: newStatus }
    });

    // 8. Update linked Obligation
    if (statement.obligation) {
      const ob = statement.obligation;
      if (isFullyPaid) {
        // Record occurrence completion with transactionId = null (Finding 3)
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { timezone: true }
        });
        const tz = user?.timezone || 'UTC';
        const occurrenceKey = getOccurrenceKey(statement.dueDate, tz);

        await tx.obligationOccurrence.upsert({
          where: {
            obligationId_occurrenceKey: {
              obligationId: ob.id,
              occurrenceKey,
            }
          },
          update: {
            status: 'COMPLETED',
            paidAt: paidAtDate,
            transactionId: null,
          },
          create: {
            userId,
            obligationId: ob.id,
            occurrenceKey,
            dueDate: statement.dueDate,
            status: 'COMPLETED',
            paidAt: paidAtDate,
            transactionId: null,
          }
        });

        // Atomically deactivate the obligation for this statement cycle
        await tx.obligation.update({
          where: { id: ob.id },
          data: {
            amount: null,
            nextDueAt: statement.dueDate,
            isActive: false,
            isArchived: true,
            lastCompletedAt: paidAtDate,
          }
        });

        // Acknowledge or cancel all pending reminder deliveries for this obligation
        await tx.reminderDelivery.updateMany({
          where: {
            obligationId: ob.id,
            status: { in: ['PENDING', 'SENT', 'SNOOZED', 'FAILED'] }
          },
          data: {
            status: 'ACKNOWLEDGED',
            acknowledgedAt: paidAtDate,
            nextRetryAt: null,
          }
        });
      } else {
        // Partial payment: sync remaining pending amount to obligation
        await tx.obligation.update({
          where: { id: ob.id },
          data: {
            amount: pendingAfter,
          }
        });
      }
    }

    return {
      payment,
      transferTx,
      newStatus,
      pendingAfter,
      isFullyPaid,
      alreadyProcessed: false,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyProcessed: Boolean(result.alreadyProcessed),
    paymentId: result.payment?.id || null,
    transactionId: result.transferTx?.id || null,
    statementStatus: result.newStatus,
    pendingBalance: result.pendingAfter.toString(),
    fullyPaid: result.isFullyPaid,
  };
}

export interface RevertCreditCardPaymentInput {
  paymentId?: string;
  statementId?: string;
}

/**
 * Reverts a credit card payment atomically (Architecture Gate C / Section 11):
 * - Deletes the CreditCardPayment record
 * - Deletes the linked TRANSFER transaction (restoring bank and CC balance)
 * - Recalculates remaining statement balance
 * - Restores statement status to PARTIAL or OPEN
 * - Restores Obligation.amount and re-opens occurrence if it was marked PAID
 * - Idempotent on repeated calls
 */
export async function revertCreditCardPayment(
  userId: string,
  input: RevertCreditCardPaymentInput,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  let statementId = input.statementId;

  if (input.paymentId) {
    const prePayment = await db.creditCardPayment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, userId: true, statementId: true }
    });
    if (!prePayment) {
      return {
        success: true,
        alreadyReversed: true,
        message: 'Credit card payment not found or already reversed',
        revertedPaymentId: input.paymentId,
        statementStatus: null,
        restoredStatus: null,
        pendingBalance: null,
      };
    }
    if (prePayment.userId !== userId) {
      throw new Error('Unauthorized: payment belongs to another user');
    }
    // SOL-R003-003: If statementId was provided, verify membership before locking
    if (statementId && prePayment.statementId !== statementId) {
      throw new Error('Payment does not belong to the specified statement');
    }
    // Authoritatively derive statementId from the payment
    statementId = prePayment.statementId;
  }

  if (!statementId) {
    return {
      success: true,
      alreadyReversed: true,
      message: 'Credit card payment not found or already reversed',
      revertedPaymentId: input.paymentId || null,
      statementStatus: null,
      restoredStatus: null,
      pendingBalance: null,
    };
  }

  const executeInTransaction = async (tx: any) => {
    // 1. SOL-R001-002: Acquire statement row lock inside interactive transaction
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "CreditCardStatement" WHERE id = ${statementId} FOR UPDATE`;
    }

    // 2. Reread statement under lock
    const statement = await tx.creditCardStatement.findUnique({
      where: { id: statementId },
      include: {
        account: true,
        obligation: true,
        payments: {
          orderBy: { paidAt: 'desc' },
          include: { transaction: true }
        }
      }
    });

    if (!statement || statement.userId !== userId) {
      throw new Error('Credit card statement not found or unauthorized');
    }

    // 3. Reread target payment under lock
    let payment: any = null;
    if (input.paymentId) {
      payment = await tx.creditCardPayment.findUnique({
        where: { id: input.paymentId },
        include: { transaction: true }
      });
    } else {
      payment = statement.payments[0] || null;
    }

    if (!payment) {
      return {
        alreadyReversed: true,
        revertedPaymentId: input.paymentId || null,
        restoredStatus: statement.status,
        restoredPending: statement.statementAmount,
      };
    }

    if (payment.userId !== userId) {
      throw new Error('Unauthorized: payment belongs to another user');
    }

    // SOL-R003-003: Validate statement membership strictly under lock
    if (payment.statementId !== statement.id) {
      throw new Error('Payment does not belong to the locked statement');
    }

    // 4. Delete linked TRANSFER transaction
    if (payment.transactionId) {
      await tx.financialTransaction.delete({
        where: { id: payment.transactionId }
      });
    }

    // 5. Delete the payment
    await tx.creditCardPayment.delete({
      where: { id: payment.id }
    });

    // 6. Recalculate remaining payments under lock
    const remainingPayments = await tx.creditCardPayment.findMany({
      where: { statementId: statement.id }
    });

    let sumPaid = new Decimal(0);
    for (const p of remainingPayments) {
      sumPaid = sumPaid.plus(p.amount);
    }
    const restoredPending = statement.statementAmount.minus(sumPaid);
    const restoredStatus = sumPaid.isZero() ? 'OPEN' : 'PARTIAL';

    await tx.creditCardStatement.update({
      where: { id: statement.id },
      data: { status: restoredStatus }
    });

    // 7. Restore Obligation state if it was marked PAID
    if (statement.obligation) {
      let ob = statement.obligation;

      // Defense-in-depth isolation check:
      // If this obligation was ever shared with another statement cycle in historical data,
      // disentangle this statement by giving it a dedicated obligation rather than
      // overwriting the newer cycle's amount, due date, or reminder state.
      const otherStatementsSharing = await tx.creditCardStatement.findMany({
        where: {
          obligationId: ob.id,
          id: { not: statement.id },
        }
      });

      if (otherStatementsSharing.length > 0) {
        const newOb = await tx.obligation.create({
          data: {
            userId,
            title: `${statement.account?.name || 'Credit Card'} Bill (${statement.periodKey})`,
            kind: 'CREDIT_CARD',
            accountId: statement.accountId,
            amount: restoredPending,
            dueAt: statement.dueDate,
            nextDueAt: statement.dueDate,
            recurrenceType: 'ONCE',
            recurrenceInterval: 1,
            reminderOffsetsMin: [0, 1440, 4320],
            isActive: true,
            isArchived: false,
          }
        });

        await tx.creditCardStatement.update({
          where: { id: statement.id },
          data: { obligationId: newOb.id }
        });
        ob = newOb;
      } else {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { timezone: true }
        });
        const tz = user?.timezone || 'UTC';
        const occurrenceKey = getOccurrenceKey(statement.dueDate, tz);

        // If occurrence was completed, delete or remove completion
        await tx.obligationOccurrence.deleteMany({
          where: {
            obligationId: ob.id,
            occurrenceKey,
          }
        });

        // Restore nextDueAt and amount and reactivate obligation
        await tx.obligation.update({
          where: { id: ob.id },
          data: {
            amount: restoredPending,
            nextDueAt: statement.dueDate,
            isActive: true,
            isArchived: false,
          }
        });

        // Restore any acknowledged reminder deliveries that are scheduled in the future
        await tx.reminderDelivery.updateMany({
          where: {
            obligationId: ob.id,
            status: 'ACKNOWLEDGED',
            scheduledFor: { gt: new Date() },
          },
          data: {
            status: 'PENDING',
            acknowledgedAt: null,
          }
        });
      }
    }

    return {
      alreadyReversed: false,
      revertedPaymentId: payment.id,
      restoredStatus,
      restoredPending,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyReversed: Boolean(result.alreadyReversed),
    revertedPaymentId: result.revertedPaymentId || null,
    statementStatus: result.restoredStatus || null,
    restoredStatus: result.restoredStatus || null,
    pendingBalance: result.restoredPending !== undefined && result.restoredPending !== null ? result.restoredPending.toString() : null,
  };
}

/**
 * Returns comprehensive credit card details including credit limit, ledger balance,
 * available credit, active statement, payment history, and pending balance.
 */
export async function getCreditCardDetails(
  userId: string,
  accountId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
    include: {
      defaultPaymentAccount: { select: { id: true, name: true, userId: true } },
      creditCardStatements: {
        orderBy: { dueDate: 'desc' },
        include: {
          payments: {
            orderBy: { paidAt: 'desc' },
            include: {
              fromAccount: { select: { id: true, name: true } },
            }
          }
        }
      }
    }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  if (account.type !== 'CREDIT_CARD') {
    throw new Error('Account is not a credit card');
  }

  // Calculate current ledger balance and available credit (SOL-R001-015: includes debt ledger transactions)
  const txs = await db.financialTransaction.findMany({
    where: {
      userId,
      OR: [
        { accountId: account.id },
        { transferAccountId: account.id },
      ]
    }
  });

  const { amountUsed, availableCredit } = calculateCreditCardUsage(
    account.openingBalance,
    txs,
    account.id,
    account.creditLimit
  );
  const ledgerBalance = amountUsed;
  const creditLimit = account.creditLimit;

  // Active statement is the earliest open/partial/overdue statement (due soonest);
  // when all statements are paid, activeStatement is null
  const statements = account.creditCardStatements;
  const unpaidStatements = statements
    .filter((s: any) => s.status !== 'PAID')
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const activeStatement = unpaidStatements[0] || null;

  let activeStatementSummary = null;
  if (activeStatement) {
    let totalPaid = new Decimal(0);
    for (const p of activeStatement.payments) {
      totalPaid = totalPaid.plus(p.amount);
    }
    const pendingBalance = activeStatement.statementAmount.minus(totalPaid);

    activeStatementSummary = {
      id: activeStatement.id,
      periodKey: activeStatement.periodKey,
      statementDate: activeStatement.statementDate.toISOString(),
      dueDate: activeStatement.dueDate.toISOString(),
      statementAmount: activeStatement.statementAmount.toString(),
      minimumDue: activeStatement.minimumDue ? activeStatement.minimumDue.toString() : null,
      status: activeStatement.status,
      totalPaid: totalPaid.toString(),
      pendingBalance: pendingBalance.toString(),
      payments: activeStatement.payments.map((p: any) => ({
        id: p.id,
        amount: p.amount.toString(),
        paidAt: p.paidAt.toISOString(),
        fromAccount: p.fromAccount,
        note: p.note,
        transactionId: p.transactionId,
      })),
    };
  }

  const defaultPaymentAccount =
    account.defaultPaymentAccount && account.defaultPaymentAccount.userId === userId
      ? { id: account.defaultPaymentAccount.id, name: account.defaultPaymentAccount.name }
      : null;

  return {
    accountId: account.id,
    name: account.name,
    institution: account.institution,
    creditLimit: creditLimit ? creditLimit.toString() : null,
    ledgerBalance: ledgerBalance.toString(),
    availableCredit: availableCredit ? availableCredit.toString() : null,
    statementDay: account.statementDay,
    paymentDueDay: account.paymentDueDay,
    defaultPaymentAccount,
    activeStatement: activeStatementSummary,
    allStatements: statements.map((s: any) => ({
      id: s.id,
      periodKey: s.periodKey,
      statementDate: s.statementDate.toISOString(),
      dueDate: s.dueDate.toISOString(),
      statementAmount: s.statementAmount.toString(),
      status: s.status,
      paymentsCount: s.payments.length,
    })),
  };
}
