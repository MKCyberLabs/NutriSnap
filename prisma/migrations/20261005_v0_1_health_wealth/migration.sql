-- NutriSnap v0.1: Health + Wealth Schema Migration
-- Preserves existing MealLog, FoodItem, HydrationSetting, HydrationLog, User, Session data.
-- Generalizes Reminder to support HEALTH and FINANCE domains.
-- Backfills existing meal reminders into generic fields.
-- Introduces FinancialAccount, FinancialTransaction, Obligation, ObligationOccurrence, ReminderDelivery.

-- 1. Generalize Reminder table
ALTER TABLE "Reminder" DROP CONSTRAINT IF EXISTS "Reminder_userId_category_key";
DROP INDEX IF EXISTS "Reminder_userId_category_key";

ALTER TABLE "Reminder"
  ADD COLUMN IF NOT EXISTS "activeDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "domain" TEXT NOT NULL DEFAULT 'HEALTH',
  ADD COLUMN IF NOT EXISTS "mealCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "obligationId" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceInterval" INTEGER,
  ADD COLUMN IF NOT EXISTS "recurrenceType" TEXT,
  ADD COLUMN IF NOT EXISTS "reminderOffsetsMin" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastTriggeredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "timeOfDay" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'MEAL';

ALTER TABLE "Reminder" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "Reminder" ALTER COLUMN "time" DROP NOT NULL;

-- 2. Backfill existing meal reminders
UPDATE "Reminder"
SET
  "title" = COALESCE("category", 'Meal'),
  "mealCategory" = "category",
  "timeOfDay" = "time",
  "recurrenceType" = 'DAILY',
  "recurrenceInterval" = 1,
  "reminderOffsetsMin" = ARRAY[0]::INTEGER[]
WHERE "domain" = 'HEALTH' AND ("title" = '' OR "title" IS NULL);

-- 3. Create FinancialAccount
CREATE TABLE IF NOT EXISTS "FinancialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "institution" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- 4. Create Obligation
CREATE TABLE IF NOT EXISTS "Obligation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "accountId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "recurrenceType" TEXT NOT NULL,
    "recurrenceInterval" INTEGER,
    "reminderOffsetsMin" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastCompletedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id")
);

-- 5. Create FinancialTransaction
CREATE TABLE IF NOT EXISTS "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "transferAccountId" TEXT,
    "obligationId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- 6. Create ObligationOccurrence
CREATE TABLE IF NOT EXISTS "ObligationOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObligationOccurrence_pkey" PRIMARY KEY ("id")
);

-- 7. Create ReminderDelivery
CREATE TABLE IF NOT EXISTS "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "obligationId" TEXT,
    "occurrenceKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'TELEGRAM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "telegramMessageId" INTEGER,
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReminderDelivery"
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);

-- 8. Create Session table
CREATE TABLE IF NOT EXISTS "Session" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "FinancialAccount_userId_isActive_idx" ON "FinancialAccount"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "FinancialAccount_userId_type_idx" ON "FinancialAccount"("userId", "type");
CREATE INDEX IF NOT EXISTS "FinancialTransaction_userId_occurredAt_idx" ON "FinancialTransaction"("userId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "FinancialTransaction_accountId_idx" ON "FinancialTransaction"("accountId");
CREATE INDEX IF NOT EXISTS "FinancialTransaction_transferAccountId_idx" ON "FinancialTransaction"("transferAccountId");
CREATE INDEX IF NOT EXISTS "FinancialTransaction_obligationId_idx" ON "FinancialTransaction"("obligationId");
CREATE INDEX IF NOT EXISTS "Obligation_userId_isActive_idx" ON "Obligation"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "Obligation_userId_nextDueAt_idx" ON "Obligation"("userId", "nextDueAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ObligationOccurrence_transactionId_key" ON "ObligationOccurrence"("transactionId");
CREATE INDEX IF NOT EXISTS "ObligationOccurrence_userId_idx" ON "ObligationOccurrence"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ObligationOccurrence_obligationId_occurrenceKey_key" ON "ObligationOccurrence"("obligationId", "occurrenceKey");
CREATE INDEX IF NOT EXISTS "ReminderDelivery_userId_status_idx" ON "ReminderDelivery"("userId", "status");
CREATE INDEX IF NOT EXISTS "ReminderDelivery_scheduledFor_idx" ON "ReminderDelivery"("scheduledFor");
CREATE INDEX IF NOT EXISTS "ReminderDelivery_obligationId_idx" ON "ReminderDelivery"("obligationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderDelivery_reminderId_occurrenceKey_offsetMinutes_cha_key" ON "ReminderDelivery"("reminderId", "occurrenceKey", "offsetMinutes", "channel");
CREATE INDEX IF NOT EXISTS "Reminder_userId_isActive_idx" ON "Reminder"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "Reminder_userId_domain_idx" ON "Reminder"("userId", "domain");
CREATE INDEX IF NOT EXISTS "Reminder_obligationId_idx" ON "Reminder"("obligationId");

-- Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reminder_obligationId_fkey') THEN
    ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialAccount_userId_fkey') THEN
    ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialTransaction_userId_fkey') THEN
    ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialTransaction_accountId_fkey') THEN
    ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialTransaction_transferAccountId_fkey') THEN
    ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialTransaction_obligationId_fkey') THEN
    ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Obligation_userId_fkey') THEN
    ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Obligation_accountId_fkey') THEN
    ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ObligationOccurrence_userId_fkey') THEN
    ALTER TABLE "ObligationOccurrence" ADD CONSTRAINT "ObligationOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ObligationOccurrence_obligationId_fkey') THEN
    ALTER TABLE "ObligationOccurrence" ADD CONSTRAINT "ObligationOccurrence_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ObligationOccurrence_transactionId_fkey') THEN
    ALTER TABLE "ObligationOccurrence" ADD CONSTRAINT "ObligationOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReminderDelivery_userId_fkey') THEN
    ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReminderDelivery_reminderId_fkey') THEN
    ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReminderDelivery_obligationId_fkey') THEN
    ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
