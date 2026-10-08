import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { parseAndValidateAmount } from './finance';
import { getNextOccurrence, RecurrenceRule, clampDayToMonth, getOccurrenceKey } from '../recurrence/recurrence';
import { TZDate } from '@date-fns/tz';

const defaultPrisma = prisma;
type PrismaClientLike = any;

export function isSameCalendarDate(d1: Date, d2: Date, tz: string): boolean {
  const tz1 = new TZDate(d1, tz);
  const tz2 = new TZDate(d2, tz);
  return (
    tz1.getFullYear() === tz2.getFullYear() &&
    tz1.getMonth() === tz2.getMonth() &&
    tz1.getDate() === tz2.getDate()
  );
}

export function parseCalendarDateOrIso(dateInput: string | Date | null | undefined, timezone: string): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    const tzDate = new TZDate(y, m - 1, d, 12, 0, 0, 0, timezone);
    return new Date(tzDate.getTime());
  }
  return new Date(dateInput);
}

/**
 * Centralized helper for deactivating/archiving linked obligation and cancelling pending reminder claims.
 * Invoked on all loan closure paths: closeLoan, archiveLoan, reconcileOutstanding(0), and recordEmiPayment (isClosed).
 */
export async function cleanupLoanRemindersAndObligation(
  tx: any,
  userId: string,
  loanId: string,
  obligationId?: string | null
) {
  if (obligationId) {
    await tx.obligation.update({
      where: { id: obligationId },
      data: { isActive: false, isArchived: true }
    });

    await tx.reminderDelivery.deleteMany({
      where: {
        obligationId,
        status: { in: ['PENDING', 'SNOOZED'] }
      }
    });
  }

  const loanReminders = await tx.reminder.findMany({
    where: {
      userId,
      OR: [
        { domain: 'FINANCE', type: 'LOAN_EMI', category: loanId },
        ...(obligationId ? [{ obligationId }] : [])
      ]
    }
  });

  for (const rem of loanReminders) {
    await tx.reminder.update({
      where: { id: rem.id },
      data: { isActive: false }
    });
    await tx.reminderDelivery.deleteMany({
      where: {
        reminderId: rem.id,
        status: { in: ['PENDING', 'SNOOZED'] }
      }
    });
  }
}

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

export const updateLoanSchema = z.object({
  name: z.string().trim().min(1, 'Loan name is required').max(100).optional(),
  loanType: z.enum(LOAN_TYPES).optional(),
  lender: z.string().trim().min(1, 'Lender is required').max(100).optional(),
  emiAmount: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  nextEmiDate: z.string().or(z.date()).optional().nullable(),
  interestRatePercent: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  interestRateType: z.enum(['FIXED', 'FLOATING', 'UNKNOWN']).optional(),
  tenureMonths: z.number().int().min(1).optional().nullable(),
  paymentAccountId: z.string().optional().nullable(),
  productName: z.string().trim().max(100).optional().nullable(),
  merchant: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
  createLinkedObligation: z.boolean().optional(),
});

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
  createLinkedObligation: z.boolean().default(true),
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
  obligationPaymentId: z.string().optional().nullable(),
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

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const userTimezone = user?.timezone || 'Asia/Kolkata';

  const trackedFromAtDate = parsed.trackedFromAt ? new Date(parsed.trackedFromAt) : new Date();
  const nextEmiDateVal = parsed.nextEmiDate ? parseCalendarDateOrIso(parsed.nextEmiDate, userTimezone) : null;
  const startDateVal = parsed.startDate ? parseCalendarDateOrIso(parsed.startDate, userTimezone) : null;
  const expectedEndDateVal = parsed.expectedEndDate ? parseCalendarDateOrIso(parsed.expectedEndDate, userTimezone) : null;

  // Calculate effectiveNextEmiDate if dueDay is provided without explicit nextEmiDate
  let effectiveNextEmiDate = nextEmiDateVal;
  if (!effectiveNextEmiDate && parsed.dueDay) {
    const now = new Date();
    const nowInTz = new TZDate(now, userTimezone);
    const year = nowInTz.getFullYear();
    const month = nowInTz.getMonth();
    const clampedDay = clampDayToMonth(year, month, parsed.dueDay);
    let candidate = new TZDate(year, month, clampedDay, 12, 0, 0, 0, userTimezone);
    if (candidate.getTime() <= now.getTime()) {
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      const nextClamped = clampDayToMonth(nextYear, nextMonth, parsed.dueDay);
      candidate = new TZDate(nextYear, nextMonth, nextClamped, 12, 0, 0, 0, userTimezone);
    }
    effectiveNextEmiDate = new Date(candidate.getTime());
  }

  const executeInTransaction = async (tx: any) => {
    let linkedObligationId: string | null = null;

    if (parsed.createLinkedObligation !== false && emiAmountDecimal && effectiveNextEmiDate) {
      // Finding #3: Strictly create new obligation. Never lookup by title/kind filter to prevent hijacking manual obligations.
      const ob = await tx.obligation.create({
        data: {
          userId,
          title: `EMI: ${parsed.name} (${parsed.lender})`,
          kind: 'EMI',
          amount: emiAmountDecimal,
          accountId: parsed.paymentAccountId || null,
          dueAt: effectiveNextEmiDate,
          recurrenceType: 'MONTHLY',
          recurrenceInterval: 1,
          reminderOffsetsMin: [2880, 1440, 0], // 2 days, 1 day, due day
          isActive: true,
          nextDueAt: effectiveNextEmiDate,
          notes: `Linked to loan ${parsed.name}`,
        }
      });
      linkedObligationId = ob.id;
    }

    const notesWithOptOut = parsed.createLinkedObligation === false
      ? (parsed.notes ? `${parsed.notes} [noLinkedObligation]` : '[noLinkedObligation]')
      : (parsed.notes || null);

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
        nextEmiDate: effectiveNextEmiDate,
        dueDay: parsed.dueDay ?? (effectiveNextEmiDate ? new TZDate(effectiveNextEmiDate, userTimezone).getDate() : null),
        paymentAccountId: parsed.paymentAccountId || null,
        productName: parsed.productName || null,
        merchant: parsed.merchant || null,
        obligationId: linkedObligationId,
        status: 'ACTIVE',
        notes: notesWithOptOut,
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
      dueDay: loan.dueDay,
      nextEmiDate: loan.nextEmiDate ? loan.nextEmiDate.toISOString() : null,
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

  // Account ownership check (V2-T052)
  const account = await db.financialAccount.findUnique({
    where: { id: parsed.accountId },
    select: { userId: true, isActive: true }
  });

  if (!account || account.userId !== userId) {
    throw new Error('Account not found or unauthorized');
  }

  // Component breakdown validation (SOL-R002-009)
  let principalDecimal: Decimal | null = null;
  let interestDecimal: Decimal | null = null;
  let feesDecimal: Decimal | null = null;
  let componentSum = new Decimal(0);

  if (parsed.principalPaid !== undefined && parsed.principalPaid !== null) {
    try {
      principalDecimal = new Decimal(parsed.principalPaid.toString());
    } catch {
      throw new Error('Invalid principal amount');
    }
    if (principalDecimal.isNaN() || !principalDecimal.isFinite()) {
      throw new Error('Principal paid must be a finite number');
    }
    if (principalDecimal.lessThan(0)) {
      throw new Error('Principal paid cannot be negative');
    }
    if (principalDecimal.decimalPlaces() > 2) {
      throw new Error('Principal paid cannot have more than 2 decimal places');
    }
    componentSum = componentSum.plus(principalDecimal);
  }

  if (parsed.interestPaid !== undefined && parsed.interestPaid !== null) {
    try {
      interestDecimal = new Decimal(parsed.interestPaid.toString());
    } catch {
      throw new Error('Invalid interest amount');
    }
    if (interestDecimal.isNaN() || !interestDecimal.isFinite()) {
      throw new Error('Interest paid must be a finite number');
    }
    if (interestDecimal.lessThan(0)) {
      throw new Error('Interest paid cannot be negative');
    }
    if (interestDecimal.decimalPlaces() > 2) {
      throw new Error('Interest paid cannot have more than 2 decimal places');
    }
    componentSum = componentSum.plus(interestDecimal);
  }

  if (parsed.feesPaid !== undefined && parsed.feesPaid !== null) {
    try {
      feesDecimal = new Decimal(parsed.feesPaid.toString());
    } catch {
      throw new Error('Invalid fees amount');
    }
    if (feesDecimal.isNaN() || !feesDecimal.isFinite()) {
      throw new Error('Fees paid must be a finite number');
    }
    if (feesDecimal.lessThan(0)) {
      throw new Error('Fees paid cannot be negative');
    }
    if (feesDecimal.decimalPlaces() > 2) {
      throw new Error('Fees paid cannot have more than 2 decimal places');
    }
    componentSum = componentSum.plus(feesDecimal);
  }

  if (componentSum.greaterThan(amountDecimal)) {
    throw new Error('Sum of principal, interest and fees cannot exceed total payment amount');
  }

  // Idempotency check 1: by obligationOccurrenceId (V2-T046, V2-T046b)
  if (parsed.obligationOccurrenceId) {
    const occurrence = await db.obligationOccurrence.findUnique({
      where: { id: parsed.obligationOccurrenceId },
      select: { id: true, userId: true, obligationId: true }
    });
    if (!occurrence || occurrence.userId !== userId || !loan.obligationId || occurrence.obligationId !== loan.obligationId) {
      throw new Error('Obligation occurrence not found or unauthorized');
    }

    const existing = await db.loanPayment.findFirst({
      where: {
        obligationOccurrenceId: parsed.obligationOccurrenceId,
        loanId: loan.id,
        userId,
      },
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

  // Idempotency check 3: by obligationPaymentId
  if (parsed.obligationPaymentId) {
    const obTag = `[obligationPayment:${parsed.obligationPaymentId}]`;
    const existing = loan.payments.find((p: any) => p.note && p.note.includes(obTag));
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

  // Reject new mutations on archived or closed loans unless it was an idempotent retry
  if (loan.status === 'ARCHIVED') {
    throw new Error('Cannot record payment on an archived loan');
  }
  if (loan.status === 'CLOSED') {
    throw new Error('Cannot record payment on a closed loan');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const userTimezone = user?.timezone || 'Asia/Kolkata';

  const occurredAtDate = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const noteTags: string[] = [];
  if (parsed.idempotencyKey) {
    noteTags.push(`[idempotency:${parsed.idempotencyKey}]`);
  }
  if (parsed.obligationPaymentId) {
    noteTags.push(`[obligationPayment:${parsed.obligationPaymentId}]`);
  }
  const tagsSuffix = noteTags.length > 0 ? ` ${noteTags.join(' ')}` : '';
  const paymentNote = parsed.note
    ? `${parsed.note}${tagsSuffix}`
    : `EMI Payment: ${loan.name}${tagsSuffix}`;

  const executeInTransaction = async (tx: any) => {
    // Row lock loan inside tx to serialize concurrent updates
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loan.id} FOR UPDATE`;
    }

    const currentLoan = await tx.loan.findUnique({
      where: { id: loan.id },
      select: {
        id: true,
        userId: true,
        name: true,
        status: true,
        obligationId: true,
        outstandingPrincipal: true,
        nextEmiDate: true,
        dueDay: true,
        emiGeneratesExpense: true,
      }
    });

    if (!currentLoan || currentLoan.userId !== userId) {
      throw new Error('Loan not found or unauthorized');
    }

    // Ticket R001-P1-01: Re-check idempotency under transaction lock with cross-user isolation
    let existingPayment: any = null;

    if (parsed.obligationOccurrenceId) {
      const occurrence = await tx.obligationOccurrence.findUnique({
        where: { id: parsed.obligationOccurrenceId },
        select: { id: true, userId: true, obligationId: true }
      });
      if (!occurrence || occurrence.userId !== userId || !currentLoan.obligationId || occurrence.obligationId !== currentLoan.obligationId) {
        throw new Error('Obligation occurrence not found or unauthorized');
      }

      existingPayment = await tx.loanPayment.findFirst({
        where: {
          obligationOccurrenceId: parsed.obligationOccurrenceId,
          loanId: currentLoan.id,
          userId,
        },
      });
    }

    if (!existingPayment && parsed.idempotencyKey) {
      const keyTag = `[idempotency:${parsed.idempotencyKey}]`;
      existingPayment = await tx.loanPayment.findFirst({
        where: {
          loanId: currentLoan.id,
          userId,
          note: { contains: keyTag },
        },
      });
    }

    if (!existingPayment && parsed.obligationPaymentId) {
      const obTag = `[obligationPayment:${parsed.obligationPaymentId}]`;
      existingPayment = await tx.loanPayment.findFirst({
        where: {
          loanId: currentLoan.id,
          userId,
          note: { contains: obTag },
        },
      });
    }

    if (existingPayment) {
      return {
        alreadyProcessed: true,
        paymentId: existingPayment.id,
        transactionId: existingPayment.transactionId,
        remainingPrincipal: currentLoan.outstandingPrincipal.toString(),
        closed: currentLoan.status === 'CLOSED',
      };
    }

    // Under row lock: revalidate loan status (SOL-R002-003)
    if (currentLoan.status === 'ARCHIVED') {
      throw new Error('Cannot record payment on an archived loan');
    }
    if (currentLoan.status === 'CLOSED') {
      throw new Error('Cannot record payment on a closed loan');
    }

    // Calculate principal reduction and check closure (SOL-R002-002)
    let actualPrincipalPaid: Decimal | null = null;
    let newOutstanding = currentLoan.outstandingPrincipal;
    let isClosed = false;

    if (principalDecimal && principalDecimal.greaterThan(0)) {
      // Clamp principal reduction to currentLoan.outstandingPrincipal so outstanding never drops below 0
      actualPrincipalPaid = principalDecimal.greaterThan(currentLoan.outstandingPrincipal)
        ? currentLoan.outstandingPrincipal
        : principalDecimal;
      newOutstanding = currentLoan.outstandingPrincipal.minus(actualPrincipalPaid);
      isClosed = newOutstanding.isZero();
    }

    let noteWithTags = paymentNote;
    if (currentLoan.nextEmiDate) {
      const schedTag = `[scheduledDate:${currentLoan.nextEmiDate.toISOString()}]`;
      if (!noteWithTags.includes('[scheduledDate:')) {
        noteWithTags = noteWithTags ? `${noteWithTags} ${schedTag}` : schedTag;
      }
    }
    if (actualPrincipalPaid && actualPrincipalPaid.greaterThan(0)) {
      const reductionTag = `[actualPrincipalReduction:${actualPrincipalPaid.toString()}]`;
      if (!noteWithTags.includes('[actualPrincipalReduction:')) {
        noteWithTags = noteWithTags ? `${noteWithTags} ${reductionTag}` : reductionTag;
      }
    }

    let createdTxId: string | null = null;

    // Optional Expense transaction creation (governed by loan.emiGeneratesExpense)
    if (currentLoan.emiGeneratesExpense) {
      const expenseTx = await tx.financialTransaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount: amountDecimal,
          category: 'EMI',
          accountId: parsed.accountId,
          occurredAt: occurredAtDate,
          note: noteWithTags,
        }
      });
      createdTxId = expenseTx.id;
    }

    // Create authoritative LoanPayment
    const payment = await tx.loanPayment.create({
      data: {
        userId,
        loanId: currentLoan.id,
        amount: amountDecimal,
        principalPaid: actualPrincipalPaid,
        interestPaid: interestDecimal,
        feesPaid: feesDecimal,
        occurredAt: occurredAtDate,
        accountId: parsed.accountId,
        transactionId: createdTxId,
        obligationOccurrenceId: parsed.obligationOccurrenceId || null,
        note: noteWithTags,
      }
    });

    // Advance next EMI date if loan has one, preserving target day of month in user's timezone
    let nextEmi: Date | null = currentLoan.nextEmiDate;
    const targetDay = currentLoan.dueDay ?? (currentLoan.nextEmiDate ? new TZDate(currentLoan.nextEmiDate, userTimezone).getDate() : null);
    if (currentLoan.nextEmiDate && targetDay !== null) {
      const rule: RecurrenceRule = {
        type: 'MONTHLY',
        interval: 1,
        targetDayOfMonth: targetDay,
        timezone: userTimezone,
      };
      nextEmi = getNextOccurrence(rule, currentLoan.nextEmiDate, new Date(currentLoan.nextEmiDate.getTime() + 1000));
    }

    await tx.loan.update({
      where: { id: currentLoan.id },
      data: {
        outstandingPrincipal: newOutstanding,
        nextEmiDate: nextEmi,
        dueDay: targetDay,
        status: isClosed ? 'CLOSED' : currentLoan.status,
      }
    });

    if (isClosed) {
      // Finding #5 & Finding 3: Centralized closure cleanup using locked obligationId
      await cleanupLoanRemindersAndObligation(tx, userId, currentLoan.id, currentLoan.obligationId);
    } else if (currentLoan.obligationId && nextEmi) {
      // Finding #4: Advance nextEmiDate and synchronize linked obligation's nextDueAt
      await tx.obligation.update({
        where: { id: currentLoan.obligationId },
        data: {
          nextDueAt: nextEmi,
          lastCompletedAt: occurredAtDate,
        }
      });

      if (currentLoan.nextEmiDate) {
        const occurrenceKey = getOccurrenceKey(currentLoan.nextEmiDate, userTimezone);
        await tx.reminderDelivery.updateMany({
          where: {
            obligationId: currentLoan.obligationId,
            occurrenceKey,
            status: { in: ['PENDING', 'SENT', 'SNOOZED', 'FAILED'] }
          },
          data: {
            status: 'ACKNOWLEDGED',
            acknowledgedAt: occurredAtDate,
            nextRetryAt: null,
          }
        });
      }
    }

    return {
      alreadyProcessed: false,
      payment,
      createdTxId,
      newOutstanding,
      isClosed,
      nextEmiDate: nextEmi,
      principalReduced: actualPrincipalPaid !== null && actualPrincipalPaid.greaterThan(0),
    };
  };

  const result = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  if (result.alreadyProcessed) {
    return {
      success: true,
      alreadyProcessed: true,
      paymentId: result.paymentId,
      transactionId: result.transactionId,
      remainingPrincipal: result.remainingPrincipal,
      closed: result.closed,
    };
  }

  return {
    success: true,
    alreadyProcessed: false,
    paymentId: result.payment.id,
    transactionId: result.createdTxId,
    remainingPrincipal: result.newOutstanding.toString(),
    closed: result.isClosed,
    principalReduced: result.principalReduced,
    nextEmiDate: result.nextEmiDate,
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
    select: { id: true, userId: true, status: true, obligationId: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  const isClosed = outstandingDecimal.isZero();

  const executeInTransaction = async (tx: any) => {
    // Finding 3: Re-read and lock loan inside tx to avoid missing concurrently linked obligations
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
    }

    const currentLoan = await tx.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        userId: true,
        status: true,
        obligationId: true,
        nextEmiDate: true,
        emiAmount: true,
        paymentAccountId: true,
      }
    });

    if (!currentLoan || currentLoan.userId !== userId) {
      throw new Error('Loan not found or unauthorized');
    }

    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        outstandingPrincipal: outstandingDecimal,
        status: isClosed ? 'CLOSED' : (currentLoan.status === 'CLOSED' ? 'ACTIVE' : currentLoan.status),
        notes: note || undefined,
      }
    });

    if (isClosed) {
      // Finding #5 & Finding 3: Centralized closure cleanup using locked obligationId
      await cleanupLoanRemindersAndObligation(tx, userId, loanId, currentLoan.obligationId);
    } else if (currentLoan.status === 'CLOSED' && !isClosed && outstandingDecimal.greaterThan(0)) {
      // Ticket R001-P1-04: When a CLOSED loan is reopened to ACTIVE
      if (currentLoan.obligationId) {
        const hasActiveSchedule = Boolean(
          currentLoan.nextEmiDate &&
          currentLoan.emiAmount &&
          !new Decimal(currentLoan.emiAmount.toString()).isZero()
        );

        if (hasActiveSchedule) {
          const obligationUpdate: Record<string, any> = {
            isActive: true,
            isArchived: false,
            amount: currentLoan.emiAmount,
            accountId: currentLoan.paymentAccountId ?? null,
          };

          if (currentLoan.nextEmiDate) {
            obligationUpdate.nextDueAt = currentLoan.nextEmiDate;
            obligationUpdate.dueAt = currentLoan.nextEmiDate;
          }

          await tx.obligation.update({
            where: { id: currentLoan.obligationId },
            data: obligationUpdate,
          });

          const loanReminders = await tx.reminder.findMany({
            where: {
              userId,
              OR: [
                { domain: 'FINANCE', type: 'LOAN_EMI', category: loanId },
                { obligationId: currentLoan.obligationId }
              ]
            }
          });

          for (const rem of loanReminders) {
            if (!rem.isActive) {
              await tx.reminder.update({
                where: { id: rem.id },
                data: { isActive: true }
              });
            }
          }
        } else {
          await tx.obligation.update({
            where: { id: currentLoan.obligationId },
            data: { isActive: false }
          });
        }
      }
    }

    return updated;
  };

  const updated = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    outstandingPrincipal: updated.outstandingPrincipal.toString(),
    status: updated.status,
  };
}

/**
 * Updates loan metadata (safe mutable fields).
 * Invariant: outstandingPrincipal cannot be edited directly; corrections must use reconcileOutstanding.
 * Synchronizes linked Obligation if emiAmount or due date/day changes without creating duplicates.
 */
export async function updateLoan(
  userId: string,
  loanId: string,
  data: unknown,
  db: PrismaClientLike = defaultPrisma
) {
  if (!userId) throw new Error('Unauthorized: missing userId');

  if (typeof data === 'object' && data !== null) {
    if ('outstandingPrincipal' in data && (data as any).outstandingPrincipal !== undefined) {
      throw new Error('outstandingPrincipal cannot be updated directly; use reconcileOutstanding instead');
    }
    if ('openingOutstanding' in data && (data as any).openingOutstanding !== undefined) {
      throw new Error('openingOutstanding cannot be updated directly; use reconcileOutstanding instead');
    }
  }

  const parsed = updateLoanSchema.parse(data);

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { obligation: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  if (loan.status === 'ARCHIVED') {
    throw new Error('Cannot update an archived loan');
  }

  if (parsed.paymentAccountId !== undefined && parsed.paymentAccountId !== null) {
    const acc = await db.financialAccount.findUnique({
      where: { id: parsed.paymentAccountId },
      select: { userId: true, isActive: true }
    });
    if (!acc || acc.userId !== userId) {
      throw new Error('Payment account not found or unauthorized');
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const userTimezone = user?.timezone || 'Asia/Kolkata';

  const executeInTransaction = async (tx: any) => {
    // Re-fetch and lock loan row inside transaction to serialize concurrent updates and prevent orphan obligations
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
    }

    const currentLoan = await tx.loan.findUnique({
      where: { id: loanId },
      include: { obligation: true }
    });

    if (!currentLoan || currentLoan.userId !== userId) {
      throw new Error('Loan not found or unauthorized');
    }

    if (currentLoan.status === 'ARCHIVED') {
      throw new Error('Cannot update an archived loan');
    }

    const updateData: any = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.lender !== undefined) updateData.lender = parsed.lender;
    if (parsed.loanType !== undefined) updateData.loanType = parsed.loanType;
    if (parsed.interestRateType !== undefined) updateData.interestRateType = parsed.interestRateType;
    if (parsed.tenureMonths !== undefined) updateData.tenureMonths = parsed.tenureMonths;
    if (parsed.paymentAccountId !== undefined) updateData.paymentAccountId = parsed.paymentAccountId;
    if (parsed.productName !== undefined) updateData.productName = parsed.productName;
    if (parsed.merchant !== undefined) updateData.merchant = parsed.merchant;
    if (parsed.notes !== undefined) updateData.notes = parsed.notes;

    if (parsed.interestRatePercent !== undefined) {
      updateData.interestRatePercent = parsed.interestRatePercent !== null
        ? new Decimal(parsed.interestRatePercent.toString())
        : null;
    }

    let effectiveEmiAmount = currentLoan.emiAmount;
    let emiAmountProvided = false;
    if (parsed.emiAmount !== undefined) {
      emiAmountProvided = true;
      effectiveEmiAmount = parsed.emiAmount !== null
        ? parseAndValidateAmount(parsed.emiAmount.toString())
        : null;
      updateData.emiAmount = effectiveEmiAmount;
    }

    const emiAmountActuallyChanged = emiAmountProvided && (
      (effectiveEmiAmount === null && currentLoan.emiAmount !== null) ||
      (effectiveEmiAmount !== null && currentLoan.emiAmount === null) ||
      (effectiveEmiAmount !== null && currentLoan.emiAmount !== null && !effectiveEmiAmount.equals(currentLoan.emiAmount))
    );

    const dueDayProvided = parsed.dueDay !== undefined;
    const dueDayChanged = dueDayProvided && parsed.dueDay !== currentLoan.dueDay;
    let effectiveDueDay = currentLoan.dueDay;
    if (dueDayProvided) {
      effectiveDueDay = parsed.dueDay;
      updateData.dueDay = effectiveDueDay;
    }

    let effectiveNextDue: Date | null = currentLoan.nextEmiDate;

    // Ticket R001-P1-02 & R001-P1-03: Single deterministic precedence order for nextEmiDate
    if (parsed.nextEmiDate === null) {
      // 1) If parsed.nextEmiDate === null: explicitly cleared/suspended
      effectiveNextDue = null;
      updateData.nextEmiDate = null;
    } else if (
      parsed.nextEmiDate !== undefined &&
      (!currentLoan.nextEmiDate || !isSameCalendarDate(parseCalendarDateOrIso(parsed.nextEmiDate, userTimezone)!, currentLoan.nextEmiDate, userTimezone))
    ) {
      // 2) Else if parsed.nextEmiDate !== undefined AND (either !currentLoan.nextEmiDate or !isSameCalendarDate(...)):
      // Explicit new date submitted takes precedence over automatic calculation
      effectiveNextDue = parseCalendarDateOrIso(parsed.nextEmiDate, userTimezone);
      updateData.nextEmiDate = effectiveNextDue;
    } else if (dueDayChanged && typeof parsed.dueDay === 'number') {
      // 3) Else if dueDayChanged && typeof parsed.dueDay === 'number':
      // Calculate candidate from changed dueDay
      const targetDay = parsed.dueDay;
      const now = new Date();
      const nowInTz = new TZDate(now, userTimezone);
      const year = nowInTz.getFullYear();
      const month = nowInTz.getMonth();
      const clampedDay = clampDayToMonth(year, month, targetDay);
      let candidate = new TZDate(year, month, clampedDay, 12, 0, 0, 0, userTimezone);
      if (candidate.getTime() <= now.getTime()) {
        let nextMonth = month + 1;
        let nextYear = year;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
        const nextClamped = clampDayToMonth(nextYear, nextMonth, targetDay);
        candidate = new TZDate(nextYear, nextMonth, nextClamped, 12, 0, 0, 0, userTimezone);
      }
      effectiveNextDue = new Date(candidate.getTime());
      updateData.nextEmiDate = effectiveNextDue;
    } else if (parsed.nextEmiDate !== undefined) {
      // 4) Else if parsed.nextEmiDate !== undefined:
      // Keep provided/existing date
      if (currentLoan.nextEmiDate) {
        effectiveNextDue = currentLoan.nextEmiDate;
      } else {
        effectiveNextDue = parseCalendarDateOrIso(parsed.nextEmiDate, userTimezone);
        updateData.nextEmiDate = effectiveNextDue;
      }
    }

    // Finding 1: Compare calendar dates in user's timezone rather than raw UTC timestamps
    // so time-of-day normalization doesn't falsely mark schedule as changed.
    let nextDueActuallyChanged = false;
    if (effectiveNextDue === null && currentLoan.nextEmiDate !== null) {
      nextDueActuallyChanged = true;
    } else if (effectiveNextDue !== null && currentLoan.nextEmiDate === null) {
      nextDueActuallyChanged = true;
    } else if (effectiveNextDue !== null && currentLoan.nextEmiDate !== null) {
      if (!isSameCalendarDate(effectiveNextDue, currentLoan.nextEmiDate, userTimezone)) {
        nextDueActuallyChanged = true;
      } else {
        // Same calendar date in user's timezone: preserve current exact timestamp
        effectiveNextDue = currentLoan.nextEmiDate;
        if (updateData.nextEmiDate !== undefined) {
          updateData.nextEmiDate = currentLoan.nextEmiDate;
        }
      }
    }
    const scheduleActuallyChanged = nextDueActuallyChanged || dueDayChanged;

    const effectiveName = parsed.name || currentLoan.name;
    const effectiveLender = parsed.lender || currentLoan.lender;
    const effectiveAccountId = parsed.paymentAccountId !== undefined ? parsed.paymentAccountId : currentLoan.paymentAccountId;

    let linkedObligationId = currentLoan.obligationId;
    let existingOb = null;
    if (linkedObligationId) {
      existingOb = await tx.obligation.findUnique({
        where: { id: linkedObligationId }
      });
    }

    // Schedule clearing: If nextEmiDate is cleared (null) or emiAmount is cleared,
    // atomically deactivate linked obligation (isActive: false) and cancel pending deliveries, even if dueDay is retained
    const isScheduleCleared =
      !effectiveEmiAmount ||
      effectiveEmiAmount.isZero() ||
      effectiveNextDue === null;

    const isLoanClosed = currentLoan.status === 'CLOSED';

    if (existingOb) {
      if (isLoanClosed) {
        // Closed loan edit must NEVER reactivate obligation or schedule stale deliveries
        await tx.obligation.update({
          where: { id: existingOb.id },
          data: {
            isActive: false,
            isArchived: true,
            ...(parsed.name || parsed.lender ? { title: `EMI: ${effectiveName} (${effectiveLender})` } : {}),
            ...(parsed.paymentAccountId !== undefined ? { accountId: effectiveAccountId || null } : {}),
          }
        });
        await tx.reminderDelivery.deleteMany({
          where: {
            obligationId: existingOb.id,
            status: { in: ['PENDING', 'SNOOZED'] }
          }
        });
        const loanReminders = await tx.reminder.findMany({
          where: {
            userId,
            OR: [
              { domain: 'FINANCE', type: 'LOAN_EMI', category: loanId },
              { obligationId: existingOb.id }
            ]
          }
        });
        for (const rem of loanReminders) {
          await tx.reminder.update({
            where: { id: rem.id },
            data: { isActive: false }
          });
          await tx.reminderDelivery.deleteMany({
            where: { reminderId: rem.id, status: { in: ['PENDING', 'SNOOZED'] } }
          });
        }
      } else if (isScheduleCleared) {
        await tx.obligation.update({
          where: { id: existingOb.id },
          data: { isActive: false }
        });
        await tx.reminderDelivery.deleteMany({
          where: {
            obligationId: existingOb.id,
            status: { in: ['PENDING', 'SNOOZED'] }
          }
        });
        const loanReminders = await tx.reminder.findMany({
          where: {
            userId,
            OR: [
              { domain: 'FINANCE', type: 'LOAN_EMI', category: loanId },
              { obligationId: existingOb.id }
            ]
          }
        });
        for (const rem of loanReminders) {
          await tx.reminder.update({
            where: { id: rem.id },
            data: { isActive: false }
          });
          await tx.reminderDelivery.deleteMany({
            where: { reminderId: rem.id, status: { in: ['PENDING', 'SNOOZED'] } }
          });
        }
      } else {
        const wasScheduleClearedOnLoan = !currentLoan.emiAmount || currentLoan.emiAmount.isZero() || currentLoan.nextEmiDate === null;
        const isScheduleRestored = wasScheduleClearedOnLoan && !isScheduleCleared;

        const obUpdate: any = {
          // If schedule was previously cleared and is now restored, or schedule date changed, activate;
          // if schedule values are unchanged (metadata-only edit), preserve existing obligation isActive (paused) state
          isActive: (isScheduleRestored || scheduleActuallyChanged) ? true : existingOb.isActive,
          isArchived: false,
        };
        if (emiAmountActuallyChanged && effectiveEmiAmount) {
          obUpdate.amount = effectiveEmiAmount;
        }
        if (scheduleActuallyChanged && effectiveNextDue) {
          obUpdate.dueAt = effectiveNextDue;
          obUpdate.nextDueAt = effectiveNextDue;
        }
        if (parsed.name || parsed.lender) {
          obUpdate.title = `EMI: ${effectiveName} (${effectiveLender})`;
        }
        if (parsed.paymentAccountId !== undefined) {
          obUpdate.accountId = effectiveAccountId || null;
        }

        await tx.obligation.update({
          where: { id: existingOb.id },
          data: obUpdate,
        });

        // Only purge deliveries if schedule actually changed; do not purge SNOOZED reminder claims on metadata-only edits
        if (scheduleActuallyChanged) {
          await tx.reminderDelivery.deleteMany({
            where: {
              obligationId: existingOb.id,
              status: { in: ['PENDING', 'SNOOZED'] }
            }
          });
        }
      }
    } else {
      const isCreationOptOut = Boolean(currentLoan.notes && currentLoan.notes.includes('[noLinkedObligation]'));
      const shouldCreateObligation = parsed.createLinkedObligation === true
        || (parsed.createLinkedObligation !== false && !isCreationOptOut && (scheduleActuallyChanged || emiAmountActuallyChanged));

      if (shouldCreateObligation && !isScheduleCleared && !isLoanClosed && effectiveEmiAmount && effectiveNextDue && currentLoan.status === 'ACTIVE') {
        const createdOb = await tx.obligation.create({
          data: {
            userId,
            title: `EMI: ${effectiveName} (${effectiveLender})`,
            kind: 'EMI',
            amount: effectiveEmiAmount,
            accountId: effectiveAccountId || null,
            dueAt: effectiveNextDue,
            recurrenceType: 'MONTHLY',
            recurrenceInterval: 1,
            reminderOffsetsMin: [2880, 1440, 0],
            isActive: true,
            nextDueAt: effectiveNextDue,
            notes: `Linked to loan ${effectiveName}`,
          }
        });
        updateData.obligationId = createdOb.id;
        if (parsed.createLinkedObligation === true && isCreationOptOut) {
          updateData.notes = (updateData.notes || currentLoan.notes || '').replace('[noLinkedObligation]', '').trim() || null;
        }
      }
    }

    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: updateData,
    });

    return updatedLoan;
  };

  const updatedLoan = typeof db.$transaction === 'function'
    ? await db.$transaction(executeInTransaction)
    : await executeInTransaction(db);

  return {
    success: true,
    loan: {
      id: updatedLoan.id,
      name: updatedLoan.name,
      loanType: updatedLoan.loanType,
      lender: updatedLoan.lender,
      outstandingPrincipal: updatedLoan.outstandingPrincipal.toString(),
      emiAmount: updatedLoan.emiAmount ? updatedLoan.emiAmount.toString() : null,
      dueDay: updatedLoan.dueDay,
      nextEmiDate: updatedLoan.nextEmiDate ? updatedLoan.nextEmiDate.toISOString() : null,
      status: updatedLoan.status,
      obligationId: updatedLoan.obligationId,
    }
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
    select: { id: true, userId: true, obligationId: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  const executeInTransaction = async (tx: any) => {
    // Finding 3: Re-read and lock loan inside tx to avoid missing concurrently linked obligations
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
    }

    const currentLoan = await tx.loan.findUnique({
      where: { id: loanId },
      select: { id: true, userId: true, obligationId: true }
    });

    if (!currentLoan || currentLoan.userId !== userId) {
      throw new Error('Loan not found or unauthorized');
    }

    await tx.loan.update({
      where: { id: loanId },
      data: { status: 'CLOSED' }
    });

    await cleanupLoanRemindersAndObligation(tx, userId, loanId, currentLoan.obligationId);
  };

  if (typeof db.$transaction === 'function') {
    await db.$transaction(executeInTransaction);
  } else {
    await executeInTransaction(db);
  }

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
    select: { id: true, userId: true, obligationId: true }
  });

  if (!loan || loan.userId !== userId) {
    throw new Error('Loan not found or unauthorized');
  }

  const executeInTransaction = async (tx: any) => {
    // Finding 3: Re-read and lock loan inside tx to avoid missing concurrently linked obligations
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
    }

    const currentLoan = await tx.loan.findUnique({
      where: { id: loanId },
      select: { id: true, userId: true, obligationId: true }
    });

    if (!currentLoan || currentLoan.userId !== userId) {
      throw new Error('Loan not found or unauthorized');
    }

    await tx.loan.update({
      where: { id: loanId },
      data: { status: 'ARCHIVED' }
    });

    await cleanupLoanRemindersAndObligation(tx, userId, loanId, currentLoan.obligationId);
  };

  if (typeof db.$transaction === 'function') {
    await db.$transaction(executeInTransaction);
  } else {
    await executeInTransaction(db);
  }

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
  const loanId = loan.id;

  const executeInTransaction = async (tx: any) => {
    // Row lock loan inside tx to serialize concurrent updates
    if (typeof tx.$queryRaw === 'function') {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
    }

    const currentLoan = await tx.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        userId: true,
        status: true,
        outstandingPrincipal: true,
        obligationId: true,
        nextEmiDate: true,
      }
    });

    if (!currentLoan || currentLoan.userId !== userId) {
      throw new Error('Loan not found or unauthorized');
    }

    const currentPayment = await tx.loanPayment.findUnique({
      where: { id: payment.id }
    });

    if (!currentPayment) {
      return {
        alreadyReversed: true,
        paymentId: payment.id,
        restoredOutstanding: currentLoan.outstandingPrincipal,
        restoredNextEmiDate: currentLoan.nextEmiDate,
        restoredStatus: currentLoan.status,
      };
    }

    // 1. Delete linked FinancialTransaction if one was created
    if (currentPayment.transactionId) {
      await tx.financialTransaction.delete({
        where: { id: currentPayment.transactionId }
      });
    }

    // 2. Delete the LoanPayment
    await tx.loanPayment.delete({
      where: { id: currentPayment.id }
    });

    // 3. Add back principalPaid to outstandingPrincipal if principalPaid was recorded (SOL-R002-002)
    let principalToRestore: Decimal | null = currentPayment.principalPaid;
    if (currentPayment.note) {
      const match = currentPayment.note.match(/\[actualPrincipalReduction:([^\]]+)\]/);
      if (match && match[1]) {
        try {
          principalToRestore = new Decimal(match[1]);
        } catch {}
      }
    }

    let restoredOutstanding = currentLoan.outstandingPrincipal;
    if (principalToRestore && principalToRestore.greaterThan(0)) {
      restoredOutstanding = currentLoan.outstandingPrincipal.plus(principalToRestore);
    }

    // 4. Restore nextEmiDate (SOL-R002-006)
    let scheduledDateFromPayment: Date | null = null;
    if (currentPayment.note) {
      const match = currentPayment.note.match(/\[scheduledDate:([^\]]+)\]/);
      if (match && match[1]) {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          scheduledDateFromPayment = parsedDate;
        }
      }
    }

    if (!scheduledDateFromPayment && currentPayment.obligationOccurrenceId) {
      const occ = await tx.obligationOccurrence.findUnique({
        where: { id: currentPayment.obligationOccurrenceId },
        select: { dueAt: true }
      });
      if (occ?.dueAt) {
        scheduledDateFromPayment = occ.dueAt;
      }
    }

    const restoredNextEmiDate = input.revertToDate
      ? new Date(input.revertToDate)
      : (scheduledDateFromPayment || currentPayment.occurredAt);

    const restoredStatus = currentLoan.status === 'CLOSED' ? 'ACTIVE' : currentLoan.status;

    await tx.loan.update({
      where: { id: currentLoan.id },
      data: {
        outstandingPrincipal: restoredOutstanding,
        nextEmiDate: restoredNextEmiDate,
        status: restoredStatus,
      }
    });

    if (currentLoan.obligationId) {
      await tx.obligation.update({
        where: { id: currentLoan.obligationId },
        data: {
          nextDueAt: restoredNextEmiDate,
          isActive: true,
          isArchived: false,
        }
      });
    }

    return {
      alreadyReversed: false,
      paymentId: currentPayment.id,
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
    alreadyReversed: Boolean(result.alreadyReversed),
    revertedPaymentId: result.paymentId,
    restoredOutstanding: result.restoredOutstanding.toString(),
    restoredNextEmiDate: result.restoredNextEmiDate ? result.restoredNextEmiDate.toISOString() : null,
    restoredStatus: result.restoredStatus,
  };
}
