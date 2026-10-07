# v0.2 Architecture

## Bounded contexts

```text
Money
├── Accounts
├── Ledger
│   └── FinancialTransaction
├── Obligations
├── Personal Debt
│   └── PersonalDebt
├── Liabilities
│   ├── Loan
│   └── LoanPayment
└── Planned Purchases
    └── WishlistItem
```

Reminder Engine remains a separate shared domain.

## 1. Personal Debt

Personal Debt means informal borrowing/lending with a person.

Examples:
- "I gave Rahul ₹10,000; he will return it."
- "I borrowed ₹5,000 from Arun."

It is NOT:
- a normal Expense;
- normal Income;
- a bank loan.

Directions:
- `RECEIVABLE` — someone owes the user.
- `PAYABLE` — the user owes someone.

### Ledger integration

Extend `FinancialTransaction.type` with:

```text
LEND
BORROW
DEBT_COLLECT
DEBT_REPAY
```

Semantics:

| Type | Account effect | Income total | Expense total | Debt effect |
|---|---:|---:|---:|---|
| LEND | - | exclude | exclude | receivable increases |
| DEBT_COLLECT | + | exclude | exclude | receivable decreases |
| BORROW | + | exclude | exclude | payable increases |
| DEBT_REPAY | - | exclude | exclude | payable decreases |

All amounts remain positive Decimal values. Direction is encoded by type.

This keeps account balances correct without pretending debt movements are normal spending/earnings.

## 2. Loans / liabilities

A formal loan is not the same model as friend debt.

Loan is a liability tracker.

For an existing running loan, the user may enter an **as-of snapshot**:
- outstanding today;
- EMI today;
- next due date;
without reconstructing historical disbursements.

EMI payment may continue to be treated as an Expense for personal cashflow reporting when configured.

### Outstanding balance & principal split (V2-Q003)

Never infer principal paid from total EMI unless the principal component is known.

Rule:
- `principalPaid`, `interestPaid`, `feesPaid` remain optional on `LoanPayment`;
- if `principalPaid` is supplied and > 0, `Loan.outstandingPrincipal` decrements transactionally;
- if it is unknown/omitted, record the payment but do not guess principal reduction;
- UI must clearly display guidance explaining that the loan balance does not decrease automatically unless the principal component is entered;
- user can perform an explicit outstanding reconciliation/update at any time.

This is personal cashflow tracking, not a bank-grade amortization engine.

### Credit Card EMI double-counting policy (V2-Q001)

To prevent double-counting between purchase expenses and subsequent EMI payments, `Loan` defines `emiGeneratesExpense Boolean @default(true)` and `principalAlreadyRecognized Boolean @default(false)`:

1. **Snapshot running EMI** (`emiGeneratesExpense = true`, `principalAlreadyRecognized = false`):
   - For an already-running Credit Card EMI entered as an as-of snapshot:
   - Do NOT reconstruct the historical purchase;
   - Do NOT create the original purchase Expense;
   - Track future EMI payments only. Each EMI payment creates a linked `EXPENSE` transaction (category `EMI`).
2. **Converted purchase EMI** (`emiGeneratesExpense = false`, `principalAlreadyRecognized = true`):
   - When a user converts a new credit card purchase to EMI where the full purchase was already recorded as an `EXPENSE` on the Credit Card account:
   - `Loan.emiGeneratesExpense` is set to `false`;
   - Subsequent `LoanPayment` records do NOT create duplicate `EXPENSE` transactions;
   - The liability is tracked on the Loan, and cash outflow for the credit card is recognized when the credit card statement/bill is settled via standard `TRANSFER` from Bank to Credit Card.

### Obligation occurrence vs Loan Payment delegation

When an `Obligation` is linked to a `Loan` via `Loan.obligationId`:

Generic `markObligationPaid(occurrenceId)` MUST NOT independently create a generic unlinked expense and bypass `LoanPayment`.

**Frozen delegation rule**:
```text
Linked EMI Obligation fulfillment
└── Obligation service detects linked Loan via Loan.obligationId
    └── Delegates directly to LoanService.recordEmiPayment()
        └── Single atomic interactive Prisma transaction:
            1. Idempotency check: if LoanPayment exists for obligationOccurrenceId, return existing payment/occurrence
            2. Create exactly one LoanPayment linked to loanId, accountId, obligationOccurrenceId
            3. If loan.emiGeneratesExpense == true, create and link exactly one FinancialTransaction (EXPENSE, category EMI)
            4. Complete ObligationOccurrence (PAID / COMPLETED with paidAt)
            5. Advance Loan.nextEmiDate deterministically according to recurrence schedule
            6. Decrement Loan.outstandingPrincipal ONLY when a known principal component exists
            7. Acknowledge and mark reminder delivery as acknowledged/sent
```

If `markObligationPaid()` or `recordEmiPayment()` is called repeatedly for the same `obligationOccurrenceId` (e.g. duplicate webhook or double submit), the operation returns the existing `LoanPayment` without duplicating transactions, loan payments, or principal deductions.

## 3. Wishlist

Wishlist is planning, not a ledger.

Creating a wishlist item:
- does not change account balance;
- does not create an expense;
- does not create a liability.

### Mark Purchased flow
- Sets `status = PURCHASED`, records `actualPrice` and `purchasedAt`;
- Optionally creates and links exactly one `EXPENSE` transaction with `actualPrice`;
- Repeated `Mark Purchased` calls are idempotent and do not create duplicate transactions.

### Wishlist-linked transaction safety
The `EXPENSE` transaction created by `Mark Wishlist Purchased` is domain-owned:
- **Generic edit/delete blocked**: The standalone transaction editor (`updateTransaction`) and deleter (`deleteTransaction`) MUST reject any attempt to edit or delete a wishlist-linked transaction (`409 Conflict`), returning an explanatory error message directing the user to the Wishlist module.
- **Purchase correction / reversal flow**: Modifying or unlinking a purchased wishlist item must go through the dedicated Wishlist domain service:
  - "Unmark as Purchased" / "Revert Purchase" atomically deletes the linked `FinancialTransaction`, restores the account balance, and resets the `WishlistItem` status back to `READY` (or `PLANNED`), clearing `actualPrice`, `purchasedAt`, and `transactionId`.

## 4. Update architecture

Edits must go through domain-aware services.

### FinancialAccount opening balance safety (V2-Q002)
- `openingBalance` is editable ONLY while the account has zero posted transactions (`count(FinancialTransaction) == 0`);
- Once any transaction has posted, editing `openingBalance` is rejected (`400 Bad Request`);
- Any balance discrepancies must be corrected via a future explicit balance adjustment / reconciliation workflow, preserving ledger auditability.

### Safe standalone transaction edit
Allowed:
- amount;
- category;
- date;
- account;
- note.

### Transfer edit
Must update source/destination/amount atomically.

### Linked transaction protection
Transactions linked to:
- `loanPayment`;
- `wishlistItem`;
- `personalDebt`;
- `obligationOccurrence`
must NOT be edited or deleted through the generic transaction editor. They must be managed through their owning domain flow or rejected with `409 Conflict`.

Do not let a generic transaction editor break domain state.

## 5. Archive vs delete

Prefer:
- archive Account;
- archive PersonalDebt;
- close/archive Loan;
- archive WishlistItem;
- deactivate/archive Obligation.

Transaction history should not be silently destroyed.

Standalone unlinked transactions may be deleted or voided with account balance restoration. Domain-linked transactions cannot be deleted directly through the generic transaction deleter.

## 6. Dashboard read models

Create one authenticated Money overview read model.

It may aggregate:
- account liquid balance;
- month income;
- month expense;
- receivables outstanding;
- payables outstanding;
- formal loan outstanding;
- next EMI;
- next bill;
- wishlist planned total.

Do not join or calculate these in large client components.

## 7. Security

Every service takes authenticated user ID from server auth context.

Client-supplied user IDs are compatibility-only and never authoritative.

Every linked resource lookup verifies ownership:
- account;
- destination account;
- debt;
- loan;
- obligation;
- wishlist item;
- linked transaction.

## 8. Reminder integration

Debts and loans may create/link existing generic `Reminder` records.

Do not create a second scheduler.

Existing durable delivery/idempotency architecture remains authoritative.

## 9. Investments boundary

Do not overload Account/Loan/Wishlist to model investments.

Future Investments domain may introduce:
- portfolio;
- instrument;
- holding;
- trade;
- valuation.

No v0.2 model should assume those semantics.

## 10. Foreign key & relation ownership architecture

To ensure database consistency and prevent Prisma synchronization anomalies:

- **1-to-1 Relations (`LoanPayment` ↔ `FinancialTransaction`, `WishlistItem` ↔ `FinancialTransaction`)**:
  - The domain child records (`LoanPayment` and `WishlistItem`) hold the authoritative scalar foreign key column: `transactionId String? @unique`;
  - `FinancialTransaction` maintains only the relation navigation fields (`loanPayment LoanPayment?`, `wishlistItem WishlistItem?`) with NO duplicate scalar foreign key columns (`loanPaymentId` or `wishlistItemId`);
  - Uniqueness is strictly enforced via database unique constraints on the child's `transactionId`.
- **1-to-1 Relations (`Loan` ↔ `Obligation`, `LoanPayment` ↔ `ObligationOccurrence`)**:
  - `Loan` holds scalar `obligationId String? @unique` pointing to `Obligation.id`;
  - `LoanPayment` holds scalar `obligationOccurrenceId String? @unique` pointing to `ObligationOccurrence.id`.
- **1-to-many Relations (`PersonalDebt` ↔ `FinancialTransaction`)**:
  - `FinancialTransaction` holds scalar `personalDebtId String?` pointing to `PersonalDebt.id`, tracking each movement (`LEND`, `DEBT_COLLECT`, `BORROW`, `DEBT_REPAY`).
- **1-to-1 Relations (`CreditCardPayment` ↔ `FinancialTransaction`)**:
  - `CreditCardPayment` holds authoritative scalar foreign key `transactionId String @unique` pointing to `FinancialTransaction.id`.
  - `FinancialTransaction` defines only the relation navigation field `creditCardPayment CreditCardPayment?` without duplicate scalar foreign keys.

## 11. Payment Lifecycle, Undo Paid, and Credit Card Tracking (V2-650)

### Domain-aware Undo Paid (`revertObligationPayment`)
Generic transaction deletion MUST continue rejecting domain-linked transactions (`409 Conflict`).
Reverting an obligation occurrence must use `revertObligationPayment(userId, { obligationId, occurrenceKey })`:
- Only the latest dependent completed occurrence may be reverted;
- Deletes/reverses the linked `FinancialTransaction` created by `markObligationPaid`;
- Marks occurrence `REVERSED` (or clears completed state), making it payable again;
- Restores `Obligation.nextDueAt` to the reverted occurrence date;
- Restores `Obligation.lastCompletedAt` to the prior completed date or null;
- Reactivates `ONCE` obligations where appropriate (`isActive = true`);
- Cancels/removes only unsent future `ReminderDelivery` claims generated from the advancement;
- Retains historical `SENT`/`ACKNOWLEDGED` audit logs;
- Repeated calls are idempotent.

### Loan EMI Reversal (`LoanService.revertEmiPayment`)
When an obligation is linked to a `Loan`, `revertObligationPayment` delegates to `LoanService.revertEmiPayment`:
- Removes the specific `LoanPayment`;
- Removes the linked `EXPENSE` transaction only if one was generated (`emiGeneratesExpense == true`);
- Adds back exactly `principalPaid` to `Loan.outstandingPrincipal` (never guess or infer principal);
- Restores `Loan.nextEmiDate` and `Obligation.nextDueAt` using the exact scheduled date of the reverted occurrence;
- Cancels obsolete unsent future reminder deliveries;
- Repeated reversal is idempotent.

### Credit Card Statements & Partial Payments (`CreditCardService`)
- For `FinancialAccount` where `type == 'CREDIT_CARD'`: supports `creditLimit`, `statementDay` (1..31), `paymentDueDay` (1..31), optional `defaultPaymentAccountId`, and `reminderOffsetsMin`.
- **Month-end clamping**: For statement and due days (e.g. day 31), months with fewer days (Feb 28/29, Apr 30, etc.) clamp to the last valid day of that calendar month. Never roll over into next month or crash.
- `CreditCardStatement`: Tracks monthly statement period (`creditCardAccountId + periodKey` unique), `statementDate`, `dueDate`, `statementAmount`, `minimumDue`, and `status` (`OPEN | PARTIAL | PAID | OVERDUE`).
- `CreditCardPayment`: Records payments against a statement. Each payment creates exactly one `TRANSFER` transaction from the payer account to the credit card account. Does NOT create Income or Expense.
- **Partial Payments**: Each payment reduces pending amount (`statementAmount - sum(payments)`). When pending > 0, status is `PARTIAL` and reminder remains active showing remaining pending amount.
- **Full Payment**: When pending reaches 0, statement status becomes `PAID`, monthly obligation occurrence completes (`transactionId = null` because payments hold their own transactions), and `Obligation.nextDueAt` advances to the next month.
- **Credit Card Reversal (`revertPayment`)**: Deletes the latest `CreditCardPayment`, removes its linked `TRANSFER` transaction, restores payer and card balances, sets status back to `PARTIAL` or `OPEN`, and restores the obligation occurrence and reminder state.
