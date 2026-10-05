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

## Assignment gate — provider recovery must be live first

Before Issue #129 is assigned to Paperclip, the live Paperclip VM must have `MKCyberLabs/paperclip-infra` Issue #7 provider-quota hardening deployed from commit at or after:

`48bfd0a6bc6a6bc8be208d574fe2fc38ea008c46`

On the Paperclip VM the following must PASS:

```bash
bash scripts/verify-provider-quota-recovery.sh
```

If this gate has not passed, do not begin the Life Hub parent.

## Source of truth order

1. GitHub Issue #129
2. `versions/v0.1/MASTER_PLAN.md`
3. `versions/v0.1/ARCHITECTURE.md`
4. `versions/v0.1/CHECKPOINT_RECOVERY.md`
5. `versions/v0.1/IMPLEMENTATION_CHECKLIST.md`
6. `versions/v0.1/TEST_MATRIX.md`
7. `versions/v0.1/PROVIDER_RECOVERY_TESTS.md`
8. existing repository behavior/tests

If two sources conflict, stop the conflicting slice and report it to the parent; do not silently invent a new scope.

## Required orchestration strategy

This milestone is too large for one implementation child. AGY-Manickam must decompose it into bounded sequential/integration slices while keeping one parent Issue #129.

Recommended child sequence:

### Child 1 — Preflight + schema/migration foundation

Owner: AGY-Rohit

Deliver:

- clean task branch based on the committed baseline;
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
- execute the complete product test matrix;
- execute applicable provider-recovery assertions;
- update implementation checklist with evidence references;
- clean task branch.

Then create Codex-Master Review C, the final milestone review.

Review C PASS is required before push/PR completion is declared merge-ready.

## Provider interruption / checkpoint policy

`CHECKPOINT_RECOVERY.md` is mandatory.

### Checkpoint cadence

AGY-Rohit must create meaningful verified checkpoints after bounded green sub-slices, before switching major domains, after migration/recurrence/idempotency clusters become green, and before re-review after a repair. Do not create meaningless timer-based commits and do not auto-commit red/unverified partial work.

### Quota exhaustion is not FAIL

If AGY-Rohit or Codex-Master hits provider quota / `RESOURCE_EXHAUSTED` / usage-limit exhaustion:

- preserve the same child and same workspace;
- provider interruption is not product failure;
- review verdict is `UNKNOWN` unless an explicit PASS/FAIL verdict already exists;
- do not increment the negative review-round count;
- do not create a replacement implementation/review/repair child;
- do not substitute another agent without explicit owner authorization;
- do not reset or discard dirty work;
- do not auto-commit unknown interrupted work;
- use Paperclip Retry on the failed run/same task context after provider capacity returns;
- if a Paperclip no-replay recovery action exists, reconcile/resolve it using the supported recovery lifecycle before retrying; never patch the Paperclip database directly.

The existing parent must remain blocked on the same active implementation/review child while it is interrupted.

### AGY-Manickam

The current Paperclip `manickam` profile executes the deterministic CEO control-plane script directly rather than consuming AGY provider quota for that transition. It must continue to reuse existing non-terminal implementation/review children.

## Bounded repair policy

Use the existing Paperclip bounded FAIL → repair → re-review behavior.

- default max negative review rounds: 2;
- only explicit `FAIL` / changes-requested reviewer verdicts increment the negative count;
- provider interruption/UNKNOWN verdict increments nothing;
- reuse existing implementation/review children where supported;
- do not create duplicate children on heartbeat/retry;
- preserve failed-run evidence;
- missing/ambiguous verdict remains fail-safe.

## Git discipline

The task branch already exists and includes the development baseline:

`paperclip/gh-129-life-hub-v0.1`

Rules:

- do not replace it with `paperclip/gh-129-life-hub-v01` or another branch;
- no direct implementation on `main`;
- no force push;
- do not mix pre-existing unrelated dirty work;
- commit bounded, verified slices with descriptive messages;
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

The current development baseline documents that `npm run lint` is not a valid clean baseline gate because ESLint is absent from upstream devDependencies. Do not spend repair rounds fixing unrelated lint infrastructure unless required by implementation or review; do not hide any new lint-related issue introduced by v0.1.

Add and document deterministic v0.1 test commands for Finance, Reminders and integrated Life Hub behavior. Exact names may vary, but final report must show exact pass counts.

The complete product cases are in `TEST_MATRIX.md`; provider-interruption cases are in `PROVIDER_RECOVERY_TESTS.md`.

## Development/runtime verification

The isolated development runtime is the approved Omarchy development environment documented in `docs/DEVELOPMENT_BASELINE.md`.

Do not turn the Paperclip VM into a second production-like NutriSnap runtime merely to satisfy tests.

Use the approved safe verifier/remote development workflow when integration/runtime evidence is needed. Keep mock health analysis and mock Telegram unless an explicitly isolated integration configuration is approved. Never contact production users or the production database.

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
16. explicit statement that production deployment/migration was or was not performed;
17. provider interruption summary (`none observed` or per-interruption evidence from `CHECKPOINT_RECOVERY.md`);
18. confirmation that provider interruptions created no duplicate child and consumed no repair round.

## Definition of done

The parent Issue #129 is done only when:

- all required v0.1 behavior is implemented;
- all applicable boxes in `IMPLEMENTATION_CHECKLIST.md` are completed with evidence;
- `TEST_MATRIX.md` required gates pass;
- provider recovery policy remains intact;
- Review A, B and C are explicit PASS;
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
5. Provider interruptions/checkpoints
6. Security/privacy
7. Runtime/Docker verification
8. Git branch + final SHA
9. PR
10. Deferred items
11. Owner action required
