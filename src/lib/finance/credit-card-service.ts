import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { parseAndValidateAmount } from './finance';
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

  // Check unique period
  const existing = await db.creditCardStatement.findUnique({
    where: {
      accountId_periodKey: {
        accountId: parsed.accountId,
        periodKey: parsed.periodKey,
      }
    }
  });

  if (existing) {
    throw new Error(`Statement for period ${parsed.periodKey} already exists for this card`);
  }

  // Find or create linked Obligation
  let obligation = await db.obligation.findFirst({
    where: {
      userId,
      accountId: account.id,
      kind: 'CREDIT_CARD',
      isArchived: false,
    }
  });

  const executeInTransaction = async (tx: any) => {
    if (!obligation) {
      obligation = await tx.obligation.create({
        data: {
          userId,
          title: `${account.name} Bill`,
          kind: 'CREDIT_CARD',
          accountId: account.id,
          amount: statementAmount,
          dueAt: dueDate,
          nextDueAt: dueDate,
          recurrenceType: 'MONTHLY',
          recurrenceInterval: 1,
          reminderOffsetsMin: [0, 1440, 4320], // 0d, 1d, 3d
          isActive: true,
        }
      });
    } else {
      obligation = await tx.obligation.update({
        where: { id: obligation.id },
        data: {
          amount: statementAmount,
          nextDueAt: dueDate,
          isActive: true,
        }
      });
    }

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

    return statement;
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    statement: {
      id: result.id,
      accountId: result.accountId,
      periodKey: result.periodKey,
      statementDate: result.statementDate.toISOString(),
      dueDate: result.dueDate.toISOString(),
      statementAmount: result.statementAmount.toString(),
      minimumDue: result.minimumDue ? result.minimumDue.toString() : null,
      status: result.status,
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

  const statement = await db.creditCardStatement.findUnique({
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

  if (statement.status === 'PAID') {
    throw new Error('Statement is already fully paid');
  }

  // Verify fromAccountId ownership and type
  const fromAccount = await db.financialAccount.findUnique({
    where: { id: parsed.fromAccountId },
    select: { id: true, userId: true, name: true, isActive: true }
  });

  if (!fromAccount || fromAccount.userId !== userId) {
    throw new Error('Source payment account not found or unauthorized');
  }

  if (fromAccount.id === statement.accountId) {
    throw new Error('Source account cannot be the credit card being paid');
  }

  // Idempotency check by note key if supplied
  if (parsed.idempotencyKey) {
    const keyTag = `[idempotency:${parsed.idempotencyKey}]`;
    const existingPayment = statement.payments.find(
      (p: any) => p.note && p.note.includes(keyTag)
    );
    if (existingPayment) {
      return {
        success: true,
        alreadyProcessed: true,
        paymentId: existingPayment.id,
        statementStatus: statement.status,
      };
    }
  }

  // Calculate pending balance
  let sumPaidBefore = new Decimal(0);
  for (const p of statement.payments) {
    sumPaidBefore = sumPaidBefore.plus(p.amount);
  }
  const pendingBefore = statement.statementAmount.minus(sumPaidBefore);

  if (amountDecimal.greaterThan(pendingBefore)) {
    throw new Error(
      `Payment amount (${amountDecimal}) cannot exceed pending balance (${pendingBefore})`
    );
  }

  const paidAtDate = parsed.paidAt ? new Date(parsed.paidAt) : new Date();
  const noteTag = parsed.idempotencyKey ? ` [idempotency:${parsed.idempotencyKey}]` : '';
  const paymentNote = parsed.note
    ? `${parsed.note}${noteTag}`
    : `CC Payment: ${statement.account.name} (${statement.periodKey})${noteTag}`;

  const executeInTransaction = async (tx: any) => {
    // 1. Create TRANSFER transaction from bank account to credit card
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

    // 2. Create CreditCardPayment record
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

    // 3. Recalculate status
    const sumPaidAfter = sumPaidBefore.plus(amountDecimal);
    const pendingAfter = statement.statementAmount.minus(sumPaidAfter);
    const isFullyPaid = pendingAfter.isZero();
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';

    await tx.creditCardStatement.update({
      where: { id: statement.id },
      data: { status: newStatus }
    });

    // 4. Update linked Obligation
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

        // Advance obligation nextDueAt to next month
        const rule: RecurrenceRule = {
          type: 'MONTHLY',
          interval: 1,
          timezone: tz,
        };
        const nextDue = getNextOccurrence(rule, ob.dueAt, statement.dueDate);

        await tx.obligation.update({
          where: { id: ob.id },
          data: {
            amount: null, // Clear until next statement
            nextDueAt: nextDue || statement.dueDate,
            lastCompletedAt: paidAtDate,
          }
        });

        // Acknowledge pending deliveries for this occurrence
        await tx.reminderDelivery.updateMany({
          where: {
            obligationId: ob.id,
            occurrenceKey,
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
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyProcessed: false,
    paymentId: result.payment.id,
    transactionId: result.transferTx.id,
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

  let payment: any = null;
  if (input.paymentId) {
    payment = await db.creditCardPayment.findUnique({
      where: { id: input.paymentId },
      include: {
        statement: {
          include: {
            obligation: true,
            payments: true,
          }
        },
        transaction: true,
      }
    });
  } else if (input.statementId) {
    const payments = await db.creditCardPayment.findMany({
      where: { statementId: input.statementId, userId },
      orderBy: { paidAt: 'desc' },
      take: 1,
      include: {
        statement: {
          include: {
            obligation: true,
            payments: true,
          }
        },
        transaction: true,
      }
    });
    payment = payments[0] || null;
  }

  if (!payment) {
    return {
      success: true,
      alreadyReversed: true,
      message: 'Credit card payment not found or already reverted',
    };
  }

  if (payment.userId !== userId) {
    throw new Error('Unauthorized: payment belongs to another user');
  }

  const statement = payment.statement;

  const executeInTransaction = async (tx: any) => {
    // 1. Delete linked TRANSFER transaction
    if (payment.transactionId) {
      await tx.financialTransaction.delete({
        where: { id: payment.transactionId }
      });
    }

    // 2. Delete the payment
    await tx.creditCardPayment.delete({
      where: { id: payment.id }
    });

    // 3. Recalculate remaining payments
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

    // 4. Restore Obligation state if it was marked PAID
    if (statement.obligation) {
      const ob = statement.obligation;
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

      // Restore nextDueAt and amount
      await tx.obligation.update({
        where: { id: ob.id },
        data: {
          amount: restoredPending,
          nextDueAt: statement.dueDate,
          isActive: true,
        }
      });
    }

    return {
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
    alreadyReversed: false,
    revertedPaymentId: result.revertedPaymentId,
    restoredStatus: result.restoredStatus,
    pendingBalance: result.restoredPending.toString(),
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
      defaultPaymentAccount: { select: { id: true, name: true } },
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

  // Calculate current ledger balance
  // In Double-Entry logic:
  // For CREDIT_CARD: opening balance + expenses - transfers_to - income + transfers_from
  const txs = await db.financialTransaction.findMany({
    where: {
      userId,
      OR: [
        { accountId: account.id },
        { transferAccountId: account.id },
      ]
    }
  });

  let ledgerBalance = account.openingBalance;
  for (const t of txs) {
    if (t.accountId === account.id) {
      if (t.type === 'EXPENSE') {
        ledgerBalance = ledgerBalance.plus(t.amount);
      } else if (t.type === 'INCOME') {
        ledgerBalance = ledgerBalance.minus(t.amount);
      } else if (t.type === 'TRANSFER') {
        // Transfer out of credit card increases debt
        ledgerBalance = ledgerBalance.plus(t.amount);
      }
    } else if (t.transferAccountId === account.id) {
      // Transfer into credit card (payment) reduces debt
      ledgerBalance = ledgerBalance.minus(t.amount);
    }
  }

  const creditLimit = account.creditLimit;
  const availableCredit = creditLimit ? creditLimit.minus(ledgerBalance) : null;

  // Active / Latest open or partial statement (fully paid statements are not active)
  const statements = account.creditCardStatements;
  const activeStatement = statements.find((s: any) => s.status !== 'PAID') || null;

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

  return {
    accountId: account.id,
    name: account.name,
    institution: account.institution,
    creditLimit: creditLimit ? creditLimit.toString() : null,
    ledgerBalance: ledgerBalance.toString(),
    availableCredit: availableCredit ? availableCredit.toString() : null,
    statementDay: account.statementDay,
    paymentDueDay: account.paymentDueDay,
    defaultPaymentAccount: account.defaultPaymentAccount,
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
