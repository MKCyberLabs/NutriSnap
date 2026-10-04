# NutriSnap Life Hub v0.1 — Master Plan

Status: approved planning baseline for GitHub Issue #129. This document defines the product boundary and implementation phases. Implementation must happen on `paperclip/gh-129-life-hub-v0.1`; `main` remains the owner-controlled baseline.

## 1. Product goal

Turn NutriSnap from a nutrition-only experience into a small personal Life Hub without breaking its existing strengths.

```text
NutriSnap Life Hub
├── Today
├── Food
├── Water
├── Finance
└── Reminders
```

The v0.1 promise is simple:

- understand today's health activity;
- understand today's/month's basic money activity;
- know which obligations are coming up;
- receive timely reminders;
- mark obligations done/paid without duplicating data entry.

## 2. Existing baseline to preserve

The repository already has:

- Next.js App Router UI;
- PostgreSQL + Prisma;
- user authentication/session handling;
- Food dashboard and meal logs;
- Hydration Hub, water goals, hydration logs and hydration schedule;
- per-user timezone;
- Telegram bot/webhook support;
- a background scheduler that runs once per minute;
- meal reminders stored in the current `Reminder` model.

Food and Water are not rewritten in v0.1. They are integrated into a new navigation shell and Today overview while preserving behavior.

## 3. v0.1 page families

### Today
Unified daily home showing:

- Food progress: calories and key macro summary;
- Water progress: consumed vs daily goal;
- Finance summary: current-month income, expense and upcoming obligations;
- Reminders summary: due today / upcoming this week;
- Quick Add: Food, Water, Expense, Income, Reminder.

### Food
Existing `/dashboard` behavior remains functional. Navigation label becomes Food; route compatibility may remain `/dashboard` during v0.1.

### Water
Existing `/hydration` behavior remains functional.

### Finance
Four views:

1. Overview
2. Accounts
3. Transactions
4. Bills & Subscriptions

### Reminders
Generic reminder list/editor for health and finance obligations. Existing meal reminders must be represented without pretending finance reminders are meal categories.

### Settings
Retain existing settings while moving reminder-specific editing to the generic reminder module where appropriate. Health goals, timezone, Telegram ID and hydration settings remain settings concerns.

## 4. Finance v0.1 scope

### Accounts
Manual-first account types:

- BANK
- CASH
- WALLET
- CREDIT_CARD

Required fields:

- name;
- type;
- opening/current balance representation;
- optional institution label;
- optional credit limit for credit-card accounts;
- active/archive state.

Never store banking passwords, UPI PINs, card CVV/PIN, OTPs, session cookies or broker secrets.

### Transactions
Types:

- INCOME
- EXPENSE
- TRANSFER

Default categories:

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

Minimum fields:

- user;
- type;
- amount;
- category;
- transaction date/time;
- account;
- destination account for transfer when applicable;
- optional obligation link;
- note;
- created/updated timestamps.

Transfers must not inflate income or expense totals.

### Bills / subscriptions / obligations
Examples:

- mobile recharge;
- credit-card due;
- electricity bill;
- rent;
- EMI;
- Netflix/YouTube/iCloud/other subscription;
- insurance payment.

Minimum fields:

- title;
- kind/category;
- optional amount;
- due date/time;
- repeat rule;
- reminder offsets;
- optional linked account;
- optional notes;
- active state;
- last paid/completed state;
- next due occurrence.

Mark Paid must be idempotent for one occurrence. It may optionally create one linked expense transaction. Repeated clicks must not create duplicate expenses.

## 5. Generic reminder v0.1 scope

### Domains
- HEALTH
- FINANCE
- GENERAL reserved for later; do not build a broad task manager in v0.1.

### Recurrence
At minimum:

- ONCE
- DAILY
- WEEKLY
- MONTHLY
- YEARLY
- EVERY_N_DAYS

`EVERY_N_DAYS` is required for recharge validity such as 28/56/84 days.

### Reminder offsets
At minimum support:

- due time/day;
- 1 day before;
- 3 days before;
- 7 days before.

Store offsets as data, not hard-coded UI-only state.

### Actions
Reminder notifications must support the semantic actions:

- Done / Paid;
- Snooze;
- Open.

Finance reminders use Paid where appropriate; health reminders use Done/Acknowledge.

### Timezone
All scheduling must evaluate in the user's configured timezone. Do not assume server timezone or IST globally.

## 6. Telegram v0.1

Reuse the existing bot and scheduler foundation.

Required finance reminder message shape:

```text
💳 HDFC Credit Card
₹8,420 due tomorrow

[Paid] [Snooze] [Open]
```

Required behavior:

- no duplicate notification for the same reminder occurrence + offset;
- Paid/Done changes durable state;
- Snooze creates a durable next-attempt timestamp;
- Open provides a safe application link when configured;
- callback handling validates ownership/context and never trusts arbitrary user-supplied IDs.

Do not create a second independent cron engine for Finance.

## 7. Navigation / UX foundation

Desktop target:

```text
NutriSnap | Today | Food | Water | Money | Reminders
```

Mobile target:

```text
Home | Food | Water | Money | Remind
```

Use one shared module registry/navigation definition so desktop and mobile cannot drift independently.

Quick Add must be a reusable surface rather than separate duplicated dialogs on every page.

## 8. Implementation phases

### Phase A — freeze and preflight

- pull latest `main` fast-forward only;
- require clean worktree;
- create `paperclip/gh-129-life-hub-v0.1`;
- run existing contract/type/build checks that are feasible in the clean environment;
- record current schema and relevant existing Food/Water/Reminder behavior;
- no production mutation.

### Phase B — data model and migration safety

- introduce Finance domain models;
- generalize reminder storage without losing existing meal reminder rows;
- remove the current `[userId, category]` assumption only through an explicit migration/backfill strategy;
- add indexes/uniqueness rules required for idempotency;
- add deterministic schema/data tests using an isolated test database or equivalent safe fixture approach;
- never use production `--accept-data-loss` as a development shortcut.

Gate: schema design + migration tests + Codex-Master architecture review PASS before major UI work.

### Phase C — shared Life Hub shell

- shared module navigation;
- Today route/page;
- quick-add launcher;
- Food and Water links preserved;
- mobile/desktop navigation responsive and keyboard accessible.

Gate: Food and Water existing routes still work and auth redirects remain correct.

### Phase D — Finance core

- account CRUD/archive;
- transaction CRUD;
- transfer rules;
- monthly totals;
- category totals;
- Finance overview;
- validation and ownership checks on every server mutation.

Gate: finance-domain unit/integration tests PASS.

### Phase E — obligations and generic reminders

- obligation CRUD;
- recurrence calculation;
- next occurrence calculation;
- generic reminder CRUD;
- migration/backfill of current meal reminders;
- snooze/delivery state;
- scheduler queries due reminder occurrences;
- no duplicate dispatch.

Gate: deterministic recurrence/timezone/idempotency matrix PASS.

### Phase F — Finance ↔ Reminder integration

- create obligation with reminder schedule;
- edit/disable obligation updates reminder behavior;
- mark paid closes one occurrence;
- optional linked expense creation;
- next recurrence advances correctly;
- delete/archive behavior does not orphan unsafe rows.

Gate: end-to-end domain tests PASS.

### Phase G — Telegram integration

- finance reminder messages;
- Paid/Done callback;
- Snooze callback;
- Open callback/deep link;
- ownership and stale-callback handling;
- regression of existing hydration callback behavior.

Gate: mocked Telegram tests PASS; live Telegram sending is a separate environment verification, not assumed by unit tests.

### Phase H — hardening and release candidate

- Today aggregates real Food/Water/Finance/Reminder data;
- loading/empty/error states;
- responsive checks;
- security/authorization tests;
- lint/type/build/test gates;
- Docker build/run smoke verification in a non-production environment;
- final Codex-Master review;
- push branch and open PR;
- no merge until owner approval.

## 9. Non-goals for v0.1

Do not add:

- bank account sync;
- UPI/bank/card credentials;
- broker integration;
- stock or mutual-fund portfolio analytics;
- financial recommendations;
- net-worth engine;
- multi-currency accounting;
- tax computation;
- OCR of statements;
- automated payment initiation;
- general-purpose tasks/to-do management;
- replacement of the current AI meal-analysis backend.

## 10. Release gates

v0.1 is not complete until all are true:

1. Existing Food flow still works.
2. Existing Water flow still works.
3. Today page aggregates all four domains without cross-user data leakage.
4. Finance account/transaction/transfer math is deterministic.
5. Obligation recurrence is deterministic across month/year boundaries.
6. Reminder evaluation is timezone-aware.
7. Scheduler dispatch is idempotent.
8. Mark Paid is idempotent and cannot duplicate a transaction.
9. Existing meal reminder data survives migration.
10. Telegram callback ownership is verified.
11. Typecheck/build/tests pass.
12. Docker smoke verification passes in a safe environment.
13. Secret scan and `git diff --check` pass.
14. Codex-Master final verdict is PASS.
15. PR is open against `main`; owner merge remains pending.

## 11. Definition of v0.1 success

A user can open NutriSnap, see today's health and money picture, manually record money activity, create a recurring bill/subscription/recharge, receive its reminder, mark it paid once, optionally create the corresponding expense, and see the next recurrence — while the existing Food and Water experience remains intact.
