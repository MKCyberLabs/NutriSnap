# NutriSnap Life Hub v0.1 — Implementation Checklist

GitHub Issue: #129
Task branch: `paperclip/gh-129-life-hub-v0.1`

This checklist is execution-oriented. Do not mark a box complete without evidence in the issue/PR or committed test output where applicable.

## 0. Freeze / branch

- [ ] Pull latest `main` with `--ff-only`.
- [ ] Confirm clean worktree before task work.
- [ ] Create `paperclip/gh-129-life-hub-v0.1`.
- [ ] Record baseline `main` SHA.
- [ ] Record current schema snapshot.
- [ ] Run baseline type/contract/build checks that are available.
- [ ] Do not deploy or mutate production data.
- [ ] No merge to `main` until owner approval.

## 1. Architecture / schema gate

### Finance models
- [ ] Add `FinancialAccount` or equivalent.
- [ ] Add Decimal/numeric money fields; no Float for money.
- [ ] Add account type validation: BANK/CASH/WALLET/CREDIT_CARD.
- [ ] Add `FinancialTransaction` or equivalent.
- [ ] Add INCOME/EXPENSE/TRANSFER semantics.
- [ ] Add transfer destination account relation.
- [ ] Add finance category validation.
- [ ] Add `Obligation` or equivalent.
- [ ] Add obligation kind/category.
- [ ] Add optional amount/account/note.
- [ ] Add deterministic recurrence fields.
- [ ] Add `nextDueAt` / occurrence state.

### Reminder model
- [ ] Generalize current Reminder model or replace it through a safe compatibility migration.
- [ ] Remove business dependency on fake finance meal categories.
- [ ] Add domain/type/title.
- [ ] Add recurrence representation.
- [ ] Add durable offsets.
- [ ] Add snooze state.
- [ ] Add optional obligation relation.
- [ ] Preserve meal reminder compatibility.
- [ ] Remove/relax old `[userId, category]` uniqueness only after backfill safety is proven.

### Delivery idempotency
- [ ] Add durable delivery/occurrence model or equivalent.
- [ ] Add unique occurrence+offset+channel identity.
- [ ] Add SENT/ACK/SNOOZED/FAILED state.
- [ ] Ensure process restart cannot blindly resend the same occurrence.

### Migration safety
- [ ] Document schema delta.
- [ ] Add non-production migration/backfill test.
- [ ] Verify legacy reminder row count before/after migration.
- [ ] Verify meal category/time/active values survive.
- [ ] Verify rollback/backup procedure.
- [ ] No production `--accept-data-loss` operation.

### Architecture review
- [ ] Codex-Master reviews schema/migration/idempotency before major UI work.
- [ ] Review PASS recorded.

## 2. Shared Life Hub shell

- [ ] Add shared module registry.
- [ ] Add desktop navigation: Today / Food / Water / Money / Reminders.
- [ ] Add mobile navigation from same registry.
- [ ] Preserve `/dashboard` Food route.
- [ ] Preserve `/hydration` Water route.
- [ ] Add `/today`.
- [ ] Add `/finance`.
- [ ] Add `/reminders`.
- [ ] Preserve auth/onboarding redirects.
- [ ] Keyboard/focus navigation works.
- [ ] Active module state is correct.

## 3. Today page

- [ ] Food summary query scoped to user.
- [ ] Water summary query scoped to user/timezone.
- [ ] Finance monthly summary scoped to user.
- [ ] Upcoming obligation summary.
- [ ] Due-today / upcoming reminder summary.
- [ ] Quick Add launcher.
- [ ] Quick Add Food path.
- [ ] Quick Add Water action/path.
- [ ] Quick Add Expense.
- [ ] Quick Add Income.
- [ ] Quick Add Reminder.
- [ ] Empty-state behavior.
- [ ] Partial-error behavior.
- [ ] Responsive desktop/mobile layout.

## 4. Finance — accounts

- [ ] List user-owned accounts.
- [ ] Create account.
- [ ] Edit account.
- [ ] Archive/deactivate account.
- [ ] Account type validation.
- [ ] Opening balance validation.
- [ ] Optional credit limit validation.
- [ ] Cross-user account access rejected server-side.
- [ ] Current balance calculation tested.

## 5. Finance — transactions

- [ ] Transaction list with date/category/type/account.
- [ ] Add income.
- [ ] Add expense.
- [ ] Add transfer.
- [ ] Edit allowed transaction fields safely.
- [ ] Delete transaction with confirmation.
- [ ] Amount must be > 0.
- [ ] Transfer requires different source/destination accounts.
- [ ] Transfer accounts belong to current user.
- [ ] Transfer excluded from income/expense totals.
- [ ] Monthly income total.
- [ ] Monthly expense total.
- [ ] Category breakdown.
- [ ] Money displayed with INR formatting by default for v0.1.
- [ ] No client-trusted authoritative totals.

## 6. Finance — obligations / bills / subscriptions

- [ ] List upcoming obligations ordered by next due time.
- [ ] Add Recharge.
- [ ] Add Credit Card due.
- [ ] Add generic Bill.
- [ ] Add Subscription.
- [ ] Add Rent.
- [ ] Add EMI.
- [ ] Add Insurance.
- [ ] Add Other.
- [ ] Optional amount.
- [ ] Optional linked account.
- [ ] Notes.
- [ ] Active/disabled state.
- [ ] Edit obligation.
- [ ] Archive/delete behavior defined.
- [ ] ONCE recurrence.
- [ ] DAILY recurrence.
- [ ] WEEKLY recurrence.
- [ ] MONTHLY recurrence.
- [ ] YEARLY recurrence.
- [ ] EVERY_N_DAYS recurrence.
- [ ] 28/56/84-day recharge cases.
- [ ] End-of-month clamp behavior.
- [ ] Leap-year behavior.

## 7. Generic reminder engine

- [ ] HEALTH domain.
- [ ] FINANCE domain.
- [ ] MEAL reminder compatibility.
- [ ] OBLIGATION reminder type.
- [ ] Generic title.
- [ ] Due-day notification.
- [ ] 1-day-before offset.
- [ ] 3-day-before offset.
- [ ] 7-day-before offset.
- [ ] Multiple offsets on one obligation.
- [ ] User timezone evaluation.
- [ ] Snooze persisted durably.
- [ ] Disable/enable reminder.
- [ ] Scheduler uses durable delivery claim before send.
- [ ] Same occurrence is not sent twice.
- [ ] Process restart does not erase dedupe state.

## 8. Mark Done / Paid

- [ ] Health Done/Acknowledge action.
- [ ] Finance Paid action.
- [ ] Paid records occurrence completion.
- [ ] Paid advances recurrence correctly.
- [ ] Optional expense creation.
- [ ] Linked expense references obligation/occurrence.
- [ ] Repeated Paid call is idempotent.
- [ ] Repeated callback cannot create duplicate expense.
- [ ] Paid stale occurrence handled safely.
- [ ] Disabled/archived obligation cannot create unexpected new occurrence.

## 9. Telegram integration

- [ ] Existing bot/webhook behavior preserved.
- [ ] Finance reminder message format added.
- [ ] Paid callback.
- [ ] Done callback.
- [ ] Snooze callback.
- [ ] Open/deep-link callback or URL.
- [ ] Callback resolves user server-side.
- [ ] Cross-user callback rejected.
- [ ] Stale callback produces safe response.
- [ ] Telegram message update/ack is non-fatal if message is already gone.
- [ ] Hydration callback regression test passes.
- [ ] No second finance cron loop introduced.

## 10. Settings / reminder UX migration

- [ ] Existing timezone setting remains source for scheduling.
- [ ] Existing Telegram ID setting remains supported.
- [ ] Health goals remain unchanged.
- [ ] Hydration settings remain unchanged.
- [ ] Existing meal reminder controls either route to new Reminder module or remain compatibility-safe.
- [ ] No duplicate competing reminder settings surfaces with divergent data.

## 11. Security / privacy

- [ ] No bank password field.
- [ ] No UPI PIN field.
- [ ] No card CVV/PIN/OTP field.
- [ ] No broker credential field.
- [ ] Financial resource ownership checked server-side.
- [ ] Reminder resource ownership checked server-side.
- [ ] Transaction/obligation IDs from client are treated as untrusted.
- [ ] Zod/equivalent input validation.
- [ ] Monetary values validated and normalized.
- [ ] Secret scan passes.
- [ ] Logs do not expose tokens/credentials.

## 12. Regression / quality gate

- [ ] Existing `npm run test:analysis-contract` passes.
- [ ] Existing `npm run typecheck` passes.
- [ ] Lint passes or any pre-existing lint-script limitation is documented without hiding new lint errors.
- [ ] `npm run build` passes.
- [ ] New finance tests pass.
- [ ] New recurrence tests pass.
- [ ] New reminder idempotency tests pass.
- [ ] New authorization tests pass.
- [ ] Legacy reminder migration tests pass.
- [ ] Food route smoke test passes.
- [ ] Water route smoke test passes.
- [ ] Today route smoke test passes.
- [ ] Finance route smoke test passes.
- [ ] Reminders route smoke test passes.
- [ ] `git diff --check` passes.
- [ ] secret scan passes.

## 13. Docker / runtime verification

Use non-production/test data.

- [ ] Docker image builds.
- [ ] App starts.
- [ ] Database connectivity works.
- [ ] Existing Food read/write smoke works.
- [ ] Existing Water read/write smoke works.
- [ ] Finance account create/read smoke works.
- [ ] Finance transaction create/read smoke works.
- [ ] Obligation create/read smoke works.
- [ ] Scheduler starts once, not multiple times during build.
- [ ] Mocked/safe reminder occurrence is evaluated once.
- [ ] Health endpoint/home route responds.
- [ ] No production deployment claim unless owner explicitly authorizes it.

## 14. Review checkpoints

- [ ] Review A: schema + migration + security model PASS.
- [ ] Review B: Finance core + reminder engine integration PASS.
- [ ] Review C: final v0.1 PR scope/quality PASS.
- [ ] Each FAIL enters bounded repair/re-review; max 2 negative rounds by default.

## 15. Git completion

- [ ] Only intended task files on task branch.
- [ ] No secrets.
- [ ] Commit messages describe bounded slices.
- [ ] Branch pushed without force.
- [ ] PR opened from `paperclip/gh-129-life-hub-v0.1` to `main`.
- [ ] PR body references Issue #129, Paperclip parent/children/reviews, tests and known risks.
- [ ] PR is not merged by agents.
- [ ] Owner reviews and merges.

## Final release criterion

v0.1 is complete only when the end-to-end scenario passes:

1. user opens Today;
2. Food + Water summaries load correctly;
3. user creates a manual financial account;
4. user records an expense;
5. user creates an 84-day recharge obligation with reminder offsets;
6. scheduler creates only one due notification per offset;
7. user marks it Paid;
8. optional expense is created exactly once;
9. next recharge date advances by 84 days;
10. Today/Finance/Reminders reflect the new state;
11. existing Food and Water remain functional;
12. final Codex-Master verdict is PASS.
