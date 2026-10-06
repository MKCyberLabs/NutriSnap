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
- personal cashflow may record EMI as Expense category `EMI`;
- loan outstanding decreases only by known principal component or explicit reconciliation.

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

## 7. Credit card

Current v0.1 account type CREDIT_CARD remains.

A Credit Card EMI Loan may reference a credit card account but must not double-count:
- purchase expense;
- card payment;
- EMI expense.

Architecture Gate A must document chosen card-EMI rule before coding.

## 8. Wishlist

Adding a ₹80,000 laptop wishlist:
- does not reduce balance;
- does not create expense;
- does not create loan.

Mark Purchased for ₹75,000:
- optionally create one Expense;
- set actualPrice;
- status PURCHASED;
- repeated action does not create duplicate expense.

## 9. Edit rules

### Account
Editable anytime:
- name;
- institution;
- credit limit;
- active/archive status.

Opening balance:
- editable only before posted activity OR through an explicit correction workflow approved at architecture gate.

### Standalone transaction
Editable with ownership and validation.

### Domain-linked transaction
Must be edited through its domain service.

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
Purchased transaction changes go through purchase edit flow.

## 10. No investments

Remove/de-emphasize `Investment` as a new transaction choice in ordinary Money UI for v0.2.

Historical rows with category `Investment` remain readable for backward compatibility.

Future Investment module owns new investment flows.
