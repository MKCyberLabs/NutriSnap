-- NutriSnap v0.2: Payment Lifecycle, Reminder Management, and Credit Card Tracking
-- Additive-first: preserves all existing v0.1 and v0.2 tables and data.
-- Adds statementDay, paymentDueDay, defaultPaymentAccountId to FinancialAccount.
-- Adds CreditCardStatement, CreditCardPayment.

-- AlterTable FinancialAccount
ALTER TABLE "FinancialAccount" ADD COLUMN IF NOT EXISTS "statementDay" INTEGER;
ALTER TABLE "FinancialAccount" ADD COLUMN IF NOT EXISTS "paymentDueDay" INTEGER;
ALTER TABLE "FinancialAccount" ADD COLUMN IF NOT EXISTS "defaultPaymentAccountId" TEXT;

-- AddForeignKey for defaultPaymentAccountId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FinancialAccount_defaultPaymentAccountId_fkey'
    ) THEN
        ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_defaultPaymentAccountId_fkey"
        FOREIGN KEY ("defaultPaymentAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable CreditCardStatement
CREATE TABLE IF NOT EXISTS "CreditCardStatement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "statementAmount" DECIMAL(14,2) NOT NULL,
    "minimumDue" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "obligationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable CreditCardPayment
CREATE TABLE IF NOT EXISTS "CreditCardPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardPayment_pkey" PRIMARY KEY ("id")
);

-- Unique and Indexes for CreditCardStatement
CREATE UNIQUE INDEX IF NOT EXISTS "CreditCardStatement_accountId_periodKey_key" ON "CreditCardStatement"("accountId", "periodKey");
CREATE INDEX IF NOT EXISTS "CreditCardStatement_userId_status_idx" ON "CreditCardStatement"("userId", "status");
CREATE INDEX IF NOT EXISTS "CreditCardStatement_userId_dueDate_idx" ON "CreditCardStatement"("userId", "dueDate");
CREATE INDEX IF NOT EXISTS "CreditCardStatement_obligationId_idx" ON "CreditCardStatement"("obligationId");

-- Unique and Indexes for CreditCardPayment
CREATE UNIQUE INDEX IF NOT EXISTS "CreditCardPayment_transactionId_key" ON "CreditCardPayment"("transactionId");
CREATE INDEX IF NOT EXISTS "CreditCardPayment_userId_paidAt_idx" ON "CreditCardPayment"("userId", "paidAt" DESC);
CREATE INDEX IF NOT EXISTS "CreditCardPayment_statementId_idx" ON "CreditCardPayment"("statementId");

-- Foreign Keys for CreditCardStatement
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardStatement_userId_fkey'
    ) THEN
        ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardStatement_accountId_fkey'
    ) THEN
        ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardStatement_obligationId_fkey'
    ) THEN
        ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_obligationId_fkey"
        FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Foreign Keys for CreditCardPayment
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardPayment_userId_fkey'
    ) THEN
        ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardPayment_statementId_fkey'
    ) THEN
        ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_statementId_fkey"
        FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardPayment_fromAccountId_fkey'
    ) THEN
        ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_fromAccountId_fkey"
        FOREIGN KEY ("fromAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardPayment_transactionId_fkey'
    ) THEN
        ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_transactionId_fkey"
        FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
