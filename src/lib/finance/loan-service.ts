import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { parseAndValidateAmount } from './finance';
import { getNextOccurrence, RecurrenceRule } from '../recurrence/recurrence';

const defaultPrisma = prisma;
type PrismaClientLike = any;

export const LOAN_TYPES = [
  'PERSONAL',
  'HOME',
  'VEHICLE',
  'EDUCATION',
  'GOLD',
  'PRODUCT_EMI',
  'CREDIT_CARD_EMI',
  'OTHER',
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const createLoanSchema = z.object({
  name: z.string().trim().min(1, 'Loan name is required').max(100),
  loanType: z.enum(LOAN_TYPES),
  lender: z.string().trim().min(1, 'Lender is required').max(100),
  openingOutstanding: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  originalPrincipal: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  trackedFromAt: z.string().or(z.date()).optional(),
  emiAmount: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  emiGeneratesExpense: z.boolean().default(true),
  principalAlreadyRecognized: z.boolean().default(false),
  interestRatePercent: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  interestRateType: z.enum(['FIXED', 'FLOATING', 'UNKNOWN']).default('UNKNOWN'),
  tenureMonths: z.number().int().min(1).optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  expectedEndDate: z.string().or(z.date()).optional().nullable(),
  nextEmiDate: z.string().or(z.date()).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentAccountId: z.string().optional().nullable(),
  productName: z.string().trim().max(100).optional().nullable(),
  merchant: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
  createLinkedObligation: z.boolean().default(false),
});

export const recordEmiPaymentSchema = z.object({
  loanId: z.string().min(1, 'Loan ID is required'),
  amount: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  accountId: z.string().min(1, 'Account ID is required'),
  occurredAt: z.string().or(z.date()).optional(),
  principalPaid: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  interestPaid: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  feesPaid: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  obligationOccurrenceId: z.string().optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  idempotencyKey: z.string().trim().max(100).optional().nullable(),
});

/**
 * Creates a new loan liability snapshot.
 * Invariant: Does not disburse or alter account liquid cash balances (V2-T043).
 * Invariant: Does not create Income (V2-T044).
 */
export async function createLoan(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = createLoanSchema.parse(data);

  const openingOutstandingDecimal = parseAndValidateAmount(parsed.openingOutstanding.toString());
  const originalPrincipalDecimal = parsed.originalPrincipal
    ? parseAndValidateAmount(parsed.originalPrincipal.toString())
    : null;
  const emiAmountDecimal = parsed.emiAmount
    ? parseAndValidateAmount(parsed.emiAmount.toString())
    : null;
  const interestRateDecimal = parsed.interestRatePercent
    ? new Decimal(parsed.interestRatePercent.toString())
    : null;

  if (parsed.paymentAccountId) {
    const acc = await db.financialAccount.findUnique({
      where: { id: parsed.paymentAccountId },
      select: { userId: true, isActive: true }
    });
    if (!acc || acc.userId !== userId) {
      throw new Error('Payment account not found or unauthorized');
    }
  }

  const trackedFromAtDate = parsed.trackedFromAt ? new Date(parsed.trackedFromAt) : new Date();
  const nextEmiDateVal = parsed.nextEmiDate ? new Date(parsed.nextEmiDate) : null;
  const startDateVal = parsed.startDate ? new Date(parsed.startDate) : null;
  const expectedEndDateVal = parsed.expectedEndDate ? new Date(parsed.expectedEndDate) : null;

  const executeInTransaction = async (tx: any) => {
    let linkedObligationId: string | null = null;

    if (parsed.createLinkedObligation && emiAmountDecimal && nextEmiDateVal) {
      const ob = await tx.obligation.create({
        data: {
          userId,
          title: `EMI: ${parsed.name} (${parsed.lender})`,
          kind: 'EMI',
          amount: emiAmountDecimal,
          accountId: parsed.paymentAccountId || null,
          dueAt: nextEmiDateVal,
          recurrenceType: 'MONTHLY',
          reminderOffsetsMin: [2880, 1440, 0], // 2 days, 1 day, due day
          isActive: true,
          nextDueAt: nextEmiDateVal,
          notes: `Linked to loan ${parsed.name}`,
        }
      });
      linkedObligationId = ob.id;
    }

    const loan = await tx.loan.create({
      data: {
        userId,
        name: parsed.name,
        loanType: parsed.loanType,
        lender: parsed.lender,
        originalPrincipal: originalPrincipalDecimal,
        openingOutstanding: openingOutstandingDecimal,
        outstandingPrincipal: openingOutstandingDecimal,
        trackedFromAt: trackedFromAtDate,
        emiAmount: emiAmountDecimal,
        emiGeneratesExpense: parsed.emiGeneratesExpense,
        principalAlreadyRecognized: parsed.principalAlreadyRecognized,
        interestRatePercent: interestRateDecimal,
        interestRateType: parsed.interestRateType,
        tenureMonths: parsed.tenureMonths || null,
        startDate: startDateVal,
        expectedEndDate: expectedEndDateVal,
        nextEmiDate: nextEmiDateVal,
        dueDay: parsed.dueDay || null,
        paymentAccountId: parsed.paymentAccountId || null,
        productName: parsed.productName || null,
        merchant: parsed.merchant || null,
        obligationId: linkedObligationId,
        status: 'ACTIVE',
        notes: parsed.notes || null,
      }
    });

    return loan;
  };

  const loan = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    loan: {
      id: loan.id,
      name: loan.name,
      loanType: loan.loanType,
      lender: loan.lender,
      outstandingPrincipal: loan.outstandingPrincipal.toString(),
      emiAmount: loan.emiAmount ? loan.emiAmount.toString() : null,
      status: loan.status,
      obligationId: loan.obligationId,
    }
  };
}

/**
 * Lists user loans with payment history.
 */
export async function getLoans(
  userId: string,
  options: { status?: string } = {},
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const where: any = { userId };
  if (options.status) {
    where.status = options.status;
  } else {
    where.status = { not: 'ARCHIVED' };
  }

  const loans = await db.loan.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      paymentAccount: { select: { id: true, name: true } },
      obligation: { select: { id: true, title: true, nextDueAt: true } },
      payments: {
        orderBy: { occurredAt: 'desc' },
        take: 5,
        include: {
          account: { select: { id: true, name: true } },
          transaction: { select: { id: true, type: true, amount: true } },
        }
      }
    }
  });

  return loans.map((l: any) => ({
    id: l.id,
    name: l.name,
    loanType: l.loanType,
    lender: l.lender,
    originalPrincipal: l.originalPrincipal ? l.originalPrincipal.toString() : null,
    openingOutstanding: l.openingOutstanding.toString(),
    outstandingPrincipal: l.outstandingPrincipal.toString(),
    trackedFromAt: l.trackedFromAt.toISOString(),
    emiAmount: l.emiAmount ? l.emiAmount.toString() : null,
    emiGeneratesExpense: l.emiGeneratesExpense,
    principalAlreadyRecognized: l.principalAlreadyRecognized,
    interestRatePercent: l.interestRatePercent ? l.interestRatePercent.toString() : null,
    interestRateType: l.interestRateType,
    tenureMonths: l.tenureMonths,
    startDate: l.startDate ? l.startDate.toISOString() : null,
    expectedEndDate: l.expectedEndDate ? l.expectedEndDate.toISOString() : null,
    nextEmiDate: l.nextEmiDate ? l.nextEmiDate.toISOString() : null,
    dueDay: l.dueDay,
    paymentAccount: l.paymentAccount,
    productName: l.productName,
    merchant: l.merchant,
    obligation: l.obligation,
    status: l.status,
    notes: l.notes,
    paymentsCount: l.payments.length,
    payments: l.payments.map((p: any) => ({
      id: p.id,
      amount: p.amount.toString(),
      principalPaid: p.principalPaid ? p.principalPaid.toString() : null,
      interestPaid: p.interestPaid ? p.interestPaid.toString() : null,
      feesPaid: p.feesPaid ? p.feesPaid.toString() : null,
      occurredAt: p.occurredAt.toISOString(),
      account: p.account,
      transaction: p.transaction,
      note: p.note,
    }))
  }));
}

/**
 * Retrieves a single loan by ID.
 */
export async function getLoanById(
  userId: string,
  loanId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: {
      paymentAccount: { select: { id: true, name: true } },
      obligation: { select: { id: true, title: true, nextDueAt: true } },
      payments: {
        orderBy: { occurredAt: 'desc' },
        include: {
          account: { select: { id: true, name: true } },
          transaction: { select: { id: true, type: true, amount: true } },
        }
      }
    }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  return {
    id: loan.id,
    name: loan.name,
    loanType: loan.loanType,
    lender: loan.lender,
    originalPrincipal: loan.originalPrincipal ? loan.originalPrincipal.toString() : null,
    openingOutstanding: loan.openingOutstanding.toString(),
    outstandingPrincipal: loan.outstandingPrincipal.toString(),
    trackedFromAt: loan.trackedFromAt.toISOString(),
    emiAmount: loan.emiAmount ? loan.emiAmount.toString() : null,
    emiGeneratesExpense: loan.emiGeneratesExpense,
    principalAlreadyRecognized: loan.principalAlreadyRecognized,
    interestRatePercent: loan.interestRatePercent ? loan.interestRatePercent.toString() : null,
    interestRateType: loan.interestRateType,
    tenureMonths: loan.tenureMonths,
    startDate: loan.startDate ? loan.startDate.toISOString() : null,
    expectedEndDate: loan.expectedEndDate ? loan.expectedEndDate.toISOString() : null,
    nextEmiDate: loan.nextEmiDate ? loan.nextEmiDate.toISOString() : null,
    dueDay: loan.dueDay,
    paymentAccount: loan.paymentAccount,
    productName: loan.productName,
    merchant: loan.merchant,
    obligation: loan.obligation,
    status: loan.status,
    notes: loan.notes,
    payments: loan.payments.map((p: any) => ({
      id: p.id,
      amount: p.amount.toString(),
      principalPaid: p.principalPaid ? p.principalPaid.toString() : null,
      interestPaid: p.interestPaid ? p.interestPaid.toString() : null,
      feesPaid: p.feesPaid ? p.feesPaid.toString() : null,
      occurredAt: p.occurredAt.toISOString(),
      account: p.account,
      transaction: p.transaction,
      note: p.note,
    }))
  };
}

/**
 * Records an EMI payment with exact accounting rules and idempotency:
 * - Creates exactly one LoanPayment
 * - If emiGeneratesExpense is true, creates exactly one EXPENSE transaction (category 'EMI')
 * - If emiGeneratesExpense is false, creates NO expense transaction
 * - Decrements outstandingPrincipal ONLY when principalPaid is non-null and > 0 (V2-T047, V2-T048)
 * - Deterministic idempotency for repeated submissions (V2-T046, V2-T046b)
 */
export async function recordEmiPayment(
  userId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');
  const parsed = recordEmiPaymentSchema.parse(data);

  const amountDecimal = parseAndValidateAmount(parsed.amount.toString());

  const loan = await db.loan.findUnique({
    where: { id: parsed.loanId },
    include: { payments: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  if (loan.status === 'ARCHIVED') {
    throw new Error('Cannot record payment on an archived loan');
  }

  // Account ownership check (V2-T052)
  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  // Component breakdown validation
  let principalDecimal: Decimal | null = null;
  let interestDecimal: Decimal | null = null;
  let feesDecimal: Decimal | null = null;
  let componentSum = new Decimal(0);

  if (parsed.principalPaid !== undefined && parsed.principalPaid !== null) {
    principalDecimal = new Decimal(parsed.principalPaid.toString());
    if (principalDecimal.lessThan(0)) throw new Error('Principal paid cannot be negative');
    componentSum = componentSum.plus(principalDecimal);
  }

  if (parsed.interestPaid !== undefined && parsed.interestPaid !== null) {
    interestDecimal = new Decimal(parsed.interestPaid.toString());
    if (interestDecimal.lessThan(0)) throw new Error('Interest paid cannot be negative');
    componentSum = componentSum.plus(interestDecimal);
  }

  if (parsed.feesPaid !== undefined && parsed.feesPaid !== null) {
    feesDecimal = new Decimal(parsed.feesPaid.toString());
    if (feesDecimal.lessThan(0)) throw new Error('Fees paid cannot be negative');
    componentSum = componentSum.plus(feesDecimal);
  }

  if (componentSum.greaterThan(amountDecimal)) {
    throw new Error('Sum of principal, interest and fees cannot exceed total payment amount');
  }

  // Idempotency check 1: by obligationOccurrenceId (V2-T046, V2-T046b)
  if (parsed.obligationOccurrenceId) {
    const existing = await db.loanPayment.findUnique({
      where: { obligationOccurrenceId: parsed.obligationOccurrenceId },
      include: { transaction: true }
    });
    if (existing) {
      return {
        success: true,
        alreadyProcessed: true,
        paymentId: existing.id,
        transactionId: existing.transactionId,
        remainingPrincipal: loan.outstandingPrincipal.toString(),
        closed: loan.status === 'CLOSED',
      };
    }
  }

  // Idempotency check 2: by idempotencyKey
  if (parsed.idempotencyKey) {
    const keyTag = `[idempotency:${parsed.idempotencyKey}]`;
    const existing = loan.payments.find((p: any) => p.note && p.note.includes(keyTag));
    if (existing) {
      return {
        success: true,
        alreadyProcessed: true,
        paymentId: existing.id,
        transactionId: existing.transactionId,
        remainingPrincipal: loan.outstandingPrincipal.toString(),
        closed: loan.status === 'CLOSED',
      };
    }
  }

  const occurredAtDate = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const noteTag = parsed.idempotencyKey ? ` [idempotency:${parsed.idempotencyKey}]` : '';
  const paymentNote = parsed.note
    ? `${parsed.note}${noteTag}`
    : `EMI Payment: ${loan.name}${noteTag}`;

  const executeInTransaction = async (tx: any) => {
    let createdTxId: string | null = null;

    // Optional Expense transaction creation (governed by loan.emiGeneratesExpense)
    if (loan.emiGeneratesExpense) {
      const expenseTx = await tx.financialTransaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount: amountDecimal,
          category: 'EMI',
          accountId: parsed.accountId,
          occurredAt: occurredAtDate,
          note: paymentNote,
        }
      });
      createdTxId = expenseTx.id;
    }

    // Create authoritative LoanPayment
    const payment = await tx.loanPayment.create({
      data: {
        userId,
        loanId: loan.id,
        amount: amountDecimal,
        principalPaid: principalDecimal,
        interestPaid: interestDecimal,
        feesPaid: feesDecimal,
        occurredAt: occurredAtDate,
        accountId: parsed.accountId,
        transactionId: createdTxId,
        obligationOccurrenceId: parsed.obligationOccurrenceId || null,
        note: paymentNote,
      }
    });

    // Update loan outstanding ONLY when principalPaid is known and > 0 (V2-T047, V2-T048)
    let newOutstanding = loan.outstandingPrincipal;
    let isClosed = false;

    if (principalDecimal && principalDecimal.greaterThan(0)) {
      newOutstanding = loan.outstandingPrincipal.minus(principalDecimal);
      if (newOutstanding.lessThan(0)) newOutstanding = new Decimal(0);
      isClosed = newOutstanding.isZero();
    }

    // Advance next EMI date if loan has one
    let nextEmi: Date | null = loan.nextEmiDate;
    if (loan.nextEmiDate) {
      const rule: RecurrenceRule = { type: 'MONTHLY', timezone: 'UTC' };
      nextEmi = getNextOccurrence(rule, loan.nextEmiDate, new Date(loan.nextEmiDate.getTime() + 1000));
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        outstandingPrincipal: newOutstanding,
        nextEmiDate: nextEmi,
        status: isClosed ? 'CLOSED' : loan.status,
      }
    });

    return {
      payment,
      createdTxId,
      newOutstanding,
      isClosed,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyProcessed: false,
    paymentId: result.payment.id,
    transactionId: result.createdTxId,
    remainingPrincipal: result.newOutstanding.toString(),
    closed: result.isClosed,
    principalReduced: principalDecimal !== null && principalDecimal.greaterThan(0),
  };
}

/**
 * Reconciles loan outstanding balance manually (V2-T049).
 */
export async function reconcileOutstanding(
  userId: string,
  loanId: string,
  newOutstanding: string | number | Decimal,
  note?: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const outstandingDecimal = new Decimal(newOutstanding.toString());
  if (outstandingDecimal.lessThan(0)) {
    throw new Error('Outstanding principal cannot be negative');
  }

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    select: { userId: true, status: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  const isClosed = outstandingDecimal.isZero();

  const updated = await db.loan.update({
    where: { id: loanId },
    data: {
      outstandingPrincipal: outstandingDecimal,
      status: isClosed ? 'CLOSED' : (loan.status === 'CLOSED' ? 'ACTIVE' : loan.status),
      notes: note || undefined,
    }
  });

  return {
    success: true,
    outstandingPrincipal: updated.outstandingPrincipal.toString(),
    status: updated.status,
  };
}

/**
 * Closes a loan (V2-T050).
 */
export async function closeLoan(
  userId: string,
  loanId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    select: { userId: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  await db.loan.update({
    where: { id: loanId },
    data: { status: 'CLOSED' }
  });

  return { success: true };
}

/**
 * Archives a loan (soft delete).
 */
export async function archiveLoan(
  userId: string,
  loanId: string,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    select: { userId: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  await db.loan.update({
    where: { id: loanId },
    data: { status: 'ARCHIVED' }
  });

  return { success: true };
}

export interface RevertEmiPaymentInput {
  loanPaymentId?: string;
  obligationOccurrenceId?: string;
  loanId?: string;
  revertToDate?: Date | string;
}

/**
 * Reverts an EMI payment atomically (V2-651 / Architecture Section 11):
 * - Removes the specific LoanPayment record
 * - Removes the linked EXPENSE transaction (if generated)
 * - Adds back principalPaid to outstandingPrincipal (if principalPaid was recorded)
 * - Restores loan status from CLOSED to ACTIVE if needed
 * - Restores nextEmiDate to the scheduled date of the reverted occurrence
 * - Idempotent on repeated calls
 */
export async function revertEmiPayment(
  userId: string,
  input: RevertEmiPaymentInput,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  let payment: any = null;
  if (input.loanPaymentId) {
    payment = await db.loanPayment.findUnique({
      where: { id: input.loanPaymentId },
      include: { loan: true, transaction: true }
    });
  } else if (input.obligationOccurrenceId) {
    payment = await db.loanPayment.findUnique({
      where: { obligationOccurrenceId: input.obligationOccurrenceId },
      include: { loan: true, transaction: true }
    });
  } else if (input.loanId) {
    const payments = await db.loanPayment.findMany({
      where: { loanId: input.loanId, userId },
      orderBy: { occurredAt: 'desc' },
      take: 1,
      include: { loan: true, transaction: true }
    });
    payment = payments[0] || null;
  }

  if (!payment) {
    return {
      success: true,
      alreadyReversed: true,
      message: 'Loan payment not found or already reversed',
    };
  }

  if (payment.userId !== userId) {
    throw new Error('Unauthorized: payment belongs to another user');
  }

  const loan = payment.loan;

  const executeInTransaction = async (tx: any) => {
    // 1. Delete linked FinancialTransaction if one was created
    if (payment.transactionId) {
      await tx.financialTransaction.delete({
        where: { id: payment.transactionId }
      });
    }

    // 2. Delete the LoanPayment
    await tx.loanPayment.delete({
      where: { id: payment.id }
    });

    // 3. Add back principalPaid to outstandingPrincipal if principalPaid was recorded
    let restoredOutstanding = loan.outstandingPrincipal;
    if (payment.principalPaid && payment.principalPaid.greaterThan(0)) {
      restoredOutstanding = loan.outstandingPrincipal.plus(payment.principalPaid);
    }

    // 4. Restore nextEmiDate
    const restoredNextEmiDate = input.revertToDate
      ? new Date(input.revertToDate)
      : payment.occurredAt;

    const restoredStatus = loan.status === 'CLOSED' ? 'ACTIVE' : loan.status;

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        outstandingPrincipal: restoredOutstanding,
        nextEmiDate: restoredNextEmiDate,
        status: restoredStatus,
      }
    });

    return {
      paymentId: payment.id,
      restoredOutstanding,
      restoredNextEmiDate,
      restoredStatus,
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    alreadyReversed: false,
    revertedPaymentId: result.paymentId,
    restoredOutstanding: result.restoredOutstanding.toString(),
    restoredNextEmiDate: result.restoredNextEmiDate ? result.restoredNextEmiDate.toISOString() : null,
    restoredStatus: result.restoredStatus,
  };
}
