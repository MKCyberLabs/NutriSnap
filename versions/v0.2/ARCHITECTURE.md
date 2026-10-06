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

EMI payment may continue to be treated as an Expense for personal cashflow reporting.

### Outstanding balance

Never infer principal paid from total EMI unless the principal component is known.

Rule:
- if `principalPaid` is supplied, outstanding may decrement transactionally;
- if it is unknown, record the payment but do not guess principal reduction;
- user can perform an explicit outstanding reconciliation/update.

This is personal cashflow tracking, not a bank-grade amortization engine.

## 3. Wishlist

Wishlist is planning, not a ledger.

Creating a wishlist item:
- does not change account balance;
- does not create an expense;
- does not create a liability.

Only `Mark Purchased` may optionally create an Expense.

## 4. Update architecture

Edits must go through domain-aware services.

### Safe standalone transaction edit
Allowed:
- amount;
- category;
- date;
- account;
- note.

### Transfer edit
Must update source/destination/amount atomically.

### Linked transaction
Transactions linked to:
- obligation occurrence;
- debt;
- loan payment;
- purchased wishlist item
must be edited from their owning domain flow or through a shared transactional service.

Do not let a generic transaction editor break domain state.

## 5. Archive vs delete

Prefer:
- archive Account;
- archive PersonalDebt;
- close/archive Loan;
- archive WishlistItem;
- deactivate/archive Obligation.

Transaction history should not be silently destroyed.

v0.2 may retain current delete behavior for old standalone test records only if migration scope makes a full voiding system too large; final architecture review must decide.

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
