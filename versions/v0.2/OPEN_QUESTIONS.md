# v0.2 Open Questions — Status: ALL RESOLVED AT GATE A

All open questions have been resolved and frozen for Architecture Gate A.

## V2-Q001 — Credit Card EMI treatment
- **Status:** `RESOLVED`
- **Frozen Policy**:
  - Add `emiGeneratesExpense Boolean @default(true)` and `principalAlreadyRecognized Boolean @default(false)` to `Loan`.
  - **Running Snapshot EMI** (`emiGeneratesExpense = true`, `principalAlreadyRecognized = false`):
    - For an already-running Credit Card EMI added as an as-of snapshot:
    - Do NOT reconstruct the historical purchase;
    - Do NOT create the original purchase Expense;
    - Track future EMI payments only. Each EMI payment creates a linked `EXPENSE` transaction (category `EMI`).
  - **Converted Purchase EMI** (`emiGeneratesExpense = false`, `principalAlreadyRecognized = true`):
    - When a new purchase was already logged as an `EXPENSE` on the Credit Card account in NutriSnap and subsequently converted to EMI:
    - `Loan.emiGeneratesExpense` is set to `false`;
    - Subsequent `LoanPayment` records reduce the loan liability without creating duplicate normal `EXPENSE` transactions;
    - The cash outflow is recognized when the card statement is paid via standard `TRANSFER` from Bank to Credit Card.

## V2-Q002 — Opening balance correction
- **Status:** `RESOLVED`
- **Frozen Policy**:
  - `FinancialAccount.openingBalance` is editable ONLY while the account has zero posted transactions (`count(FinancialTransaction) == 0`).
  - Once any transaction has been posted to the account, `openingBalance` edits are rejected (`400 Bad Request`).
  - Balance discrepancies must be handled via a future explicit balance adjustment workflow / reconciliation, preserving ledger integrity and audit trails.

## V2-Q003 — Loan payment principal split
- **Status:** `RESOLVED`
- **Frozen Policy**:
  - `principalPaid`, `interestPaid`, and `feesPaid` remain strictly optional on `LoanPayment`.
  - Never infer or calculate principal reduction from EMI amount alone when the principal split is omitted.
  - When `principalPaid` is unknown, record the payment without decrementing `outstandingPrincipal`.
  - The UI must clearly explain to the user why the loan balance does not decrease without the principal split, and provide an explicit "Update Outstanding Balance" action.

## V2-Q004 — Debt interest
- **Status:** `RESOLVED`
- **Frozen Policy**:
  - No interest tracking for personal debts in v0.2.
  - Track principal only (`LEND`, `BORROW`, `DEBT_COLLECT`, `DEBT_REPAY`).
  - Complex interest calculation can be considered in a future version if user demand requires it.

## V2-Q005 — Wishlist savings allocation
- **Status:** `RESOLVED`
- **Frozen Policy**:
  - No virtual reservation ledger or earmarked savings in v0.2.
  - Track target price, max budget, priority, target date, and purchase status only.
  - Wishlist creation/updates do not alter liquid balance. A dedicated Savings Goals module can handle earmarked savings in a future version.

## V2-Q006 — Existing EMI obligations
- **Status:** `RESOLVED`
- **Frozen Policy**:
  - Do NOT auto-convert existing v0.1 `Obligation(kind=EMI)` records into `Loan` records during migration.
  - Provide an optional, explicit linking UI allowing the user to link an existing EMI obligation to a newly created `Loan`.
