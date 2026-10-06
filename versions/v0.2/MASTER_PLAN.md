# NutriSnap v0.2 — Money Life Master Plan

## Product statement

v0.2 answers five daily questions:

1. How much liquid money do I have?
2. Who owes me money?
3. Who do I owe money to?
4. What loans/EMIs are running and what is due next?
5. What do I want to buy later and how much should I budget for it?

## Navigation

```text
Money
├── Overview
├── Accounts
├── Transactions
├── Bills & Subscriptions
├── Friends & Family
├── Loans & EMI
└── Wishlist
```

No Investments item in this module.

## Milestones

### M0 — Baseline / architecture review
- Freeze v0.1 final schema and behavior.
- Run migration rehearsal against representative v0.1 DB.
- Architecture Gate A reviewed (Review A findings resolved and frozen).
- All OPEN_QUESTIONS (V2-Q001 through V2-Q006) resolved.
- Gemini 3.1 Pro High architecture review PASS required before coding.

### M1 — Safe update foundation
Implement update/edit behavior before adding more money domains.

Required:
- account metadata edit;
- account opening-balance safety rule (editable ONLY when account has zero posted transactions);
- standalone transaction edit (unlinked only);
- transfer edit atomically;
- obligation edit;
- archive instead of destructive delete where appropriate;
- linked-record mutation restrictions (block generic edit/delete on Wishlist, Loan, Debt, Obligation links);
- validation and ownership tests.

### M2 — Friends & Family debt
Add:
- receivable: friend/family owes me;
- payable: I owe friend/family;
- partial collections/repayments;
- due date optional;
- reminders optional;
- person/counterparty;
- notes;
- complete/settle/archive.

Critical accounting rule:
Debt cash movements affect account balances but MUST NOT inflate monthly Income or Expense.

### M3 — Loans & EMI
Add formal liabilities:
- Personal Loan
- Home Loan
- Vehicle Loan
- Education Loan
- Gold Loan
- Product EMI
- Credit Card EMI
- Other

Support existing running loans using an as-of-date outstanding snapshot.

Track:
- lender;
- loan type;
- original principal optional for old loans;
- opening/current outstanding;
- EMI amount;
- interest rate optional;
- start/end dates optional;
- next EMI date;
- payment account;
- product name/merchant for Product EMI;
- reminders;
- status.

Accounting & Delegation Rules:
- Credit Card EMI policy frozen to prevent double-counting (`emiGeneratesExpense` flag; snapshot vs converted purchase);
- Linked EMI Obligation mark-paid delegates atomically to `LoanService.recordEmiPayment()`;
- Do not invent principal/interest split when the user does not know it;
- Principal reduction occurs only when known principal component is entered.

### M4 — Wishlist / planned purchase budget
Add product/item wishlist:
- item name;
- category;
- target price;
- maximum budget optional;
- priority;
- target purchase date optional;
- notes;
- planned payment account optional;
- status.

States:
`WISHLIST | PLANNED | READY | PURCHASED | ARCHIVED`.

Mark Purchased may optionally create a normal Expense with actual paid amount.
Generic transaction editor/deleter blocks modifying or deleting wishlist-linked transactions.
Purchase reversal ("Unmark as Purchased") atomically removes the transaction, restores balances, and resets status to READY.

Wishlist does not reserve or remove money from account balances.

### M5 — Dashboard integration
Money overview:
- Liquid Balance
- Monthly Income
- Monthly Expense
- Friends Owe Me
- I Owe Friends
- Loan Outstanding
- Next EMI
- Upcoming Bills
- Wishlist Planned Cost

Today:
- next EMI;
- debt due soon;
- next bill;
- high-priority wishlist due soon only if useful.

Do not overload Today.

### M6 — Reminder / Telegram integration
Extend existing generic reminder engine for:
- friend repayment due;
- money I need to repay;
- EMI due;
- wishlist target date optional.

Telegram actions remain compact and server-validated.

Do not add payment initiation.

### M7 — Full integration
- browser flows;
- security negatives;
- idempotency;
- migration rehearsal;
- responsive UAT;
- final owner review.

## Release gates

Architecture Gate A:
schema + accounting semantics.

Implementation Gate B:
debts + loans + update behavior.

Final Gate C:
wishlist + dashboard + reminders + regression.

## Non-negotiables

- Decimal money only.
- No financial credentials.
- No external payment initiation.
- Every mutation authenticated and user-owned.
- No debt movement counted as salary/income or normal spending/expense.
- No automatic principal reduction unless principal component is known.
- No Investments implementation in v0.2.
