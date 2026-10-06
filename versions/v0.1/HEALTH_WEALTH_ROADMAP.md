# NutriSnap v0.1 — Health + Wealth Roadmap

Status: **Frozen product roadmap for Herdr execution**

Target branch: `feature/v0.1-health-wealth`

## 1. Product promise

NutriSnap v0.1 should answer three daily questions without forcing the user into separate apps:

1. **How is my health today?** — food and water.
2. **How is my money today/month?** — accounts, income, expenses, transfers and obligations.
3. **What must I not forget?** — health and finance reminders.

The milestone is intentionally manual-first and reliability-first. It is not a bank-sync, portfolio-management or general productivity release.

## 2. Product shape

```text
NUTRISNAP
   │
   ├── TODAY
   │    ├── Health summary
   │    ├── Wealth summary
   │    ├── Upcoming reminders
   │    └── Quick Add
   │
   ├── HEALTH
   │    ├── Food
   │    ├── Water
   │    └── Health reminders
   │
   ├── WEALTH
   │    ├── Overview
   │    ├── Accounts
   │    ├── Transactions
   │    └── Bills / Subscriptions / Obligations
   │
   └── REMINDERS
        ├── Health
        └── Finance
```

Visible navigation for v0.1 may stay:

`Today | Food | Water | Money | Reminders`

Do not redesign navigation merely to expose the internal Health/Wealth grouping.

## 3. Health pillar

### Food — preserve and integrate

Current Food behavior remains authoritative:

- meal logging;
- meal analysis contract;
- calories/macros;
- existing dashboard route and authentication behavior;
- current AI/mock-analysis contract.

v0.1 work:

- expose Food summary on Today;
- keep Quick Add Food entry point;
- preserve existing meal reminder compatibility through the generic reminder migration;
- do not replace the current meal-analysis backend.

### Water — preserve and integrate

Current Hydration behavior remains authoritative:

- daily goal;
- hydration logs;
- hydration schedule/reminders;
- timezone-aware day calculation;
- existing hydration route and Telegram callback behavior.

v0.1 work:

- expose Water progress on Today;
- keep Quick Add Water entry point;
- preserve existing hydration behavior while reminder infrastructure is generalized.

### Health reminders

The generic Reminder Engine must support the existing health use cases without making Finance pretend to be a meal category.

Required health behavior:

- existing meal reminders survive migration;
- hydration behavior regresses cleanly;
- Done/Acknowledge does not create finance transactions;
- user timezone remains authoritative.

## 4. Wealth pillar

### Accounts

Manual-first account types:

- BANK
- CASH
- WALLET
- CREDIT_CARD

Minimum behavior:

- create/edit/archive account;
- opening balance;
- optional institution label;
- optional credit limit for credit card;
- derived balance from opening balance + posted transactions unless a separately tested transactional cache is justified;
- strict user ownership.

### Transactions

Types:

- INCOME
- EXPENSE
- TRANSFER

Minimum categories:

- Food
- Transport
- Shopping
- Rent
- Utilities
- Recharge
- Subscription
- EMI
- Credit Card
- Insurance
- Investment
- Medical
- Entertainment
- Other

Rules:

- money uses Decimal/numeric, never Float;
- amount is positive; type determines direction;
- transfer requires two different user-owned accounts;
- transfer changes account balances but does not inflate income/expense totals;
- totals are calculated server-side from authoritative data.

### Bills / subscriptions / obligations

Required obligation kinds:

- RECHARGE
- CREDIT_CARD
- BILL
- SUBSCRIPTION
- RENT
- EMI
- INSURANCE
- OTHER

Minimum behavior:

- title;
- optional amount;
- optional linked account;
- due date/time;
- notes;
- active/archived state;
- recurrence;
- reminder offsets;
- last-completed state;
- deterministic next due occurrence.

Required recurrence:

- ONCE
- DAILY
- WEEKLY
- MONTHLY
- YEARLY
- EVERY_N_DAYS

`EVERY_N_DAYS` must correctly cover 28/56/84-day recharge validity.

Monthly recurrence must clamp to the last valid day rather than drift unpredictably. Leap-year behavior must be explicit and tested.

## 5. Shared Reminder Engine

Domains:

- HEALTH
- FINANCE

Required actions:

- Done / Acknowledge for health;
- Paid for finance;
- Snooze;
- Open.

Required offsets:

- due time/day;
- 1 day before;
- 3 days before;
- 7 days before.

Required guarantees:

- timezone-aware evaluation;
- durable occurrence/delivery identity;
- no duplicate send when scheduler runs twice;
- no duplicate send after process restart;
- durable snooze;
- stale callback safety;
- server-side ownership verification.

## 6. Finance → Reminder → Paid relationship

The core v0.1 workflow is:

```text
Obligation
   ↓
Reminder schedule
   ↓
Durable delivery claim
   ↓
Telegram / app reminder
   ↓
Paid
   ↓
Occurrence completed
   ├── optional exactly-once expense
   └── deterministic next due date
```

`Paid` must be transactionally idempotent. Repeating the same web request or Telegram callback must not create a second expense or advance the recurrence twice.

## 7. Today page

Today is an aggregation/read surface, not a source-of-truth domain.

Required sections:

### Health
- calories / key macro summary;
- Water consumed vs goal.

### Wealth
- current-month income;
- current-month expense;
- upcoming obligations / next due item.

### Reminders
- due today;
- upcoming this week;
- next important reminder.

### Quick Add
- Food;
- Water;
- Expense;
- Income;
- Reminder.

Required states:

- empty;
- loading;
- partial error;
- responsive mobile/desktop;
- no cross-user aggregate leakage.

## 8. Telegram

Reuse the existing Telegram bot/webhook and the existing scheduler entry point.

Do not create an independent Finance cron loop.

Local-gate rule:

- use mocked Telegram behavior;
- never send to production users during development verification.

Live Telegram testing is a later owner-authorized environment gate.

## 9. Implementation milestones

### Milestone 0 — Baseline and branch

- start from the approved planning/dev baseline;
- work on `feature/v0.1-health-wealth`;
- confirm isolated dev environment;
- record baseline tests;
- preserve main and production.

Exit: baseline verification recorded and branch clean/safe.

### Milestone 1 — Data foundation

- Finance schema;
- generic Reminder schema;
- migration/backfill strategy;
- recurrence primitives;
- durable delivery/idempotency;
- ownership boundaries;
- deterministic tests.

Exit: **Review A PASS** before major application UI continues.

### Milestone 2 — Health + Wealth shell

- shared module registry;
- Today page shell/read model;
- Quick Add shell;
- Food/Water route regressions;
- responsive navigation.

Exit: Today/Food/Water navigation and auth behavior PASS.

### Milestone 3 — Wealth core

- account CRUD/archive;
- transaction CRUD;
- INCOME/EXPENSE/TRANSFER;
- account balances;
- monthly/category totals;
- ownership/security negatives.

Exit: Wealth domain test suite PASS.

### Milestone 4 — Obligations + reminder engine

- obligation CRUD;
- all v0.1 recurrence modes;
- 28/56/84-day recharge;
- offsets;
- snooze;
- durable delivery claim/dedupe;
- legacy meal reminder compatibility.

Exit: **Review B PASS**.

### Milestone 5 — Paid/Done + Telegram contract

- Paid/Done/Open/Snooze;
- exactly-once expense creation;
- recurrence advancement;
- safe mocked Telegram message/callback behavior;
- hydration/meal regressions.

Exit: all action/idempotency tests PASS.

### Milestone 6 — Integrated local release candidate

- complete Today aggregation;
- loading/empty/error states;
- browser flows;
- auth/security negatives;
- isolated Docker/dev runtime smoke;
- complete `TEST_MATRIX.md`;
- secret scan;
- `git diff --check`;
- clean branch and evidence.

Exit: **Review C PASS** and `COMPLETE_VERIFICATION_PLAN.md` local gate complete.

### Milestone 7 — PR only

- final push;
- PR against `main`;
- include exact test evidence and deferred items;
- no agent merge;
- no production deployment/migration.

## 10. Explicit v0.1 non-goals

Do not add:

- bank account/API sync;
- bank passwords;
- UPI PIN/OTP/card PIN/CVV storage;
- payment initiation;
- broker integration;
- stock/mutual-fund analytics;
- investment recommendations;
- net-worth engine;
- budgets/advanced savings planning;
- tax computation;
- OCR/statement import;
- multi-currency accounting;
- general task/to-do management;
- replacement of the current meal-analysis backend.

These can become later roadmap items only after v0.1 is stable.

## 11. Release definition

v0.1 is successful when one isolated test user can:

1. see Food and Water on Today;
2. create a bank/cash/wallet/card account;
3. record income and expense;
4. transfer money without changing income/expense totals;
5. create a recurring 84-day recharge obligation;
6. receive distinct 7-day / 1-day / due-day delivery claims without duplicates;
7. mark the recharge Paid;
8. create exactly one optional expense;
9. repeat Paid with no duplicate expense;
10. see next due advance by exactly 84 days;
11. see Today/Wealth/Reminders update;
12. keep existing Food and Water behavior working;
13. pass all local verification gates and final independent Review C.
