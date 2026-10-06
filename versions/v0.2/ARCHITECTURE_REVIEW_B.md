# Architecture Review B - NutriSnap v0.2 Money Life

**Verdict:** `PASS`  
**Reviewed Commit:** `a7358d2`  
**Reviewer:** Architecture Reviewer (`gemini-3.1-pro-high`)  
**Scope:** Debt & Loan Domain Implementation, Safe Updates, Schemas, Migrations, Calculations, Security, and Test Suites

---

## 1. Schema & Migration Evaluation

- **Prisma Schema (`prisma/schema.prisma`):**
  - Confirmed strict adherence to Gate A requirements.
  - Foreign keys for `LoanPayment` and `WishlistItem` are mapped as 1-to-1 relationships with the scalar FK solely on their side (`transactionId` unique scalar FK), preventing duplicate scalar FKs on `FinancialTransaction`.
  - Relation for `PersonalDebt` is maintained via `FinancialTransaction.personalDebtId`.
- **Decimal Precision:**
  - All new monetary fields strictly use `@db.Decimal(14, 2)` (and `Decimal(5, 2)` for interest rates).
  - No `Float` types are used anywhere in financial models.
- **Migration SQL (`prisma/migrations/20261006_v0_2_money_life/migration.sql`):**
  - Adheres strictly to the additive-first rule.
  - Creates new tables (`PersonalDebt`, `Loan`, `LoanPayment`, `WishlistItem`) via `CREATE TABLE IF NOT EXISTS`.
  - Non-destructively alters `FinancialTransaction` with a nullable `personalDebtId` column and creates corresponding indices.

---

## 2. Debt Domain (`src/lib/finance/debt-service.ts`)

- Full support for `RECEIVABLE` (lent to counterparty) and `PAYABLE` (borrowed from counterparty).
- Collection and Repayment accurately recalculate `outstandingAmount` and enforce that it cannot drop below zero (`V2-T026`).
- Automatic state transition to `SETTLED` when balance reaches zero.
- Re-opening supported via additional lend/borrow.
- Idempotency supported via `idempotencyKey` tags in notes (`[idempotency:...]`).
- Personal debt transactions are excluded from monthly income and expense metrics, preserving financial reporting accuracy.

---

## 3. Loan & EMI Domain (`src/lib/finance/loan-service.ts`)

- **Principal Split Rule:** Principal is reduced *only* when `principalPaid` is explicitly non-null and > 0 (`V2-T046`). The system strictly never guesses the principal component from total EMI.
- **Credit Card EMI Rules:**
  - `emiGeneratesExpense`: Safely drives whether an EMI payment posts an expense transaction.
  - `principalAlreadyRecognized`: Properly marks pre-recognized purchases so EMI deductions reduce liability without double-counting expenses.
- **Idempotency:**
  - Handled cleanly via both `idempotencyKey` and `obligationOccurrenceId`.
  - Re-invoking EMI payment with the same occurrence returns the existing payment and transaction without duplicate deduction.
- **Reconciliation:** Manual balance adjustments via `reconcileOutstanding` record adjustments and update liability totals cleanly.

---

## 4. Safe Updates & Delegation (`src/lib/finance/finance-service.ts`)

- **Opening Balance Rule (V2-1002):** Opening balance cannot be edited once an account has posted transactions.
- **Linked Transaction Protection:** Generic edit and delete operations are strictly rejected for transactions linked to `LoanPayment`, `WishlistItem`, `ObligationOccurrence`, or `PersonalDebt` (returning `409 Conflict`).
- **Obligation Delegation:** `markObligationPaid` detects linked loan obligations (`obligation.loan`) and transactionally delegates execution to `LoanService.recordEmiPayment()`.

---

## 5. Authorization & Security

- Authenticated user checks (`userId`) are consistently enforced across all endpoints, mutations, and queries.
- Ownership verification extends to secondary entities (e.g. validating that a payment `accountId` belongs to the authenticated user).
- Cross-user mutations and data leaks are prevented across all domain services.

---

## 6. Test Coverage

- `src/lib/finance/safe-updates.test.ts` (V2-T080..V2-T089 & authorization negatives) passes 100%.
- `src/lib/finance/debt.test.ts` (V2-T020..V2-T030) passes 100%.
- `src/lib/finance/loan.test.ts` (V2-T040..V2-T052) passes 100%.
- All 26/26 finance tests pass deterministically.

---

## 7. Recommendations for V2-400 (Wishlist) & V2-500 (Dashboard)

1. **Wishlist Purchase Flow:** Ensure the "Mark as Purchased" action follows the exact same 1-to-1 transactional linkage with `FinancialTransaction` via `WishlistItem.transactionId` and enforces idempotency.
2. **Wishlist Purchase Reversal:** Provide an explicit "Unmark as Purchased" domain flow that reverses/deletes the linked expense and resets status to `SAVING`.
3. **Dashboard Aggregation:** When aggregating monthly income and expenses, continue calculating directly from `FinancialTransaction` to remain completely decoupled and agnostic of origin domain.

---

## Conclusion
Architecture Gate B is **PASS**. The implementation is verified, safe, and ready to proceed to **V2-400: Wishlist**.
