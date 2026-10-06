# Architecture Review C - NutriSnap v0.2 Payment Lifecycle

**Verdict:** `PASS`

## Critical Findings — Resolved

1. **Credit Card Revert Lifecycle Omission**
   - **Resolution:** Defined in `ARCHITECTURE.md`, `DATA_MODEL.md`, and `CreditCardService.revertPayment()`.
   - When reverting a credit card payment (or reverting a completed credit card statement obligation occurrence):
     - The latest specific `CreditCardPayment` is deleted;
     - Its linked `TRANSFER` transaction is deleted atomically (restoring payer bank balance and card account balance);
     - The `CreditCardStatement.status` reverts from `PAID` back to `PARTIAL` (if earlier partial payments exist) or `OPEN`;
     - Remaining statement balance is recalculated and synced into `Obligation.amount`;
     - If the obligation occurrence was marked `COMPLETED`, it is restored to `OPEN`/pending, and `Obligation.nextDueAt` is restored to the statement due date;
     - Repeated revert is idempotent.

2. **Strict Month-End Clamping for Recurring Days**
   - **Resolution:** Enforced in recurrence engine and Credit Card calculation logic.
   - For `statementDay` (1..31) and `paymentDueDay` (1..31), months with fewer days (e.g. Feb 28/29, Apr/Jun/Sep/Nov 30) strictly clamp to the last valid day of that specific calendar month (e.g., day 31 clamps to Feb 28 in common years, Feb 29 in leap years, and Apr 30).
   - Never overflows or skips into subsequent months.

## High Findings — Resolved

3. **Partial Payments vs Obligation Occurrence Transaction Link**
   - **Resolution:** Clarified in `DATA_MODEL.md` and `ARCHITECTURE.md`.
   - For `CREDIT_CARD` obligations fulfilling statements with multiple payments, `ObligationOccurrence.transactionId` is set to `NULL`.
   - Each individual payment cleanly and uniquely owns its financial transaction via `CreditCardPayment.transactionId` (`@unique`).

4. **Statement-to-Obligation Linkage & Reminder Accuracy**
   - **Resolution:** The Credit Card service explicitly syncs `remainingAmount` directly into `Obligation.amount` upon statement creation and after each partial payment.
   - When full payment is reached, `Obligation.amount` is reset to `null` or 0, and next due date advances.
   - The unified reminder engine (`formatTelegramBillReminder`) formats and sends the exact pending amount without requiring a cross-domain join.

## Non-Blocking Suggestions — Adopted

5. **Loan Reversal `nextEmiDate` Safety**
   - When reverting a Loan EMI, `Loan.nextEmiDate` is restored directly using the exact `dueDate` / `occurredAt` of the reverted occurrence/payment, guaranteeing no drift from manual edits.

6. **Debt Repayment Reversal**
   - Domain-linked protection prevents generic transaction deletion on debt-linked transactions. Reverting an obligation linked to a personal debt verifies domain invariants.

## Final Review Verdict

All critical and high requirements for V2-650 Payment Lifecycle, Reminder Management, and Credit Card Statements are validated and approved. Architecture Gate C is **PASS**. Implementation may proceed.

