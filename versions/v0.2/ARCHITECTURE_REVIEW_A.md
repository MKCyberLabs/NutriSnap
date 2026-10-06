# Architecture Review A - NutriSnap v0.2 Money Life

**Verdict:** `CHANGES_REQUIRED`

## Critical Findings

1. **Redundant Bidirectional Foreign Keys**
   - **Context:** `DATA_MODEL.md` proposes adding `loanPaymentId` and `wishlistItemId` to `FinancialTransaction`. However, `LoanPayment` and `WishlistItem` already define `transactionId String? unique`.
   - **Risk:** Bidirectional scalar foreign keys for 1-to-1 relationships in Prisma cause synchronization anomalies and complicate creates/updates.
   - **Recommendation:** Keep the scalar foreign key (`transactionId`) on the child entities (`LoanPayment` and `WishlistItem`). `FinancialTransaction` should only have the Prisma relation definition (without the scalar field), e.g., `loanPayment LoanPayment?` and `wishlistItem WishlistItem?`. `personalDebtId` on `FinancialTransaction` is correct since a Debt has many transactions.

2. **Credit Card EMI Double-Counting (V2-Q001)**
   - **Context:** `MONEY_RULES.md` Rule 7 requires a documented rule for Credit Card EMIs before coding to prevent double-counting.
   - **Risk:** If a user logs an initial purchase as an `EXPENSE` on their Credit Card, and then logs each EMI payment as an `EXPENSE`, the money is double-counted.
   - **Recommendation:** Add a boolean flag `emiGeneratesExpense Boolean @default(true)` to `Loan`.
     - For **Product EMI** (e.g., Bajaj Finserv): `emiGeneratesExpense = true`. EMI payments create `EXPENSE` transactions.
     - For **Credit Card EMI** where the initial purchase was already logged as an Expense: `emiGeneratesExpense = false`. The `LoanPayment` only reduces the Loan outstanding and does NOT create a new `EXPENSE` transaction (the actual cash outflow is handled by the standard Credit Card bill `TRANSFER`).

## High Findings

3. **Obligation Occurrence vs Loan Payment Delegation**
   - **Context:** A `Loan` can link to an `Obligation`. `LoanPayment` links to `ObligationOccurrence`.
   - **Risk:** If a user marks the `Obligation` as paid from the generic Reminders/Obligations UI, it might create a standard `EXPENSE` but fail to create the `LoanPayment` and update the `Loan` balance.
   - **Recommendation:** Update `ARCHITECTURE.md` to mandate that the Obligation fulfillment service must check for a linked `Loan`. If linked, it must delegate the payment creation to the `LoanService` to ensure `LoanPayment` is atomically created alongside the occurrence.

4. **Wishlist Deletion / Unlinking Safety**
   - **Context:** `WishlistItem` links to a `transactionId` when purchased.
   - **Risk:** If the linked `EXPENSE` transaction is deleted from the standalone transaction editor, what happens to the Wishlist item?
   - **Recommendation:** The standalone transaction deletion logic must check for linked `WishlistItem` and either (a) block the deletion, requiring the user to "Unmark as Purchased" from the Wishlist UI, or (b) atomically revert the Wishlist item status back to `READY`. Document this in `MONEY_RULES.md` (Edit rules).

## Non-Blocking Suggestions

5. **Partial Payments & Principal Split**
   - The rule stating that unknown principal components do not decrease `outstandingPrincipal` (Rule 5) is practical and safe. However, ensure the UI clearly explains to the user *why* their loan balance isn't decreasing when they only input the total EMI amount without splitting out the principal.

6. **Opening Balance Correction (V2-Q002)**
   - The recommendation in `OPEN_QUESTIONS.md` to only allow `openingBalance` edits if the account has no transactions is sound. Accept this as the v0.2 standard.

## Required Actions before Implementation
- Update `DATA_MODEL.md` to fix the foreign key placements on `FinancialTransaction`.
- Update `DATA_MODEL.md` and `MONEY_RULES.md` to include `emiGeneratesExpense` (or similar logic) to resolve V2-Q001.
- Update `MONEY_RULES.md` to specify the UI/Service delegation rules for Obligation -> Loan Payments and Wishlist Transaction deletion.
