# NutriSnap Life Hub v0.1 — Architecture

This document is the implementation architecture for GitHub Issue #129. It converts the product plan into boundaries, data ownership, migration rules and service responsibilities.

## 1. Current architecture facts

Current NutriSnap already uses:

- Next.js App Router;
- server actions for authenticated mutations;
- PostgreSQL through Prisma;
- client session helpers plus server-side cookie checks;
- a Telegram webhook;
- one `node-cron` scheduler loop;
- Food models: `MealLog`, `FoodItem`;
- Water models: `HydrationSetting`, `HydrationLog`;
- a meal-shaped `Reminder` model with `userId`, `category`, `time`, `isActive` and unique `[userId, category]`.

The current scheduler interprets reminders as meal reminders and checks `MealLog` before sending. That coupling must be removed for generic reminders.

## 2. Target bounded contexts

```text
User
├── Food
│   ├── MealLog
│   └── FoodItem
├── Water
│   ├── HydrationSetting
│   └── HydrationLog
├── Finance
│   ├── FinancialAccount
│   ├── FinancialTransaction
│   └── Obligation
└── Reminder Engine
    ├── Reminder
    └── ReminderDelivery / occurrence state
```

Rules:

- Food owns meal completion state.
- Water owns hydration completion state.
- Finance owns money/accounting state.
- Reminder Engine owns when/how to notify.
- Obligation links Finance to Reminder Engine; it does not duplicate transaction history.
- Today is a read/aggregation surface, not a new source-of-truth domain.

## 3. Proposed Finance models

Exact Prisma naming may be adjusted during implementation, but behavior must remain equivalent.

### FinancialAccount

Recommended fields:

```text
id
userId
name
type                 BANK | CASH | WALLET | CREDIT_CARD
institution          optional
openingBalance       Decimal
creditLimit          Decimal optional
isActive             Boolean
createdAt
updatedAt
```

Do not persist a derived mutable `currentBalance` unless the implementation proves a consistency-safe strategy. Prefer deriving from opening balance + posted transactions in v0.1, or document a transactional cache if chosen.

Indexes:

- `[userId, isActive]`
- `[userId, type]`

### FinancialTransaction

Recommended fields:

```text
id
userId
type                 INCOME | EXPENSE | TRANSFER
amount               Decimal (> 0)
category             String / validated enum vocabulary
occurredAt           DateTime
accountId            source/primary account
transferAccountId    nullable destination for TRANSFER
obligationId         nullable
note                 nullable
createdAt
updatedAt
```

Rules:

- never represent money amounts as Float;
- use Prisma `Decimal` / PostgreSQL numeric;
- `amount > 0` always; direction comes from type;
- transfer requires two different user-owned accounts;
- transfer is excluded from income/expense totals;
- transaction user/account/obligation ownership must match.

### Obligation

Recommended fields:

```text
id
userId
title
kind                 RECHARGE | CREDIT_CARD | BILL | SUBSCRIPTION | RENT | EMI | INSURANCE | OTHER
amount               Decimal nullable
accountId            nullable
dueAt                 DateTime
recurrenceType       ONCE | DAILY | WEEKLY | MONTHLY | YEARLY | EVERY_N_DAYS
recurrenceInterval   Int nullable
reminderOffsetsMin   Int[] or equivalent durable representation
isActive
notes                 nullable
lastCompletedAt       nullable
nextDueAt
createdAt
updatedAt
```

Rules:

- `nextDueAt` must be deterministic and testable;
- for monthly recurrence, define end-of-month behavior explicitly: clamp to the last valid day rather than drifting unpredictably;
- yearly Feb-29 behavior must be explicit and tested;
- every-N-days is anchored from the relevant occurrence, not from process restart time.

## 4. Generic Reminder model

The existing model is too narrow. Generalize it while preserving current meal reminders.

Recommended target shape:

```text
id
userId
domain               HEALTH | FINANCE
type                 MEAL | GENERIC | OBLIGATION
title
scheduledAt          nullable for recurrence-driven reminders
timeOfDay            nullable
recurrenceType
recurrenceInterval   nullable
activeDays           optional
reminderOffsetsMin   durable list
isActive
obligationId         nullable
mealCategory         nullable
snoozedUntil         nullable
lastTriggeredAt      nullable
createdAt
updatedAt
```

Implementation may keep some compatibility fields temporarily, but the final business API must not require finance reminders to use `category = Netflix`, etc.

The old unique constraint `[userId, category]` must not survive as the generic uniqueness rule.

## 5. Delivery / occurrence idempotency

A scheduler that runs every minute needs durable deduplication.

Preferred design: `ReminderDelivery` or equivalent durable record:

```text
id
userId
reminderId
obligationId         nullable
occurrenceKey
scheduledFor
offsetMinutes
channel              TELEGRAM
status               PENDING | SENT | ACKNOWLEDGED | SNOOZED | FAILED
telegramMessageId    nullable
createdAt
updatedAt
```

Required unique identity:

```text
(reminderId, occurrenceKey, offsetMinutes, channel)
```

or an equivalent deterministic unique key.

Do not rely only on in-memory Maps for finance delivery deduplication. Process restart must not resend a paid bill as a fresh notification.

## 6. Mark Paid transaction boundary

`markObligationPaid(obligationId, occurrenceKey, createExpense)` must behave transactionally.

Required semantics:

1. authenticate user;
2. load obligation and verify ownership;
3. verify the occurrence has not already been completed;
4. if requested and amount/account are available, create exactly one expense linked to this occurrence;
5. record the occurrence completion;
6. calculate next due occurrence;
7. update obligation next due state;
8. acknowledge related delivery records;
9. commit atomically.

Repeated identical calls must return the existing completion result, not create another expense.

Use a durable completion/idempotency key. Do not solve this only in the button UI.

## 7. Reminder recurrence service

Create a pure/testable recurrence module independent of Telegram and Prisma where feasible.

Suggested responsibilities:

```text
getNextOccurrence(rule, anchor, after, timezone)
getOccurrenceKey(reminder/obligation, dueAt)
getNotificationTimes(dueAt, offsets, timezone)
isDue(now, notificationTime, tolerance)
```

The recurrence engine must have deterministic unit tests for:

- daily;
- weekly;
- monthly 28/29/30/31;
- yearly leap year;
- every 28/56/84 days;
- DST/timezone behavior using representative zones;
- Asia/Kolkata timezone;
- snooze overriding the next delivery attempt without changing recurrence anchor.

## 8. Scheduler architecture

Keep one scheduler entry point.

Recommended flow:

```text
cron each minute
  ├── evaluate legacy/migrated health reminders
  ├── evaluate hydration reminders
  └── evaluate generic reminder deliveries
          ↓
      create/claim durable delivery
          ↓
      send Telegram
          ↓
      mark SENT / FAILED
```

Do not send before obtaining the durable idempotency claim.

Scheduler code should delegate domain logic to services rather than becoming one large nested loop.

## 9. Telegram callback architecture

Callback data must be compact and untrusted.

Actions:

- paid/done;
- snooze;
- open.

On callback:

1. identify Telegram user;
2. resolve NutriSnap user;
3. load delivery/reminder/obligation server-side;
4. verify ownership;
5. verify callback state is still actionable;
6. perform idempotent mutation;
7. edit/answer Telegram message safely.

Never encode secret or authoritative amount/account state solely in callback data.

## 10. Today aggregation

Today should use server-side/domain queries to build a view model:

```text
TodaySummary
├── food: calories, protein, goal progress
├── water: ml, goal progress
├── finance: month income, month expense, upcoming total/count
└── reminders: today count, next items
```

No cross-user query may omit `userId` scoping.

The Today page must have explicit loading, empty and partial-failure behavior. One failed module should not silently show another user's or stale global data.

## 11. Navigation architecture

Use one shared module registry, for example conceptually:

```text
[
  { key: today, path: /today },
  { key: food, path: /dashboard },
  { key: water, path: /hydration },
  { key: money, path: /finance },
  { key: reminders, path: /reminders }
]
```

Desktop and mobile render from the same registry.

Do not duplicate auth logic per navigation item.

## 12. Server mutation security

Every finance/reminder server action/API mutation must:

- derive/verify the authenticated session;
- verify resource ownership server-side;
- reject cross-user IDs even if the UI never emits them;
- validate monetary/date/recurrence input with Zod or equivalent;
- never trust client-computed totals;
- avoid logging credentials or sensitive financial notes unnecessarily.

Add negative authorization tests.

## 13. Migration strategy

The repository currently has no committed Prisma migration history. Therefore v0.1 must establish a safer schema-change workflow rather than silently applying destructive `db push` behavior.

Required implementation steps:

1. inspect current schema and a representative non-production database;
2. generate/document the SQL/schema delta;
3. make additive changes first where possible;
4. backfill current meal reminders into the generalized fields;
5. verify row counts and semantic equivalence;
6. only then remove/relax obsolete constraints such as `[userId, category]`;
7. test rollback/backup procedure in non-production;
8. production migration remains an owner-approved deployment action.

No implementation agent may run `prisma db push --accept-data-loss` against production as part of this task.

## 14. Suggested code boundaries

Exact paths may vary, but keep equivalent separation:

```text
src/app/today/
src/app/finance/
src/app/reminders/
src/components/navigation/
src/components/quick-add/
src/lib/finance/
src/lib/reminders/
src/lib/scheduler.ts
prisma/schema.prisma
```

Keep pure domain functions out of oversized page components so they are directly testable.

## 15. Architecture review gate

Before Phase C/D implementation continues, Codex-Master must review:

- final Prisma model diff;
- migration/backfill approach;
- Decimal money representation;
- transfer semantics;
- delivery idempotency key;
- mark-paid idempotency;
- recurrence/end-of-month rules;
- authorization boundaries.

A FAIL returns to bounded repair; do not continue major UI implementation on an unsafe schema design.
