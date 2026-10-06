# NutriSnap v0.2 Status

State: ARCHITECTURE GATE A REPAIR COMPLETE — READY FOR 3.1 PRO RE-REVIEW

Planning branch:
`planning/v0.2-money-life`

Planning base:
`86f24b6edc1904ae84d64655c29f7f976730fff6`

## Architecture Gate A Repair Summary

All Critical and High findings from Gemini 3.1 Pro Architecture Review A have been systematically resolved and synchronized across all v0.2 specification documents:

1. **Foreign Key Ownership (Critical Finding 1)**:
   - Eliminated redundant bidirectional scalar foreign keys.
   - Child domain entities (`LoanPayment` and `WishlistItem`) hold the authoritative scalar foreign key `transactionId String? @unique`.
   - `FinancialTransaction` maintains only Prisma relation references (`loanPayment LoanPayment?`, `wishlistItem WishlistItem?`) with no duplicate scalar columns.
   - `FinancialTransaction` holds scalar `personalDebtId String?` for the 1:N debt relationship.

2. **Credit Card EMI Double-Counting Policy (Critical Finding 2 & V2-Q001)**:
   - Added `emiGeneratesExpense Boolean @default(true)` and `principalAlreadyRecognized Boolean @default(false)` to `Loan`.
   - Snapshot Running EMI: No historical purchase created; future EMI payments create linked `EXPENSE` transactions (`emiGeneratesExpense = true`).
   - Converted Purchase EMI: Initial purchase already recognized as `EXPENSE`; subsequent `LoanPayment` records reduce loan liability without creating duplicate `EXPENSE` records (`emiGeneratesExpense = false`). Cash outflow settled via standard card bill transfer.

3. **Loan / Obligation Mark-Paid Delegation (High Finding 3)**:
   - When an `Obligation` is linked to a `Loan`, generic `markObligationPaid()` delegates directly to `LoanService.recordEmiPayment()`.
   - Atomic and occurrence-idempotent: exactly one `LoanPayment` created, `ObligationOccurrence` completed, next EMI advanced, and reminders acknowledged. Repeated calls return existing payment without duplicating expenses or principal deductions.

4. **Wishlist Transaction Safety & Reversal (High Finding 4)**:
   - Standalone transaction edit/delete blocks wishlist-linked transactions (`409 Conflict`).
   - Reversal and corrections must use Wishlist "Unmark as Purchased" / "Revert Purchase", which atomically removes the transaction, restores account balances, and resets WishlistItem to `READY`.

5. **Reviewer Recommendations Accepted**:
   - `FinancialAccount.openingBalance` is editable ONLY while the account has 0 posted transactions. Once transactions exist, edits are rejected (`400 Bad Request`); balance discrepancies deferred to future reconciliation (V2-Q002 RESOLVED).
   - `principalPaid` / `interestPaid` / `feesPaid` remain strictly optional; never infer principal reduction from EMI amount alone; UI provides explicit guidance (V2-Q003 RESOLVED).
   - All open questions V2-Q001 through V2-Q006 marked `RESOLVED`.

## Current Gate Status

- Architecture Gate A initial review: `CHANGES_REQUIRED` (in `ARCHITECTURE_REVIEW_A.md`)
- Architecture Gate A repairs: `COMPLETE`
- Next Step: Submit to Gemini 3.1 Pro High for Architecture Gate A Re-Review (`PASS`).
- Coding remains blocked until Architecture Gate A explicitly achieves `PASS` and v0.1 Food Live AI/UAT finishes.
