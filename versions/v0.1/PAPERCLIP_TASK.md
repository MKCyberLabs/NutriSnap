# NutriSnap Life Hub v0.1 — Paperclip Task

GitHub Issue: #129
Task branch: `paperclip/gh-129-life-hub-v0.1`
Owner merge required: yes

## Mission

Implement NutriSnap Life Hub v0.1 from the committed planning package under `versions/v0.1/`.

The goal is not to add random pages. Deliver one coherent product milestone:

```text
Today + existing Food + existing Water + Finance + Generic Reminders
```

Finance and Reminders are intentionally designed together: a bill/subscription/recharge can create reminders, a reminder can be marked Paid, Paid may create exactly one expense, and recurring obligations advance deterministically.

## Source of truth order

1. GitHub Issue #129
2. `versions/v0.1/MASTER_PLAN.md`
3. `versions/v0.1/ARCHITECTURE.md`
4. `versions/v0.1/IMPLEMENTATION_CHECKLIST.md`
5. `versions/v0.1/TEST_MATRIX.md`
6. existing repository behavior/tests

If two sources conflict, stop the conflicting slice and report it to the parent; do not silently invent a new scope.

## Required orchestration strategy

This milestone is too large for one implementation child. AGY-Manickam must decompose it into bounded sequential/integration slices while keeping one parent Issue #129.

Recommended child sequence:

### Child 1 — Preflight + schema/migration foundation

Owner: AGY-Rohit

Deliver:

- clean branch from latest main;
- baseline checks;
- Finance Prisma models;
- generalized reminder model/delivery idempotency model;
- safe legacy meal-reminder migration/backfill strategy;
- recurrence pure functions and initial tests;
- no major UI yet.

Then create Codex-Master Review A.

Review A must explicitly judge:

- Decimal money representation;
- account/transaction/obligation relations;
- transfer rules;
- reminder migration safety;
- recurrence semantics;
- delivery idempotency;
- mark-paid idempotency design;
- authorization boundaries.

Do not proceed to major UI until Review A PASS.

### Child 2 — Life Hub shell + Today

Owner: AGY-Rohit

Deliver:

- shared module registry;
- desktop/mobile navigation;
- `/today`;
- Today read model;
- Quick Add shell;
- preserve existing Food `/dashboard` and Water `/hydration` behavior;
- route/auth regression tests.

No Finance accounting shortcuts in this slice.

### Child 3 — Finance core

Owner: AGY-Rohit

Deliver:

- Accounts UI/actions;
- Transactions UI/actions;
- INCOME/EXPENSE/TRANSFER behavior;
- monthly totals/category summary;
- ownership validation;
- finance tests.

### Child 4 — Obligations + generic reminder engine

Owner: AGY-Rohit

Deliver:

- Bills/Subscriptions/Recharge/other obligation CRUD;
- recurrence and next-due behavior;
- generic reminder CRUD;
- offsets;
- durable scheduler delivery dedupe;
- snooze;
- compatibility with existing meal reminders;
- reminder tests.

Then create Codex-Master Review B for integrated Finance + Reminder domain logic.

Do not continue to Telegram integration unless Review B PASS.

### Child 5 — Finance ↔ Reminder actions + Telegram

Owner: AGY-Rohit

Deliver:

- Paid/Done/Open/Snooze behavior;
- Paid occurrence completion;
- optional exactly-once expense creation;
- next recurrence advance;
- finance Telegram reminder formatting;
- callback ownership validation;
- existing hydration/meal Telegram regression coverage.

### Child 6 — Final integration / hardening

Owner: AGY-Rohit

Deliver:

- complete Today aggregation;
- empty/loading/error states;
- responsive/mobile checks;
- security negative tests;
- Docker/non-production smoke checks;
- execute the complete test matrix;
- update implementation checklist with evidence references;
- clean task branch.

Then create Codex-Master Review C, the final milestone review.

Review C PASS is required before push/PR completion is declared merge-ready.

## Bounded repair policy

Use the existing Paperclip bounded FAIL → repair → re-review behavior.

- default max negative review rounds: 2;
- reuse existing implementation/review children where supported;
- do not create duplicate children on heartbeat/retry;
- preserve failed-run evidence;
- missing/ambiguous verdict remains fail-safe.

## Git discipline

Before implementation:

```text
main -> paperclip/gh-129-life-hub-v0.1
```

Rules:

- no direct implementation on `main`;
- no force push;
- do not mix pre-existing unrelated dirty work;
- commit bounded slices with descriptive messages;
- stage intended files only;
- run `git diff --check` before commits/PR;
- run secret scan before push;
- push only task branch;
- PR target is `main`;
- agents do not merge.

## Data / production safety

This task may change schema code and migration artifacts, but it may not silently mutate the production database.

Never:

- run destructive production `prisma db push --accept-data-loss`;
- delete existing production reminder rows;
- reset production DB;
- copy production secrets into fixtures;
- store bank passwords, UPI PINs, CVV/PIN/OTP or broker credentials;
- initiate real financial payments;
- provide investment advice.

Production migration/deployment is a separate owner-approved action after PR review.

## Implementation rules

### Money

- monetary amounts use Decimal/numeric, not Float;
- amount is positive; transaction type determines direction;
- transfer is not income or expense;
- all account/resource ownership is verified server-side;
- current totals are computed deterministically.

### Reminders

- finance reminders are not fake meal categories;
- recurrence is pure/testable where feasible;
- timezone is user-specific;
- notification dedupe is durable;
- process restart must not duplicate one occurrence;
- snooze does not move the recurrence anchor.

### Paid

- Paid/Done is idempotent;
- optional expense creation is exactly once for one occurrence;
- repeated web/Telegram actions must not duplicate expense;
- next occurrence advances exactly once.

### Existing modules

Do not regress:

- Food dashboard/logging;
- Water dashboard/logging;
- hydration scheduling;
- auth/onboarding behavior;
- Telegram meal/hydration behavior;
- AI analysis contract.

## Verification commands

Use existing valid commands:

```bash
npm run test:analysis-contract
npm run typecheck
npm run build
git diff --check
```

Add and document deterministic v0.1 test commands for Finance, Reminders and integrated Life Hub behavior. Exact names may vary, but final report must show exact pass counts.

The complete required cases are in `TEST_MATRIX.md`.

## Minimum final evidence

Final parent completion must report:

1. baseline main SHA;
2. task branch;
3. exact Prisma/schema/migration files changed;
4. legacy reminder migration result in non-production tests;
5. exact automated test commands and pass counts;
6. recurrence/idempotency test counts;
7. authorization/security negative-test counts;
8. Food/Water regression results;
9. Docker/runtime smoke environment and results;
10. Review A verdict;
11. Review B verdict;
12. Review C final verdict;
13. final branch commit SHA;
14. PR number and URL;
15. known risks / deferred v0.2 items;
16. explicit statement that production deployment/migration was or was not performed.

## Definition of done

The parent Issue #129 is done only when:

- all required v0.1 behavior is implemented;
- all applicable boxes in `IMPLEMENTATION_CHECKLIST.md` are completed with evidence;
- `TEST_MATRIX.md` required gates pass;
- Review A, B and C are PASS;
- task branch is pushed cleanly;
- PR is open against `main`;
- PR is not merged;
- owner action is only final review/merge and separately approved production rollout.

## Final response format for AGY-Manickam

Return a concise completion report with these headings only:

1. Scope delivered
2. Architecture/migration
3. Tests and counts
4. Review verdicts
5. Security/privacy
6. Runtime/Docker verification
7. Git branch + final SHA
8. PR
9. Deferred items
10. Owner action required
