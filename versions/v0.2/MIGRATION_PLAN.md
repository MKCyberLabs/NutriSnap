# v0.2 Migration Plan

## Principle

v0.2 migration is additive-first and must preserve all v0.1 data.

## Phase 1 — Add schema

Add:
- `PersonalDebt`;
- `Loan` (with `emiGeneratesExpense Boolean @default(true)`, `principalAlreadyRecognized Boolean @default(false)`, and `obligationId String? @unique`);
- `LoanPayment` (with `transactionId String? @unique` and `obligationOccurrenceId String? @unique`);
- `WishlistItem` (with `transactionId String? @unique`);
- `FinancialTransaction.personalDebtId String?` (many-to-one foreign key to `PersonalDebt`);
- Prisma relation references on `FinancialTransaction` (`loanPayment LoanPayment?`, `wishlistItem WishlistItem?`) without duplicate scalar columns;
- new nullable relations and indexes.

Extend accepted `FinancialTransaction.type` vocabulary in code:
`INCOME | EXPENSE | TRANSFER | LEND | BORROW | DEBT_COLLECT | DEBT_REPAY`.

Do not rewrite existing transaction type values.

## Phase 2 — Existing v0.1 obligations

Existing EMI obligations remain valid.

Do not automatically convert every `Obligation(kind=EMI)` into a Loan.

Provide an optional explicit migration/linking UI:
`Link this existing EMI obligation to a Loan`.

This avoids guessing principal, lender, outstanding or product details.

## Phase 3 — Investment category compatibility

Do not delete historical transactions whose category is `Investment`.

UI stops presenting Investment as a normal new Money category unless backward compatibility requires it.

Future Investments migration may adopt them explicitly.

## Phase 4 — Rehearsal

Use isolated PostgreSQL 15.

Required proof:
- v0.1 DB backup;
- migration apply;
- existing User/Account/Transaction/Obligation counts unchanged;
- existing account balances unchanged;
- monthly income/expense totals unchanged;
- existing reminders/deliveries unchanged;
- rollback/restore tested.

## Production boundary

No production migration as part of development.

Owner approves production migration separately.
