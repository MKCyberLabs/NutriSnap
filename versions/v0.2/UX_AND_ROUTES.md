# v0.2 UX & Routes

## Money navigation

Desktop nested routes:

```text
Money
├── Overview              /finance
├── Accounts              /finance/accounts
├── Transactions          /finance/transactions
├── Bills & Subscriptions /finance/bills
├── Friends & Family      /finance/debts
├── Loans & EMI           /finance/loans
└── Wishlist              /finance/wishlist
```

Mobile Money page uses an internal horizontal/overflow-safe segmented or list navigation. Do not add all seven destinations to the global bottom bar.

## Money Overview

Sections:
1. Liquid Balance
2. Monthly Income
3. Monthly Expense
4. Upcoming Bill
5. Friends Owe Me
6. I Owe Friends
7. Loan Outstanding
8. Next EMI

Below:
- Accounts preview;
- Recent transactions;
- Debts due soon;
- Loan/EMI due soon;
- Wishlist priority items.

Keep screen scannable; use grouped sections rather than eight giant KPI cards on mobile.

## Friends & Family

Top tabs:
- Owed to Me
- I Owe
- Settled

Primary action:
`Add Debt`

Create flow:
1. direction;
2. person;
3. amount;
4. account involved;
5. date;
6. optional due date;
7. reminder;
8. note.

Detail view/card:
- counterparty;
- original;
- outstanding;
- due;
- history;
- Collect / Repay action;
- Add more lending/borrowing;
- Edit metadata;
- Settle/archive.

Terminology:
Use friendly labels in UI:
- `They owe me`
- `I owe them`
rather than accounting jargon only.

## Loans & EMI

Tabs/filters:
- Active
- Product EMI
- Closed

Primary:
`Add Loan / EMI`

Wizard:
1. Loan type
2. Name/lender
3. Current outstanding
4. EMI
5. Next EMI date
6. Payment account
7. Interest/tenure optional
8. Product/merchant if PRODUCT_EMI
9. Reminder offsets

Card:
- name;
- lender;
- outstanding;
- EMI;
- next due;
- progress only if meaningful inputs exist.

Actions:
- Record EMI Paid
- Update Outstanding
- Edit
- Close

Never show a fabricated payoff date.

## Wishlist

Primary:
`Add Wishlist Item`

Fields:
- product/item;
- category;
- target price;
- max budget optional;
- priority;
- target date;
- planned account;
- note.

Cards:
- item;
- target price;
- max budget;
- target date;
- priority;
- status.

Actions:
- Edit
- Mark Ready
- Mark Purchased
- Archive

Mark Purchased modal:
- actual price;
- account;
- category;
- date;
- create Expense toggle default ON.

## Edit UX

Every editable entity gets a consistent overflow menu:
- Edit
- Archive/Close
- destructive option only when safe.

No browser `prompt()` or `confirm()`.
Use proper dialogs/sheets.

## Today integration

Only surface actionable near-term items:
- next bill;
- next EMI;
- debt due soon.

Wishlist does not need a permanent Today card.

## Empty states

Examples:
- `No one owes you money.`
- `You do not owe friends or family.`
- `No active loans or EMIs.`
- `Your wishlist is empty.`
