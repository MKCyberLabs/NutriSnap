# Money Rules — v0.2

## 1. Liquid balance

Liquid Balance means only active FinancialAccount balances.

It does NOT include:
- receivables;
- wishlist;
- loan outstanding;
- investment value.

## 2. Income / Expense

Monthly Income includes only `INCOME`.

Monthly Expense includes only `EXPENSE`.

Exclude:
- TRANSFER;
- LEND;
- BORROW;
- DEBT_COLLECT;
- DEBT_REPAY.

This rule is release-critical.

## 3. Money lent to friend

Example:
`Give Rahul ₹10,000 from Canara Bank`.

Result:
- Canara account: -₹10,000;
- Monthly Expense: unchanged;
- Rahul receivable: +₹10,000.

Rahul returns ₹4,000:
- selected account: +₹4,000;
- Monthly Income: unchanged;
- receivable outstanding: ₹6,000.

## 4. Money borrowed from friend

Example:
`Borrow ₹5,000 from Arun into Cash`.

Result:
- Cash: +₹5,000;
- Monthly Income: unchanged;
- payable: ₹5,000.

Repay ₹2,000:
- account: -₹2,000;
- Monthly Expense: unchanged;
- payable outstanding: ₹3,000.

## 5. Formal loan

Adding an already-running Home Loan with ₹12,00,000 outstanding:
- must not create ₹12,00,000 income;
- must not alter liquid balance.

EMI payment:
- cash/account decreases;
- when `loan.emiGeneratesExpense == true`, records EMI as Expense category `EMI`;
- loan outstanding decreases only by known principal component (`principalPaid > 0`) or explicit reconciliation. Never infer principal reduction from EMI amount alone (V2-Q003);
- UI must explain that outstanding principal does not reduce automatically without the principal component.

Linked EMI Obligation fulfillment:
- Marking a linked EMI Obligation as paid delegates to `LoanService.recordEmiPayment()`;
- Creates exactly one `LoanPayment`, updates next EMI date, and updates `outstandingPrincipal` only if `principalPaid` is provided;
- Atomic and occurrence-idempotent: repeated calls on the same occurrence return the existing payment without creating duplicate expenses or deducting principal again.

## 6. Product EMI

Example:
`iPhone ₹60,000, EMI ₹5,000/month`.

Track:
- product name;
- lender/merchant;
- EMI;
- current outstanding;
- next EMI;
- optional end date.

Do not add full product price as current Expense when tracking an already-running EMI.

Each actual EMI paid may become an Expense.

## 7. Credit card & Credit Card EMI (V2-Q001)

Current v0.1 account type CREDIT_CARD remains.

To prevent double-counting between purchase expense, card bill payments, and EMI payments:

1. **Snapshot Running Credit Card EMI** (`emiGeneratesExpense = true`, `principalAlreadyRecognized = false`):
   - For an already-running Credit Card EMI entered as an as-of snapshot:
   - Do NOT reconstruct or create the original historical purchase Expense;
   - Track future EMI payments only. Each EMI payment creates a linked `EXPENSE` transaction (category `EMI`).
2. **Converted Purchase to Credit Card EMI** (`emiGeneratesExpense = false`, `principalAlreadyRecognized = true`):
   - When a purchase was already recorded as an `EXPENSE` on the Credit Card account in NutriSnap and subsequently converted to EMI:
   - `Loan.emiGeneratesExpense` is set to `false`;
   - Subsequent `LoanPayment` records do NOT create duplicate `EXPENSE` transactions;
   - The liability is tracked on the Loan, and cash outflow is recognized when the card bill is paid via standard `TRANSFER` from Bank to Credit Card.

## 8. Wishlist

Adding a ₹80,000 laptop wishlist:
- does not reduce balance;
- does not create expense;
- does not create loan.

Mark Purchased for ₹75,000:
- optionally create and link one Expense transaction;
- set actualPrice;
- status PURCHASED;
- repeated action is idempotent.

Wishlist-linked transaction safety:
- Transactions linked to Wishlist items are domain-owned;
- Generic transaction editor and deleter MUST reject edits and deletions (`409 Conflict`);
- Deletion or reversal is permitted only via Wishlist "Unmark as Purchased" / "Revert Purchase", which atomically removes the transaction, restores account balances, and resets the item to `READY`.

## 9. Edit rules

### Account
Editable anytime:
- name;
- institution;
- credit limit;
- active/archive status.

Opening balance (V2-Q002):
- editable ONLY while account has zero posted transactions (`count(FinancialTransaction) == 0`);
- once any transaction has posted, opening balance edits are rejected (`400 Bad Request`);
- balance corrections must be performed via future explicit balance adjustment / reconciliation workflow.

### Standalone transaction
Editable/deletable with ownership and validation ONLY if unlinked.

### Domain-linked transaction
Transactions linked to:
- `loanPayment`;
- `wishlistItem`;
- `personalDebt`;
- `obligationOccurrence`
cannot be edited or deleted via generic transaction endpoints (`409 Conflict`). They must be modified or reverted through their respective domain flows.

### Obligation
Future schedule fields editable.
Past completed occurrence history stays immutable.

### Debt
Counterparty/title/due/reminder/notes editable.
Historical movements stay separate.

### Loan
Metadata and reconciliation fields editable.
Historical payments are not silently rewritten.

### Wishlist
All planning metadata editable before Purchase.
Purchased items must use Wishlist purchase correction flow.

## 10. No investments

Remove/de-emphasize `Investment` as a new transaction choice in ordinary Money UI for v0.2.

Historical rows with category `Investment` remain readable for backward compatibility.

Future Investment module owns new investment flows.
