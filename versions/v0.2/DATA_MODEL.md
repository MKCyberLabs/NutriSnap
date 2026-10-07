# v0.2 Proposed Data Model

Exact Prisma names may be refined during Architecture Gate A, but behavior must remain equivalent.

## FinancialTransaction additions

Add optional relation and foreign key links:

```text
personalDebtId String?         // Scalar FK -> PersonalDebt.id (Many-to-One)
personalDebt   PersonalDebt?   // Relation to PersonalDebt

loanPayment    LoanPayment?    // Relation only (One-to-One back-reference; NO scalar loanPaymentId)
wishlistItem   WishlistItem?   // Relation only (One-to-One back-reference; NO scalar wishlistItemId)
```

### Foreign Key Ownership Rule
- **1-to-1 relations (`LoanPayment` ↔ `FinancialTransaction`, `WishlistItem` ↔ `FinancialTransaction`)**:
  - The child/domain records (`LoanPayment` and `WishlistItem`) hold the authoritative scalar foreign key (`transactionId String? @unique`).
  - `FinancialTransaction` does **NOT** define duplicate scalar fields (`loanPaymentId` or `wishlistItemId`). It defines only the Prisma relation back-reference (`loanPayment LoanPayment?` and `wishlistItem WishlistItem?`).
  - This prevents bidirectional scalar foreign-key synchronization anomalies in Prisma.
- **1-to-many relation (`PersonalDebt` ↔ `FinancialTransaction`)**:
  - `FinancialTransaction` holds the scalar foreign key `personalDebtId String?` pointing to `PersonalDebt.id`, because a debt has multiple transactions over its lifecycle (`LEND`, `DEBT_COLLECT`, `BORROW`, `DEBT_REPAY`).

Expand valid transaction types:

```text
INCOME
EXPENSE
TRANSFER
LEND
BORROW
DEBT_COLLECT
DEBT_REPAY
```

Historical types remain valid.

## PersonalDebt

```text
id
userId
direction            RECEIVABLE | PAYABLE
counterpartyName
title                optional
originalAmount       Decimal(14,2)
startedAt
dueAt                nullable
reminderOffsetsMin   Int[]
status               OPEN | SETTLED | ARCHIVED
notes                nullable
createdAt
updatedAt
```

Relations:
- user;
- linked FinancialTransaction[].

### Outstanding calculation

For RECEIVABLE:
```text
sum(LEND) - sum(DEBT_COLLECT)
```

For PAYABLE:
```text
sum(BORROW) - sum(DEBT_REPAY)
```

The creation service creates the first LEND/BORROW transaction atomically if an account is selected.

Outstanding must never be negative.

A debt becomes SETTLED when outstanding reaches 0, but owner can reopen only through a deliberate new/additional movement.

## Loan

```text
id
userId
name
loanType
lender
originalPrincipal           Decimal?
openingOutstanding          Decimal
outstandingPrincipal        Decimal
trackedFromAt               DateTime
emiAmount                   Decimal?
emiGeneratesExpense         Boolean @default(true)
principalAlreadyRecognized  Boolean @default(false)
interestRatePercent         Decimal?
interestRateType            FIXED | FLOATING | UNKNOWN
tenureMonths                Int?
startDate                   DateTime?
expectedEndDate             DateTime?
nextEmiDate                 DateTime?
dueDay                      Int?
paymentAccountId            String?
productName                 String?
merchant                    String?
obligationId                String? unique
status                      ACTIVE | CLOSED | ARCHIVED
notes                       String?
createdAt
updatedAt
```

Loan types:
```text
PERSONAL
HOME
VEHICLE
EDUCATION
GOLD
PRODUCT_EMI
CREDIT_CARD_EMI
OTHER
```

Relations:
- `user`: `User @relation(fields: [userId], references: [id])`
- `paymentAccount`: `FinancialAccount? @relation(fields: [paymentAccountId], references: [id])`
- `obligation`: `Obligation? @relation(fields: [obligationId], references: [id])` (One-to-One, scalar FK `obligationId` on `Loan`)
- `payments`: `LoanPayment[]`

Constraints & Accounting Rules:
- Money uses Decimal(14,2);
- `outstandingPrincipal >= 0`, `openingOutstanding >= 0`;
- `emiAmount > 0` when present;
- `dueDay` 1..31;
- Product EMI may use `productName`/`merchant`;
- **Credit Card EMI Double-Counting Policy (V2-Q001)**:
  - **Snapshot Running EMI** (`emiGeneratesExpense = true`, `principalAlreadyRecognized = false`): For an already-running Credit Card EMI entered as an as-of snapshot, do not reconstruct or log the historical purchase expense. Future EMI payments create linked `EXPENSE` transactions.
  - **Converted Purchase EMI** (`emiGeneratesExpense = false`, `principalAlreadyRecognized = true`): When a user converts a new credit card purchase to EMI whose full purchase amount was already logged as an `EXPENSE` in NutriSnap, `emiGeneratesExpense` is set to `false`. Subsequent `LoanPayment` records do NOT create duplicate `EXPENSE` records. The cash outflow is recognized through credit card bill payment (`TRANSFER`), preventing double-counting.

## LoanPayment

```text
id
userId
loanId
amount                 Decimal(14,2)
principalPaid          Decimal(14,2)?
interestPaid           Decimal(14,2)?
feesPaid               Decimal(14,2)?
occurredAt             DateTime
accountId              String
transactionId          String? unique
obligationOccurrenceId String? unique
note                   String?
createdAt
updatedAt
```

Relations:
- `user`: `User @relation(fields: [userId], references: [id])`
- `loan`: `Loan @relation(fields: [loanId], references: [id], onDelete: Cascade)`
- `account`: `FinancialAccount @relation(fields: [accountId], references: [id])`
- `transaction`: `FinancialTransaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)` (Authoritative scalar FK owner; 1-to-1)
- `obligationOccurrence`: `ObligationOccurrence? @relation(fields: [obligationOccurrenceId], references: [id], onDelete: SetNull)` (Authoritative scalar FK owner; 1-to-1)

Rules:
- Component validation: `(principalPaid ?? 0) + (interestPaid ?? 0) + (feesPaid ?? 0) <= amount`;
- **Principal Reduction Rule (V2-Q003)**:
  - Decrements `Loan.outstandingPrincipal` transactionally ONLY when `principalPaid` is non-null and > 0;
  - Never infer or calculate principal reduction from `amount` alone when `principalPaid` is omitted;
- **Obligation Delegation & Idempotency**:
  - When linked to an `Obligation`, generic `markObligationPaid(occurrenceId)` MUST delegate directly to `LoanService.recordEmiPayment()`;
  - If a `LoanPayment` already exists for this `obligationOccurrenceId`, repeated calls return the existing record and do not create duplicate payments, duplicate transactions, or duplicate principal reductions;
- **Expense Creation**:
  - Creates and links exactly one `FinancialTransaction` (`EXPENSE`, category `EMI`) if and only if `loan.emiGeneratesExpense == true`;
  - If `loan.emiGeneratesExpense == false`, records the `LoanPayment` without creating an `EXPENSE` transaction.

## WishlistItem

```text
id
userId
name
category
targetPrice            Decimal(14,2)
maxBudget              Decimal(14,2)?
priority               LOW | MEDIUM | HIGH
targetDate             DateTime?
plannedAccountId       String?
status                 WISHLIST | PLANNED | READY | PURCHASED | ARCHIVED
notes                  String?
actualPrice            Decimal(14,2)?
purchasedAt            DateTime?
transactionId          String? unique
createdAt
updatedAt
```

Relations:
- `user`: `User @relation(fields: [userId], references: [id])`
- `plannedAccount`: `FinancialAccount? @relation(fields: [plannedAccountId], references: [id])`
- `transaction`: `FinancialTransaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)` (Authoritative scalar FK owner; 1-to-1)

Rules:
- `targetPrice > 0`;
- `maxBudget > 0` if supplied;
- Creating or editing wishlist items does NOT affect account balances or monthly totals;
- **Mark Purchased Flow**:
  - Sets `status = PURCHASED`, `actualPrice`, and `purchasedAt`;
  - Optionally creates and links exactly one `FinancialTransaction` (`EXPENSE`) with `actualPrice`;
  - Repeated Mark Purchased calls are idempotent;
- **Transaction Safety & Reversal**:
  - Transactions linked to a `WishlistItem` are domain-owned; generic transaction edit or delete MUST be blocked (`409 Conflict`);
  - Reversion or cancellation must use the Wishlist domain flow ("Unmark as Purchased" / "Revert Purchase"), which atomically deletes the linked transaction, restores account balances, and resets the item to `READY` or `PLANNED`.

## Existing model changes

### FinancialAccount
- `openingBalance Decimal(14,2)`:
  - **Edit Rule (V2-Q002)**: Editable ONLY when the account has zero posted transactions (`transactions.count == 0`).
  - Once any transaction has posted, `openingBalance` edits are rejected (`400 Bad Request`); balance discrepancies must be corrected via future explicit reconciliation.
- Add back-relations:
  ```prisma
  loans         Loan[]
  loanPayments  LoanPayment[]
  wishlistItems WishlistItem[]
  ```

### Obligation
- Add back-relation for linked Loan:
  ```prisma
  loan Loan? // 1-to-1 back-reference; Loan holds obligationId String? @unique
  ```
- Debt due reminders link generic `Reminder` without requiring an `Obligation` unless a recurring schedule is desired.

### ObligationOccurrence
- Add back-relation for linked LoanPayment:
  ```prisma
  loanPayment LoanPayment? // 1-to-1 back-reference; LoanPayment holds obligationOccurrenceId String? @unique
  ```

### User
Add:
```text
personalDebts
loans
loanPayments
wishlistItems
```

## Exact Prisma Relation Definitions

```prisma
model FinancialTransaction {
  // Existing fields retained...

  // v0.2 Additions:
  personalDebtId String?
  personalDebt   PersonalDebt? @relation(fields: [personalDebtId], references: [id], onDelete: SetNull)

  // 1-to-1 relation back-references (CHILD OWNS SCALAR FK; NO duplicate scalar IDs here):
  loanPayment    LoanPayment?
  wishlistItem   WishlistItem?

  @@index([personalDebtId])
}

model Loan {
  id                         String   @id @default(cuid())
  userId                     String
  name                       String
  loanType                   LoanType
  lender                     String
  originalPrincipal          Decimal? @db.Decimal(14, 2)
  openingOutstanding         Decimal  @db.Decimal(14, 2)
  outstandingPrincipal       Decimal  @db.Decimal(14, 2)
  trackedFromAt              DateTime
  emiAmount                  Decimal? @db.Decimal(14, 2)
  emiGeneratesExpense        Boolean  @default(true)
  principalAlreadyRecognized Boolean  @default(false)
  interestRatePercent        Decimal? @db.Decimal(5, 2)
  interestRateType           InterestRateType @default(UNKNOWN)
  tenureMonths               Int?
  startDate                  DateTime?
  expectedEndDate            DateTime?
  nextEmiDate                DateTime?
  dueDay                     Int?
  paymentAccountId           String?
  productName                String?
  merchant                   String?
  obligationId               String?  @unique
  status                     LoanStatus @default(ACTIVE)
  notes                      String?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  paymentAccount FinancialAccount? @relation(fields: [paymentAccountId], references: [id], onDelete: SetNull)
  obligation     Obligation?       @relation(fields: [obligationId], references: [id], onDelete: SetNull)
  payments       LoanPayment[]

  @@index([userId, status])
  @@index([userId, nextEmiDate])
}

model LoanPayment {
  id                     String    @id @default(cuid())
  userId                 String
  loanId                 String
  amount                 Decimal   @db.Decimal(14, 2)
  principalPaid          Decimal?  @db.Decimal(14, 2)
  interestPaid           Decimal?  @db.Decimal(14, 2)
  feesPaid               Decimal?  @db.Decimal(14, 2)
  occurredAt             DateTime
  accountId              String
  transactionId          String?   @unique
  obligationOccurrenceId String?   @unique
  note                   String?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  loan                 Loan                  @relation(fields: [loanId], references: [id], onDelete: Cascade)
  account              FinancialAccount      @relation(fields: [accountId], references: [id], onDelete: Restrict)
  transaction          FinancialTransaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  obligationOccurrence ObligationOccurrence? @relation(fields: [obligationOccurrenceId], references: [id], onDelete: SetNull)

  @@index([userId, occurredAt(sort: Desc)])
  @@index([loanId, occurredAt(sort: Desc)])
}

model WishlistItem {
  id               String         @id @default(cuid())
  userId           String
  name             String
  category         String
  targetPrice      Decimal        @db.Decimal(14, 2)
  maxBudget        Decimal?       @db.Decimal(14, 2)
  priority         Priority       @default(MEDIUM)
  targetDate       DateTime?
  plannedAccountId String?
  status           WishlistStatus @default(WISHLIST)
  notes            String?
  actualPrice      Decimal?       @db.Decimal(14, 2)
  purchasedAt      DateTime?
  transactionId    String?        @unique
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  user           User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  plannedAccount FinancialAccount?     @relation(fields: [plannedAccountId], references: [id], onDelete: SetNull)
  transaction    FinancialTransaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([userId, priority])
  @@index([userId, targetDate])
}
```

## Indexes

PersonalDebt:
- `[userId, status]`
- `[userId, dueAt]`

Loan:
- `[userId, status]`
- `[userId, nextEmiDate]`

LoanPayment:
- `[userId, occurredAt desc]`
- `[loanId, occurredAt desc]`

WishlistItem:
- `[userId, status]`
- `[userId, priority]`
- `[userId, targetDate]`

## Migration principle

All v0.2 changes should be additive first.

Do not rewrite old v0.1 financial rows.
