# v0.2 Proposed Data Model

Exact Prisma names may be refined during Architecture Gate A, but behavior must remain equivalent.

## FinancialTransaction additions

Add optional links:

```text
personalDebtId String?
loanPaymentId  String? / relation via LoanPayment.transactionId
wishlistItemId String?
```

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
originalPrincipal      Decimal? 
openingOutstanding     Decimal
outstandingPrincipal   Decimal
trackedFromAt
emiAmount              Decimal?
interestRatePercent    Decimal? 
interestRateType       FIXED | FLOATING | UNKNOWN
tenureMonths           Int?
startDate              DateTime?
expectedEndDate        DateTime?
nextEmiDate            DateTime?
dueDay                 Int?
paymentAccountId       String?
productName            String?
merchant               String?
obligationId           String? unique
status                 ACTIVE | CLOSED | ARCHIVED
notes                  String?
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

Constraints:
- money Decimal;
- outstanding >= 0;
- EMI > 0 when present;
- dueDay 1..31;
- Product EMI may use productName/merchant.

## LoanPayment

```text
id
userId
loanId
amount                 Decimal
principalPaid          Decimal?
interestPaid           Decimal?
feesPaid               Decimal?
occurredAt
accountId
transactionId          String? unique
obligationOccurrenceId String? unique
note                   String?
createdAt
updatedAt
```

Rules:
- component values cannot exceed payment amount in invalid combinations;
- when principalPaid supplied, decrement Loan.outstandingPrincipal atomically;
- repeated mark-paid on same occurrence cannot create second LoanPayment/Expense.

## WishlistItem

```text
id
userId
name
category
targetPrice            Decimal
maxBudget              Decimal?
priority               LOW | MEDIUM | HIGH
targetDate             DateTime?
plannedAccountId       String?
status                 WISHLIST | PLANNED | READY | PURCHASED | ARCHIVED
notes                  String?
actualPrice            Decimal?
purchasedAt            DateTime?
transactionId          String? unique
createdAt
updatedAt
```

Rules:
- targetPrice > 0;
- maxBudget if supplied > 0;
- creating/editing wishlist does not affect account balance;
- Mark Purchased optionally creates one EXPENSE;
- repeat Mark Purchased is idempotent.

## Existing model changes

### Obligation
Loan may link one recurring EMI Obligation.
Debt due reminders may link generic Reminder without requiring an Obligation unless a concrete recurring schedule is desired.

### User
Add:
```text
personalDebts
loans
loanPayments
wishlistItems
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
