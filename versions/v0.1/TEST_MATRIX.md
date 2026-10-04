# NutriSnap Life Hub v0.1 — Test Matrix

GitHub Issue: #129

This is the minimum verification matrix for v0.1. A test can be automated unit/integration/browser test or an explicitly documented non-production smoke test. Do not mark environment-dependent checks as automated PASS unless actually executed.

## Gate A — baseline / regression

| ID | Area | Test | Expected |
|---|---|---|---|
| A01 | Food | Existing analysis contract suite | PASS |
| A02 | Build | `npm run typecheck` | PASS |
| A03 | Build | `npm run build` | PASS |
| A04 | Food | `/dashboard` authenticated route smoke | Loads correct user data |
| A05 | Water | `/hydration` authenticated route smoke | Loads correct user data |
| A06 | Auth | unauthenticated protected route | Redirect/reject |
| A07 | Auth | ADMIN/user route behavior | Existing behavior preserved |

## Gate B — schema / migration

| ID | Area | Test | Expected |
|---|---|---|---|
| B01 | Money | monetary fields | Decimal/numeric, never Float |
| B02 | Legacy | migrate existing meal reminder | category/time/active preserved |
| B03 | Legacy | multiple legacy rows | row count preserved |
| B04 | Reminder | old `[userId,category]` constraint transition | generic reminders can coexist safely |
| B05 | Migration | non-production schema upgrade | no unintended row loss |
| B06 | Migration | rollback/restore rehearsal | documented and successful |
| B07 | Ownership | relations after migration | no cross-user links |

## Gate C — finance accounts

| ID | Test | Expected |
|---|---|---|
| C01 | create BANK account | saved for current user |
| C02 | create CASH account | saved |
| C03 | create WALLET account | saved |
| C04 | create CREDIT_CARD account | saved with optional credit limit |
| C05 | invalid account type | rejected |
| C06 | negative/invalid opening balance handling | follows documented validation |
| C07 | user A reads user B account | rejected/not returned |
| C08 | archive account | hidden from active list, history preserved |

## Gate D — transactions and accounting

| ID | Test | Expected |
|---|---|---|
| D01 | add income ₹10,000 | income +10,000 |
| D02 | add expense ₹1,250 | expense +1,250 |
| D03 | zero amount | rejected |
| D04 | negative amount | rejected |
| D05 | transfer ₹2,000 A→B | balances move; income/expense unchanged |
| D06 | transfer same account→same account | rejected |
| D07 | transfer to other user's account | rejected |
| D08 | monthly income total | exact Decimal result |
| D09 | monthly expense total | exact Decimal result |
| D10 | category breakdown | sum equals expense total for range |
| D11 | delete/edit transaction | totals recalculate correctly |
| D12 | client supplies manipulated total | server ignores/recomputes authoritative total |

## Gate E — recurrence engine

| ID | Rule | Case | Expected |
|---|---|---|---|
| E01 | ONCE | future due | one occurrence |
| E02 | DAILY | +1 day | correct local time |
| E03 | WEEKLY | +1 week | same intended weekday/time |
| E04 | MONTHLY | Jan 31 → Feb | clamp to valid final day |
| E05 | MONTHLY | Feb 28/29 → Mar | defined non-drifting behavior |
| E06 | YEARLY | Feb 29 non-leap target | documented deterministic result |
| E07 | EVERY_N_DAYS | 28 | +28 days |
| E08 | EVERY_N_DAYS | 56 | +56 days |
| E09 | EVERY_N_DAYS | 84 | +84 days |
| E10 | Timezone | Asia/Kolkata | expected local due time |
| E11 | Timezone | DST zone transition | no duplicate/missed logical occurrence |
| E12 | Snooze | snooze +30 min | delivery moves; recurrence anchor unchanged |

## Gate F — reminder offsets and delivery dedupe

| ID | Test | Expected |
|---|---|---|
| F01 | due-day only | one delivery claim |
| F02 | 1-day-before | one delivery claim |
| F03 | 3-day-before | one delivery claim |
| F04 | 7-day-before | one delivery claim |
| F05 | all four offsets | four distinct scheduled claims |
| F06 | scheduler runs twice same minute | no duplicate claim/send |
| F07 | process restart after SENT | no duplicate send |
| F08 | FAILED delivery | retry policy deterministic, not duplicate uncontrolled send |
| F09 | disabled reminder | no new delivery |
| F10 | snoozed reminder | no send before snoozedUntil |
| F11 | stale past occurrence | does not create uncontrolled catch-up storm |

## Gate G — obligations

| ID | Test | Expected |
|---|---|---|
| G01 | create recharge 84 days | nextDueAt correct |
| G02 | create credit-card due monthly | nextDueAt correct |
| G03 | create subscription monthly | amount optional/valid |
| G04 | create bill once | one due occurrence |
| G05 | edit due date | reminder schedule reflects change |
| G06 | disable obligation | future notifications stop |
| G07 | archive obligation | history preserved, no future notifications |
| G08 | obligation account belongs to another user | rejected |

## Gate H — Mark Paid / Done idempotency

| ID | Test | Expected |
|---|---|---|
| H01 | Paid without expense creation | occurrence completed, no transaction |
| H02 | Paid with expense creation | exactly one EXPENSE transaction |
| H03 | repeat same Paid request | no second transaction |
| H04 | double Telegram callback | no second transaction |
| H05 | Paid recurring obligation | next occurrence advances once |
| H06 | Paid ONCE obligation | no next active occurrence |
| H07 | stale occurrence Paid | safe idempotent response |
| H08 | other user attempts Paid | rejected |
| H09 | health Done | acknowledged, no finance transaction |

## Gate I — Telegram callbacks

| ID | Test | Expected |
|---|---|---|
| I01 | valid Paid callback | H-flow succeeds |
| I02 | valid Snooze callback | durable snooze |
| I03 | valid Open action | safe route/deep link |
| I04 | unknown callback ID | safe answer, no mutation |
| I05 | callback references other user's delivery | rejected |
| I06 | Telegram message already deleted | business mutation remains correct; edit failure non-fatal |
| I07 | existing hydration callback | regression PASS |
| I08 | existing meal/Telegram flow | regression PASS where applicable |

## Gate J — Today page

| ID | Test | Expected |
|---|---|---|
| J01 | no user data | useful empty states |
| J02 | food only | Food summary correct, other sections empty |
| J03 | water only | Water summary correct |
| J04 | finance data | month income/expense correct |
| J05 | upcoming obligations | correct order/count/amount summary |
| J06 | reminders due today | correct count |
| J07 | user A vs user B | no cross-user aggregate leakage |
| J08 | one module query fails | explicit partial-error state, no fabricated totals |
| J09 | Quick Add expense | finance flow opens/works |
| J10 | Quick Add reminder | reminder flow opens/works |

## Gate K — navigation / responsive / accessibility

| ID | Test | Expected |
|---|---|---|
| K01 | desktop nav | all five modules visible/correct active state |
| K02 | mobile nav | same registry/routes |
| K03 | keyboard navigation | focus visible and usable |
| K04 | deep link `/finance` | auth-safe load |
| K05 | deep link `/reminders` | auth-safe load |
| K06 | Food↔Water navigation | existing state behavior acceptable |
| K07 | mobile 360px width | no blocking horizontal overflow in primary flows |

## Gate L — security

| ID | Test | Expected |
|---|---|---|
| L01 | forged account ID | rejected |
| L02 | forged transaction ID | rejected |
| L03 | forged obligation ID | rejected |
| L04 | forged reminder ID | rejected |
| L05 | invalid category/enum | rejected |
| L06 | invalid date/recurrence interval | rejected |
| L07 | huge/invalid amount | rejected per documented bounds |
| L08 | XSS-like note/title payload | safely rendered/handled |
| L09 | secret-pattern scan | PASS |
| L10 | no sensitive credential fields | PASS |

## Gate M — Docker/runtime smoke

Use non-production/test data only.

| ID | Test | Expected |
|---|---|---|
| M01 | Docker build | PASS |
| M02 | container start | PASS |
| M03 | DB connection | PASS |
| M04 | Food smoke | existing read/write works |
| M05 | Water smoke | existing read/write works |
| M06 | Finance account smoke | create/read works |
| M07 | transaction smoke | create/read works |
| M08 | obligation smoke | create/read works |
| M09 | scheduler startup | starts once outside build |
| M10 | reminder safe fixture | one delivery evaluation/claim |

## Required automated commands

At minimum, final verification should include the repository commands that remain valid plus new suites introduced by v0.1:

```bash
npm run test:analysis-contract
npm run typecheck
npm run build
```

Add dedicated scripts/tests so final verification can run Finance and Reminder suites deterministically, for example:

```text
npm run test:finance
npm run test:reminders
npm run test:life-hub
```

Exact script names may vary, but they must be documented and runnable from a clean developer/test environment.

Also run:

```bash
git diff --check
```

and the repository/Paperclip secret scan if available.

## Final integrated acceptance scenario

Use one isolated test user and deterministic fixture dates:

1. Create Bank account with ₹10,000 opening balance.
2. Create Cash account with ₹1,000 opening balance.
3. Record ₹5,000 income to Bank.
4. Record ₹500 Food expense from Bank.
5. Transfer ₹1,000 Bank → Cash; income/expense totals must not change from transfer.
6. Create Airtel Recharge obligation ₹719 anchored to a known date with 84-day recurrence.
7. Configure 7-day, 1-day and due-day notifications.
8. Evaluate scheduler at each target time; each offset gets one durable delivery only.
9. Run scheduler twice at the same target minute; no duplicate.
10. Mark recharge Paid with expense creation.
11. Verify exactly one ₹719 expense.
12. Repeat Paid callback; still exactly one ₹719 expense.
13. Verify next due date = previous occurrence +84 days.
14. Verify Today shows updated monthly expense and upcoming next recharge.
15. Verify Food and Water existing pages still work.
16. Final Codex-Master verdict PASS.

## Evidence rules

- Automated tests must show exact pass/fail counts.
- Browser/runtime checks must state environment and fixture used.
- Mocked Telegram tests must not be described as live Telegram delivery.
- Non-production DB migration tests must not be described as production migration success.
- A failed gate blocks final PASS until repaired or explicitly waived by owner with rationale.
