-- NutriSnap v0.2: Money Life Schema Migration
-- Additive-first: preserves all existing v0.1 tables and data.
-- Adds PersonalDebt, Loan, LoanPayment, WishlistItem.
-- Extends FinancialTransaction with personalDebtId foreign key.

-- AlterTable
ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "personalDebtId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PersonalDebt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "title" TEXT,
    "originalAmount" DECIMAL(14,2) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "reminderOffsetsMin" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Loan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loanType" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "originalPrincipal" DECIMAL(14,2),
    "openingOutstanding" DECIMAL(14,2) NOT NULL,
    "outstandingPrincipal" DECIMAL(14,2) NOT NULL,
    "trackedFromAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emiAmount" DECIMAL(14,2),
    "emiGeneratesExpense" BOOLEAN NOT NULL DEFAULT true,
    "principalAlreadyRecognized" BOOLEAN NOT NULL DEFAULT false,
    "interestRatePercent" DECIMAL(5,2),
    "interestRateType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "tenureMonths" INTEGER,
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "nextEmiDate" TIMESTAMP(3),
    "dueDay" INTEGER,
    "paymentAccountId" TEXT,
    "productName" TEXT,
    "merchant" TEXT,
    "obligationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoanPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "principalPaid" DECIMAL(14,2),
    "interestPaid" DECIMAL(14,2),
    "feesPaid" DECIMAL(14,2),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "obligationOccurrenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetPrice" DECIMAL(14,2) NOT NULL,
    "maxBudget" DECIMAL(14,2),
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "targetDate" TIMESTAMP(3),
    "plannedAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WISHLIST',
    "notes" TEXT,
    "actualPrice" DECIMAL(14,2),
    "purchasedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonalDebt_userId_status_idx" ON "PersonalDebt"("userId", "status");
CREATE INDEX IF NOT EXISTS "PersonalDebt_userId_dueAt_idx" ON "PersonalDebt"("userId", "dueAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Loan_obligationId_key" ON "Loan"("obligationId");
CREATE INDEX IF NOT EXISTS "Loan_userId_status_idx" ON "Loan"("userId", "status");
CREATE INDEX IF NOT EXISTS "Loan_userId_nextEmiDate_idx" ON "Loan"("userId", "nextEmiDate");

CREATE UNIQUE INDEX IF NOT EXISTS "LoanPayment_transactionId_key" ON "LoanPayment"("transactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "LoanPayment_obligationOccurrenceId_key" ON "LoanPayment"("obligationOccurrenceId");
CREATE INDEX IF NOT EXISTS "LoanPayment_userId_occurredAt_idx" ON "LoanPayment"("userId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "LoanPayment_loanId_occurredAt_idx" ON "LoanPayment"("loanId", "occurredAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_transactionId_key" ON "WishlistItem"("transactionId");
CREATE INDEX IF NOT EXISTS "WishlistItem_userId_status_idx" ON "WishlistItem"("userId", "status");
CREATE INDEX IF NOT EXISTS "WishlistItem_userId_priority_idx" ON "WishlistItem"("userId", "priority");
CREATE INDEX IF NOT EXISTS "WishlistItem_userId_targetDate_idx" ON "WishlistItem"("userId", "targetDate");

CREATE INDEX IF NOT EXISTS "FinancialTransaction_personalDebtId_idx" ON "FinancialTransaction"("personalDebtId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialTransaction_personalDebtId_fkey') THEN
    ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_personalDebtId_fkey" FOREIGN KEY ("personalDebtId") REFERENCES "PersonalDebt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonalDebt_userId_fkey') THEN
    ALTER TABLE "PersonalDebt" ADD CONSTRAINT "PersonalDebt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_userId_fkey') THEN
    ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_paymentAccountId_fkey') THEN
    ALTER TABLE "Loan" ADD CONSTRAINT "Loan_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Loan_obligationId_fkey') THEN
    ALTER TABLE "Loan" ADD CONSTRAINT "Loan_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanPayment_userId_fkey') THEN
    ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanPayment_loanId_fkey') THEN
    ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanPayment_accountId_fkey') THEN
    ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanPayment_transactionId_fkey') THEN
    ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanPayment_obligationOccurrenceId_fkey') THEN
    ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_obligationOccurrenceId_fkey" FOREIGN KEY ("obligationOccurrenceId") REFERENCES "ObligationOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WishlistItem_userId_fkey') THEN
    ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WishlistItem_plannedAccountId_fkey') THEN
    ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_plannedAccountId_fkey" FOREIGN KEY ("plannedAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WishlistItem_transactionId_fkey') THEN
    ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
