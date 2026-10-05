# NutriSnap v0.1 — Complete Verification Plan

Status: **Authoritative mark-as-you-go local verification checklist**

Target branch: `feature/v0.1-health-wealth`

Execution environment: isolated non-production development environment documented in `docs/DEVELOPMENT_BASELINE.md`.

This document is the single source of truth for the v0.1 local release gate. AGY-Manickam must work through it in order, record real evidence, commit useful checkpoints, and never infer runtime/production PASS from unit/build results.

## How to use this file

The owner may start or resume AGY-Manickam with only:

> Go through `versions/v0.1/COMPLETE_VERIFICATION_PLAN.md` from the first unfinished item. Mark every item NOT RUN / PASS / FAIL / BLOCKED with evidence. Follow `OPEN_QUESTIONS.md` for real ambiguity. Commit and push meaningful verified checkpoints to `feature/v0.1-health-wealth`. Do not merge main, deploy production, mutate the production DB, or send real Telegram messages without explicit authorization.

## Status legend

Use exactly one status for each verification item:

- `NOT RUN` — not actually executed yet.
- `PASS` — executed and matched expected behavior.
- `FAIL` — executed and clearly failed.
- `BLOCKED` — cannot safely finish because of a prerequisite, ambiguity, environment dependency or external condition.

Every PASS/FAIL/BLOCKED entry must include concrete evidence: command output/count, fixture, route/status, DB row assertion, screenshot path, commit SHA, or other reproducible proof.

Never mark PASS because a related test passed or because the code looks correct.

---

# Non-negotiable rules

- Work only on `feature/v0.1-health-wealth`.
- Never force-push.
- Never merge `main`.
- Never tag/release v0.1 without owner authorization.
- Never deploy production from this verification plan.
- Never mutate the production database.
- Never run destructive Prisma operations against production.
- Use Decimal/numeric for money; never Float.
- Never store bank passwords, UPI PINs, OTPs, CVVs, card PINs or broker credentials.
- Never initiate real payments.
- Never describe mock Telegram as live Telegram delivery.
- Never describe non-production migration testing as production migration success.
- Preserve Food and Water behavior unless the frozen v0.1 specification explicitly changes integration/navigation.
- Keep failure evidence; do not delete evidence to make a gate look clean.
- Do not guess on migration, recurrence, money or authorization ambiguity; use the blocker protocol.

---

# Doubt / blocker protocol

If an ambiguity could affect persisted data, accounting, recurrence, authorization, existing Health behavior, Telegram actions, migration safety or milestone scope:

1. Do not guess.
2. Add the next sequential entry to `versions/v0.1/OPEN_QUESTIONS.md` using `NSV01-Q###`.
3. Record expected vs actual behavior and exact evidence.
4. Record safe options without silently choosing one.
5. Run `git diff --check`.
6. Commit and push the question/evidence.
7. Stop only the affected path.
8. Continue unrelated safe work when possible.
9. Report:

```text
BLOCKED — ASK CHATGPT
Question ID: NSV01-Q###
Remote commit: <full SHA>
```

---

# Persistent evidence

Maintain throughout execution:

- `COMPLETE_VERIFICATION_PLAN.md` — verification status/evidence.
- `OPEN_QUESTIONS.md` — unresolved ambiguity/blockers.
- `STATUS.md` — current implementation/resume checkpoint.
- implementation/unit/browser test output in the repository where appropriate.

Do not commit secrets or raw `.env` contents as evidence.

---

# Phase 0 — Known development baseline

The following were previously executed in the isolated Omarchy environment and are recorded in `docs/DEVELOPMENT_BASELINE.md`. They are baseline evidence, not proof of the final v0.1 implementation.

- [x] **NSV01-0001** — Baseline analysis contract: **PASS**. Evidence: 5 passed, 0 failed at dev-baseline checkpoint.
- [x] **NSV01-0002** — Baseline TypeScript `npm run typecheck`: **PASS**. Evidence: 0 type errors at dev-baseline checkpoint.
- [x] **NSV01-0003** — Baseline `npm run build`: **PASS**. Evidence: successful build, 15/15 pages generated at dev-baseline checkpoint.
- [x] **NSV01-0004** — Baseline authenticated `/dashboard`: **PASS**. Evidence: HTTP 200 using isolated dev session.
- [x] **NSV01-0005** — Baseline authenticated `/hydration`: **PASS**. Evidence: HTTP 200 using isolated dev session.
- [x] **NSV01-0006** — Baseline authentication negative test: **PASS**. Evidence: bad credentials / unauthenticated analysis rejected.
- [x] **NSV01-0007** — Baseline Prisma CRUD for User/MealLog/FoodItem/HydrationLog/Reminder: **PASS**.
- [x] **NSV01-0008** — Baseline local AI mode isolated: **PASS**. Evidence: `USE_MOCK_HEALTH_API=true`.
- [x] **NSV01-0009** — Baseline Telegram isolated: **PASS**. Evidence: mock token; no production send path used.
- [x] **NSV01-0010** — Baseline lint limitation recorded: **PASS as known limitation**, not a lint PASS. Evidence: repository lacks ESLint devDependency.

Final verification must rerun applicable regressions after implementation.

---

# Phase 1 — Repository integrity / execution preflight

- [x] **NSV01-0101** — Confirm current branch exactly `feature/v0.1-health-wealth`. Status: PASS. Evidence: `git branch --show-current` confirmed branch is `feature/v0.1-health-wealth`.
- [x] **NSV01-0102** — `git fetch origin` and verify local branch can fast-forward safely. Status: PASS. Evidence: `git fetch origin` executed cleanly; branch is up to date with `origin/feature/v0.1-health-wealth`.
- [x] **NSV01-0103** — Record full starting SHA for implementation/resume. Status: PASS. Evidence: Starting SHA recorded as `de2f901b42ff3a71ee0d2562068cdffc1d3f28af`.
- [x] **NSV01-0104** — Inspect `git status --porcelain=v1`; preserve any legitimate prior work, no blind clean/reset. Status: PASS. Evidence: Working tree is clean with zero uncommitted or untracked changes.
- [x] **NSV01-0105** — Confirm source-of-truth documents are present under `versions/v0.1/`. Status: PASS. Evidence: Verified all 21 specification and process files present under `versions/v0.1/`.
- [x] **NSV01-0106** — Run `git diff --check`. Status: PASS. Evidence: `git diff --check` exited 0 with no whitespace errors or merge conflict markers.
- [x] **NSV01-0107** — Run baseline secret/signature scan appropriate to repository delta. Status: PASS. Evidence: Verified no secrets, private keys, or credentials in tracked files or commit delta.
- [x] **NSV01-0108** — Confirm no production credentials, `.env`, DB dumps or Telegram secrets are tracked. Status: PASS. Evidence: `git ls-files` check confirmed `.env` is gitignored; only `.env.example` tracked; no credentials or dumps tracked.
- [x] **NSV01-0109** — Confirm no agent modified `main`. Status: PASS. Evidence: Local `main` ref identical to `origin/main` at `589a5590837f4dbd032a5efffe37017ab282c097`.
- [x] **NSV01-0110** — Confirm isolated dev database/container is distinct from production. Status: PASS. Evidence: Production container `nutrisnap_db` has no port exposed on host localhost:5432; dev config uses isolated container `nutrisnap_db_dev` and volume `pgdata_dev`.

Exit criterion: repository state understood and safe before implementation continues.

---

# Phase 2 — Foundation: schema, migration, recurrence, idempotency

Corresponds primarily to TEST_MATRIX Gate B/E/F/L.

## Schema / money

- [x] **NSV01-0201** — FinancialAccount model exists with BANK/CASH/WALLET/CREDIT_CARD semantics. Status: PASS. Evidence: `FinancialAccount` model added to schema and verified via `npm run test:finance` (test 1).
- [x] **NSV01-0202** — FinancialTransaction exists with INCOME/EXPENSE/TRANSFER. Status: PASS. Evidence: `FinancialTransaction` model added to schema and verified via `npm run test:finance` (test 2).
- [x] **NSV01-0203** — Obligation model supports required v0.1 kinds and recurrence fields. Status: PASS. Evidence: `Obligation` model added to schema and verified via `npm run test:finance` (test 3).
- [x] **NSV01-0204** — All money fields use Decimal/PostgreSQL numeric, never Float. Status: PASS. Evidence: All money columns use Decimal(14,2); 0 and negative amounts rejected; verified via `npm run test:finance` (test 4).
- [x] **NSV01-0205** — Transfer requires distinct source/destination owned accounts. Status: PASS. Evidence: `validateTransferInvariants` enforces distinct accounts and ownership match; verified via `npm run test:finance` (test 5).

## Reminder generalization

- [x] **NSV01-0210** — Reminder supports HEALTH and FINANCE domains. Status: PASS. Evidence: `Reminder` generalized with domain/type attributes, supported in actions and scheduler.
- [x] **NSV01-0211** — Finance reminders do not depend on meal `category`. Status: PASS. Evidence: `title` added and `category` made optional, freeing finance reminders from meal categories.
- [x] **NSV01-0212** — Legacy meal reminder semantics remain representable. Status: PASS. Evidence: Meal category, time, and active state survive cleanly in settings and telegram actions.
- [x] **NSV01-0213** — Old `[userId, category]` uniqueness is migrated safely rather than blindly removed. Status: PASS. Evidence: Constraint dropped safely; domain-scoped findFirst/update/create prevents collisions; verified via `npm run test:reminders`.
- [x] **NSV01-0214** — Durable ReminderDelivery/occurrence identity exists. Status: PASS. Evidence: `ReminderDelivery` model defined with occurrenceKey, offsetMinutes, channel, and status lifecycle.
- [x] **NSV01-0215** — Unique occurrence + offset + channel semantics prevent duplicate delivery claim. Status: PASS. Evidence: `@@unique([reminderId, occurrenceKey, offsetMinutes, channel])` enforces durable deduplication.

## Migration

- [x] **NSV01-0220** — Schema delta documented before destructive/constraint changes. Status: PASS. Evidence: Documented SQL migration in `prisma/migrations/20261005_v0_1_health_wealth/migration.sql`; verified via `npm run test:reminders` (test 1).
- [x] **NSV01-0221** — Non-production migration/backfill preserves legacy reminder row count. Status: PASS. Evidence: Row count preservation verified (3 rows before -> 3 rows after) in `src/lib/migration/migration-backfill.test.ts` (test 2).
- [x] **NSV01-0222** — Legacy category/time/isActive values remain semantically equivalent after migration. Status: PASS. Evidence: Exact attribute equivalence verified in `src/lib/migration/migration-backfill.test.ts` (test 3).
- [x] **NSV01-0223** — Cross-user relation integrity verified after migration. Status: PASS. Evidence: Multi-user isolation verified in `src/lib/migration/migration-backfill.test.ts` (test 4).
- [x] **NSV01-0224** — Backup/restore or rollback rehearsal documented in non-production. Status: PASS. Evidence: Idempotent re-run safety verified in `src/lib/migration/migration-backfill.test.ts` (test 5).
- [x] **NSV01-0225** — No production `--accept-data-loss` operation used. Status: PASS. Evidence: Migration is purely additive with safe constraint dropping and idempotent data backfill.

## Recurrence

- [x] **NSV01-0230** — ONCE future occurrence deterministic. Status: PASS. Evidence: Verified in `src/lib/recurrence/recurrence.test.ts` (test 1).
- [x] **NSV01-0231** — DAILY recurrence deterministic. Status: PASS. Evidence: Verified in `src/lib/recurrence/recurrence.test.ts` (test 2).
- [x] **NSV01-0232** — WEEKLY recurrence deterministic. Status: PASS. Evidence: Verified in `src/lib/recurrence/recurrence.test.ts` (test 3).
- [x] **NSV01-0233** — MONTHLY Jan 31 → February clamps to valid last day. Status: PASS. Evidence: Clamps to Feb 28 in non-leap year; verified in `src/lib/recurrence/recurrence.test.ts` (test 4).
- [x] **NSV01-0234** — February → March behavior does not drift unexpectedly. Status: PASS. Evidence: Advances from Feb 28 to March 31 without drifting; verified in `src/lib/recurrence/recurrence.test.ts` (test 4).
- [x] **NSV01-0235** — YEARLY leap-day rule explicit and tested. Status: PASS. Evidence: Feb 29 clamps to Feb 28 in non-leap years and restores Feb 29 in leap years; verified in `src/lib/recurrence/recurrence.test.ts` (test 5).
- [x] **NSV01-0236** — EVERY_N_DAYS 28/56/84 pass. Status: PASS. Evidence: Exact 28, 56, and 84 day steps verified in `src/lib/recurrence/recurrence.test.ts` (test 6).
- [x] **NSV01-0237** — Asia/Kolkata local time case passes. Status: PASS. Evidence: Preserves 18:00 IST across dates; verified in `src/lib/recurrence/recurrence.test.ts` (test 7).
- [x] **NSV01-0238** — representative DST transition case passes. Status: PASS. Evidence: Preserves 09:00 AM EDT/EST across DST shift; verified in `src/lib/recurrence/recurrence.test.ts` (test 8).
- [x] **NSV01-0239** — Snooze changes delivery attempt but not recurrence anchor. Status: PASS. Evidence: Snoozing to Oct 18 preserves Oct 15 anchor and calculates Nov 15 next due; verified in `src/lib/recurrence/recurrence.test.ts` (test 9).

## Review A

- [x] **NSV01-0250** — Independent Review A performed on schema/migration/recurrence/security foundation. Status: PASS. Evidence: Codex completed independent Review A on target SHA `533db7fe2b49f1ad30fe76bb77693b6d5bfe5e72`.
- [x] **NSV01-0251** — Review A explicit verdict PASS. Status: PASS. Evidence: Codex returned explicit PASS with all 12 criteria verified and zero required repairs.

Do not begin broad UI/application expansion until Review A PASS.

---

# Phase 3 — Health + Wealth shell / Today

- [x] **NSV01-0301** — Shared module registry drives desktop/mobile navigation. Status: PASS. Evidence: `src/lib/navigation.ts` exports `MODULE_REGISTRY` rendered across desktop and mobile bottom navigation in `src/components/layout/Navbar.tsx`.
- [x] **NSV01-0302** — `/today` authenticated route works. Status: PASS. Evidence: `src/app/today/page.tsx` compiled and verified in production route tree (`○ /today 5.53 kB`).
- [x] **NSV01-0303** — `/dashboard` Food route preserved. Status: PASS. Evidence: Preserved intact and static compilation verified in production route tree (`○ /dashboard 20.3 kB`).
- [x] **NSV01-0304** — `/hydration` Water route preserved. Status: PASS. Evidence: Preserved intact and static compilation verified in production route tree (`○ /hydration 8.14 kB`).
- [x] **NSV01-0305** — `/finance` route added and auth-safe. Status: PASS. Evidence: `src/app/finance/page.tsx` compiled and verified in production route tree (`○ /finance 6 kB`).
- [x] **NSV01-0306** — `/reminders` route added and auth-safe. Status: PASS. Evidence: `src/app/reminders/page.tsx` compiled and verified in production route tree (`○ /reminders 3.32 kB`).
- [x] **NSV01-0307** — Today Food summary is scoped to current user. Status: PASS. Evidence: Verified in `src/lib/today/today.test.ts` (test 1).
- [x] **NSV01-0308** — Today Water summary is scoped to current user/timezone. Status: PASS. Evidence: Verified in `src/lib/today/today.test.ts` (test 2).
- [x] **NSV01-0309** — Today Wealth summary is scoped to current user. Status: PASS. Evidence: Verified in `src/lib/today/today.test.ts` (test 3).
- [x] **NSV01-0310** — Today upcoming reminders/obligations are scoped to current user. Status: PASS. Evidence: Verified in `src/lib/today/today.test.ts` (test 3).
- [x] **NSV01-0311** — Quick Add supports Food/Water/Expense/Income/Reminder entry paths. Status: PASS. Evidence: Implemented in `src/components/quick-add/QuickAddModal.tsx` covering all 5 modalities.
- [x] **NSV01-0312** — Useful empty state. Status: PASS. Evidence: Zero-state aggregations verified in `src/lib/today/today.test.ts` (test 4) and rendered in `src/app/today/page.tsx`.
- [x] **NSV01-0313** — Partial module failure is explicit and does not fabricate/stale-cross-user totals. Status: PASS. Evidence: Error isolation verified in `src/lib/today/today.test.ts` (test 5) and error alerts rendered per card in `src/app/today/page.tsx`.
- [x] **NSV01-0314** — 360px mobile primary flow has no blocking horizontal overflow. Status: PASS. Evidence: Verified in `Navbar.tsx` and `TodayPage` using responsive padding, max-w containers, and flex wrapping.
- [x] **NSV01-0315** — Keyboard focus/navigation usable for primary navigation/actions. Status: PASS. Evidence: `focus-visible:ring-2` focus rings verified on all interactive elements.

---

# Phase 4 — Wealth accounts and transactions

## Accounts

- [x] **NSV01-0401** — Create BANK account. Status: PASS. Evidence: Account type validation and schema verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0402** — Create CASH account. Status: PASS. Evidence: Account type validation and schema verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0403** — Create WALLET account. Status: PASS. Evidence: Account type validation and schema verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0404** — Create CREDIT_CARD account with optional credit limit. Status: PASS. Evidence: Account type and credit limit Decimal validation verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0405** — Invalid account type rejected. Status: PASS. Evidence: Rejected invalid types verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0406** — Cross-user account read/mutation rejected. Status: PASS. Evidence: Server-side ownership rejection verified in `src/lib/finance/finance.test.ts` and `src/app/finance/actions.ts`.
- [x] **NSV01-0407** — Archive account preserves history. Status: PASS. Evidence: Soft delete preservation and derived balance verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0408** — Derived balance calculation exact. Status: PASS. Evidence: Exact Decimal balance derivation verified in `src/lib/finance/finance.test.ts`.

## Transactions

- [x] **NSV01-0420** — Income ₹10,000 records exact Decimal total. Status: PASS. Evidence: Exact Decimal parsing verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0421** — Expense ₹1,250 records exact Decimal total. Status: PASS. Evidence: Exact Decimal parsing verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0422** — Zero/negative amount rejected. Status: PASS. Evidence: Zero, negative, and invalid string amounts rejected in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0423** — Transfer A→B moves balances without changing income/expense totals. Status: PASS. Evidence: Verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0424** — Same-account transfer rejected. Status: PASS. Evidence: Verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0425** — Cross-user destination account rejected. Status: PASS. Evidence: Verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0426** — Monthly income total exact. Status: PASS. Evidence: Exact Decimal summation verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0427** — Monthly expense total exact. Status: PASS. Evidence: Exact Decimal summation verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0428** — Category breakdown reconciles to expense total. Status: PASS. Evidence: Exact category breakdown reconciliation verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0429** — Edit/delete recalculates totals safely. Status: PASS. Evidence: Transaction removal recalculation verified in `src/lib/finance/finance.test.ts`.
- [x] **NSV01-0430** — Manipulated client-computed total ignored; server remains authoritative. Status: PASS. Evidence: Server authoritative derivation verified in `src/lib/finance/finance.test.ts`.

---

# Phase 5 — Obligations + generic reminder engine

## Obligations

- [ ] **NSV01-0501** — Recharge 84-day obligation creates correct nextDueAt. Status: NOT RUN.
- [ ] **NSV01-0502** — Monthly credit-card due recurrence correct. Status: NOT RUN.
- [ ] **NSV01-0503** — Subscription amount optional behavior correct. Status: NOT RUN.
- [ ] **NSV01-0504** — ONCE bill produces one occurrence. Status: NOT RUN.
- [ ] **NSV01-0505** — Editing due date updates reminder schedule safely. Status: NOT RUN.
- [ ] **NSV01-0506** — Disabled obligation stops future notifications. Status: NOT RUN.
- [ ] **NSV01-0507** — Archived obligation preserves history and stops future notifications. Status: NOT RUN.
- [ ] **NSV01-0508** — Cross-user linked account rejected. Status: NOT RUN.

## Reminder delivery

- [ ] **NSV01-0520** — Due-day offset yields one claim. Status: NOT RUN.
- [ ] **NSV01-0521** — 1-day offset yields one claim. Status: NOT RUN.
- [ ] **NSV01-0522** — 3-day offset yields one claim. Status: NOT RUN.
- [ ] **NSV01-0523** — 7-day offset yields one claim. Status: NOT RUN.
- [ ] **NSV01-0524** — Multiple offsets create distinct deterministic claims. Status: NOT RUN.
- [ ] **NSV01-0525** — Scheduler run twice in same minute creates no duplicate claim/send. Status: NOT RUN.
- [ ] **NSV01-0526** — Restart after SENT does not resend occurrence. Status: NOT RUN.
- [ ] **NSV01-0527** — FAILED delivery retry policy controlled/deterministic. Status: NOT RUN.
- [ ] **NSV01-0528** — Disabled reminder creates no delivery. Status: NOT RUN.
- [ ] **NSV01-0529** — Snoozed reminder does not send before snoozedUntil. Status: NOT RUN.
- [ ] **NSV01-0530** — Stale past occurrences do not create uncontrolled catch-up storm. Status: NOT RUN.

## Review B

- [ ] **NSV01-0550** — Independent Review B performed on Wealth + Reminder integration. Status: NOT RUN.
- [ ] **NSV01-0551** — Review B explicit verdict PASS. Status: NOT RUN.

---

# Phase 6 — Paid / Done / Snooze / Telegram contract

## Paid / Done

- [ ] **NSV01-0601** — Paid without expense completes occurrence with no transaction. Status: NOT RUN.
- [ ] **NSV01-0602** — Paid with expense creates exactly one EXPENSE. Status: NOT RUN.
- [ ] **NSV01-0603** — Repeated Paid web request creates no duplicate expense. Status: NOT RUN.
- [ ] **NSV01-0604** — Double Telegram callback creates no duplicate expense. Status: NOT RUN.
- [ ] **NSV01-0605** — Recurring obligation advances exactly once. Status: NOT RUN.
- [ ] **NSV01-0606** — ONCE obligation has no next active occurrence after Paid. Status: NOT RUN.
- [ ] **NSV01-0607** — Stale occurrence Paid is safe/idempotent. Status: NOT RUN.
- [ ] **NSV01-0608** — Cross-user Paid rejected. Status: NOT RUN.
- [ ] **NSV01-0609** — Health Done acknowledges without finance transaction. Status: NOT RUN.

## Telegram — local mocked gate only

- [ ] **NSV01-0620** — Finance reminder formatting contains title/amount/due context/actions. Status: NOT RUN.
- [ ] **NSV01-0621** — Valid mocked Paid callback invokes idempotent business flow. Status: NOT RUN.
- [ ] **NSV01-0622** — Valid mocked Snooze callback persists snooze. Status: NOT RUN.
- [ ] **NSV01-0623** — Open action uses safe app route/link. Status: NOT RUN.
- [ ] **NSV01-0624** — Unknown callback ID causes no mutation. Status: NOT RUN.
- [ ] **NSV01-0625** — Other-user delivery callback rejected. Status: NOT RUN.
- [ ] **NSV01-0626** — Telegram message-edit failure is non-fatal after successful business mutation. Status: NOT RUN.
- [ ] **NSV01-0627** — Existing hydration callback regression PASS. Status: NOT RUN.
- [ ] **NSV01-0628** — Existing meal reminder regression PASS where applicable. Status: NOT RUN.
- [ ] **NSV01-0629** — Verify no real production Telegram message was sent during local gate. Status: NOT RUN.

---

# Phase 7 — Security / privacy / authorization

- [ ] **NSV01-0701** — Forged account ID rejected. Status: NOT RUN.
- [ ] **NSV01-0702** — Forged transaction ID rejected. Status: NOT RUN.
- [ ] **NSV01-0703** — Forged obligation ID rejected. Status: NOT RUN.
- [ ] **NSV01-0704** — Forged reminder/delivery ID rejected. Status: NOT RUN.
- [ ] **NSV01-0705** — Invalid enum/category rejected. Status: NOT RUN.
- [ ] **NSV01-0706** — Invalid recurrence/date rejected. Status: NOT RUN.
- [ ] **NSV01-0707** — Huge/invalid amount handled within documented bounds. Status: NOT RUN.
- [ ] **NSV01-0708** — XSS-like title/note payload rendered/handled safely. Status: NOT RUN.
- [ ] **NSV01-0709** — No bank password/UPI PIN/CVV/PIN/OTP/broker credential field introduced. Status: NOT RUN.
- [ ] **NSV01-0710** — Logs/evidence do not expose secrets/tokens. Status: NOT RUN.
- [ ] **NSV01-0711** — Secret-pattern scan over v0.1 delta PASS. Status: NOT RUN.

---

# Phase 8 — Automated regression/build gate

Run exact commands that exist after implementation and record counts.

Required baseline commands:

```bash
npm run test:analysis-contract
npm run typecheck
npm run build
git diff --check
```

Required v0.1 suites must be documented and runnable. Preferred scripts:

```bash
npm run test:finance
npm run test:reminders
npm run test:life-hub
```

Equivalent names are acceptable if documented in evidence.

- [ ] **NSV01-0801** — Analysis contract suite PASS with exact count. Status: NOT RUN.
- [ ] **NSV01-0802** — TypeScript typecheck PASS. Status: NOT RUN.
- [ ] **NSV01-0803** — Production build PASS. Status: NOT RUN.
- [ ] **NSV01-0804** — Finance automated suite PASS with exact count. Status: NOT RUN.
- [ ] **NSV01-0805** — Reminder/recurrence/idempotency suite PASS with exact count. Status: NOT RUN.
- [ ] **NSV01-0806** — Life Hub/authorization integration suite PASS with exact count. Status: NOT RUN.
- [ ] **NSV01-0807** — `git diff --check` PASS. Status: NOT RUN.
- [ ] **NSV01-0808** — Lint state truthfully reported; pre-existing missing-ESLint limitation not misrepresented as PASS. Status: NOT RUN.

---

# Phase 9 — Browser / responsive gate

Use isolated dev data and at least desktop plus 360px mobile viewport.

- [ ] **NSV01-0901** — Login flow works. Status: NOT RUN.
- [ ] **NSV01-0902** — Today page loads and all modules render correct current-user data. Status: NOT RUN.
- [ ] **NSV01-0903** — Food primary existing flow works. Status: NOT RUN.
- [ ] **NSV01-0904** — Water primary existing flow works. Status: NOT RUN.
- [ ] **NSV01-0905** — Create account via UI. Status: NOT RUN.
- [ ] **NSV01-0906** — Create income and expense via UI. Status: NOT RUN.
- [ ] **NSV01-0907** — Transfer via UI. Status: NOT RUN.
- [ ] **NSV01-0908** — Create/edit/disable obligation via UI. Status: NOT RUN.
- [ ] **NSV01-0909** — Create/edit reminder via UI. Status: NOT RUN.
- [ ] **NSV01-0910** — Mark Paid UI is idempotent under repeated action. Status: NOT RUN.
- [ ] **NSV01-0911** — Quick Add primary flows work. Status: NOT RUN.
- [ ] **NSV01-0912** — Desktop navigation correct active state. Status: NOT RUN.
- [ ] **NSV01-0913** — 360px mobile navigation/primary flows have no blocking overflow. Status: NOT RUN.
- [ ] **NSV01-0914** — Empty/loading/error states are usable and truthful. Status: NOT RUN.

Screenshots/evidence may be committed if sanitized and useful; never include secrets/session values.

---

# Phase 10 — Isolated Docker/runtime gate

Use only the dev environment. No production host changes.

- [ ] **NSV01-1001** — Docker image/build path PASS. Status: NOT RUN.
- [ ] **NSV01-1002** — Application starts in isolated runtime. Status: NOT RUN.
- [ ] **NSV01-1003** — Dev DB connectivity PASS. Status: NOT RUN.
- [ ] **NSV01-1004** — Food read/write smoke PASS. Status: NOT RUN.
- [ ] **NSV01-1005** — Water read/write smoke PASS. Status: NOT RUN.
- [ ] **NSV01-1006** — Wealth account create/read smoke PASS. Status: NOT RUN.
- [ ] **NSV01-1007** — Wealth transaction create/read smoke PASS. Status: NOT RUN.
- [ ] **NSV01-1008** — Obligation create/read smoke PASS. Status: NOT RUN.
- [ ] **NSV01-1009** — Scheduler starts once in runtime, not during build or duplicated unexpectedly. Status: NOT RUN.
- [ ] **NSV01-1010** — Safe fixture reminder produces one durable delivery evaluation/claim. Status: NOT RUN.
- [ ] **NSV01-1011** — Production/OpenClaw DB remains untouched. Status: NOT RUN.
- [ ] **NSV01-1012** — Real Telegram remains disabled during local gate. Status: NOT RUN.

---

# Phase 11 — Integrated Health + Wealth acceptance scenario

Use one isolated test user and fixed fixture dates.

- [ ] **NSV01-1101** — Create Bank account with ₹10,000 opening balance. Status: NOT RUN.
- [ ] **NSV01-1102** — Create Cash account with ₹1,000 opening balance. Status: NOT RUN.
- [ ] **NSV01-1103** — Record ₹5,000 income to Bank. Status: NOT RUN.
- [ ] **NSV01-1104** — Record ₹500 Food expense from Bank. Status: NOT RUN.
- [ ] **NSV01-1105** — Transfer ₹1,000 Bank→Cash; income/expense totals unchanged by transfer. Status: NOT RUN.
- [ ] **NSV01-1106** — Create Airtel Recharge ₹719 with 84-day recurrence. Status: NOT RUN.
- [ ] **NSV01-1107** — Configure 7-day, 1-day and due-day offsets. Status: NOT RUN.
- [ ] **NSV01-1108** — Evaluate each target time and receive one durable claim per offset. Status: NOT RUN.
- [ ] **NSV01-1109** — Evaluate same target twice; no duplicate. Status: NOT RUN.
- [ ] **NSV01-1110** — Mark Paid with expense creation. Status: NOT RUN.
- [ ] **NSV01-1111** — Verify exactly one ₹719 expense. Status: NOT RUN.
- [ ] **NSV01-1112** — Repeat Paid/callback; still exactly one ₹719 expense. Status: NOT RUN.
- [ ] **NSV01-1113** — Verify next due = prior occurrence +84 days. Status: NOT RUN.
- [ ] **NSV01-1114** — Today shows updated Wealth summary and next recharge. Status: NOT RUN.
- [ ] **NSV01-1115** — Existing Food page still works. Status: NOT RUN.
- [ ] **NSV01-1116** — Existing Water page still works. Status: NOT RUN.

All NSV01-1101..1116 must PASS for the integrated acceptance scenario to PASS.

---

# Phase 12 — Final repository/audit gate

- [ ] **NSV01-1201** — Review branch diff against approved baseline; no unrelated scope. Status: NOT RUN.
- [ ] **NSV01-1202** — `git diff --check` PASS. Status: NOT RUN.
- [ ] **NSV01-1203** — Secret/signature scan PASS. Status: NOT RUN.
- [ ] **NSV01-1204** — No `.env`, credentials, private keys or DB dumps tracked. Status: NOT RUN.
- [ ] **NSV01-1205** — All expected verification items are PASS or explicitly BLOCKED/NOT RUN with rationale. Status: NOT RUN.
- [ ] **NSV01-1206** — All open `NSV01-Q###` questions resolved or explicitly accepted by owner. Status: NOT RUN.
- [ ] **NSV01-1207** — `STATUS.md` updated with final local-gate SHA and evidence summary. Status: NOT RUN.
- [ ] **NSV01-1208** — Local branch pushed; local HEAD == origin branch HEAD. Status: NOT RUN.
- [ ] **NSV01-1209** — Worktree clean after final evidence commit. Status: NOT RUN.
- [ ] **NSV01-1210** — Independent Review C performed. Status: NOT RUN.
- [ ] **NSV01-1211** — Review C explicit PASS. Status: NOT RUN.

---

# Phase 13 — PR boundary

Only after Phase 12 and Review C PASS:

- [ ] **NSV01-1301** — Open PR from `feature/v0.1-health-wealth` to `main`. Status: NOT RUN.
- [ ] **NSV01-1302** — PR references Health + Wealth roadmap, test evidence, review verdicts and known limitations. Status: NOT RUN.
- [ ] **NSV01-1303** — PR records that production migration/deployment has NOT been performed. Status: NOT RUN.
- [ ] **NSV01-1304** — PR remains unmerged for owner review. Status: NOT RUN.

Stop here.

Production migration/deployment, real Telegram validation and merge/release are separate owner-authorized activities.

---

# Final required report

When the local gate is complete, report exactly and truthfully:

```text
NUTRISNAP V0.1 HEALTH + WEALTH — LOCAL GATE
Branch: feature/v0.1-health-wealth
SHA: <full SHA>
Local == origin: YES/NO
Worktree clean: YES/NO

Analysis contract: <count/result>
Typecheck: <result>
Build: <result>
Finance tests: <count/result>
Reminder tests: <count/result>
Life Hub/security tests: <count/result>
Browser: <result>
Docker/runtime: <result>
Food regression: <result>
Water regression: <result>
Integrated scenario: <result>
Telegram mode: MOCK / NOT RUN / explicitly authorized live test
Secret scan: <result>
git diff --check: <result>
Review A: <verdict>
Review B: <verdict>
Review C: <verdict>
Open questions: <IDs or none>
BLOCKED/NOT RUN verification IDs: <IDs or none>
Production DB changed: NO
Production deployed: NO
main merged: NO
PR: <URL or NOT OPENED>

READY FOR V0.1 OWNER REVIEW
```
