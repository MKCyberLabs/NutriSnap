# NutriSnap v0.1 — Independent Review Guide

Use this guide for Codex or another independent reviewer. The reviewer must inspect the actual branch/diff/tests; do not accept AGY-Manickam's summary as evidence by itself.

Target branch: `feature/v0.1-health-wealth`

Verdicts must be exactly:

- `PASS`
- `FAIL`
- `BLOCKED`

Provider/tool interruption without an actual review is not PASS or FAIL.

## Common review rules

Before every review:

1. fetch origin;
2. inspect exact target SHA;
3. inspect `git status --short`;
4. read the relevant v0.1 source-of-truth files;
5. inspect the actual diff since the prior approved checkpoint;
6. run or independently validate relevant tests where feasible;
7. identify security/data-loss risks separately from style improvements;
8. do not expand v0.1 scope;
9. do not merge/deploy production.

A FAIL must include bounded actionable findings with file/function/test references.

---

# Review A — Foundation

Review after Milestone 1 only.

Required evidence:

- Prisma schema/model diff;
- migration/backfill strategy and non-production rehearsal;
- recurrence implementation/tests;
- delivery/idempotency implementation/tests;
- ownership/security negative tests where present;
- `git diff --check`;
- exact checkpoint SHA.

Judge:

1. Money uses Decimal/numeric, not Float.
2. FinancialAccount/FinancialTransaction/Obligation relations are coherent.
3. Transfers require distinct owned accounts and do not count as income/expense.
4. Existing meal reminders survive migration/backfill.
5. Generic finance reminders no longer depend on meal category semantics.
6. Monthly end-of-month and leap-year recurrence are deterministic.
7. Every-N-days remains anchored to occurrence, not process restart.
8. Snooze does not mutate recurrence anchor.
9. Delivery identity prevents duplicate occurrence+offset+channel sends.
10. Mark-Paid design can enforce exactly-once optional expense creation.
11. All mutation boundaries can enforce current-user ownership server-side.
12. No destructive production migration path is introduced.

PASS only when the foundation is safe enough for broader UI/application work.

---

# Review B — Wealth + Reminder integration

Review after Milestone 4.

Required evidence:

- account/transaction tests;
- obligations tests;
- recurrence matrix;
- delivery dedupe tests;
- Food/Water reminder regression evidence;
- relevant UI/server-action diff;
- exact checkpoint SHA.

Judge:

1. Account balances and monthly totals are authoritative and exact.
2. Transfers are excluded from income/expense totals.
3. Cross-user IDs are rejected server-side.
4. Obligation recurrence and nextDueAt are deterministic.
5. 28/56/84-day recharge behavior is correct.
6. Multiple reminder offsets produce distinct durable claims.
7. Scheduler cannot duplicate same occurrence when invoked twice/restarted.
8. Disable/archive stops future notifications while preserving history.
9. Snooze is durable and does not alter canonical recurrence.
10. Existing meal reminder and hydration behavior are not broken.
11. Finance reminders are not represented as fake meal categories.

PASS only when Wealth and Reminder Engine can safely support Paid/Telegram integration.

---

# Review C — Final local release candidate

Review after `COMPLETE_VERIFICATION_PLAN.md` local gate is complete.

Read:

- `HEALTH_WEALTH_ROADMAP.md`
- `MASTER_PLAN.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_CHECKLIST.md`
- `TEST_MATRIX.md`
- `COMPLETE_VERIFICATION_PLAN.md`
- `OPEN_QUESTIONS.md`
- `STATUS.md`

Inspect the full branch diff against the approved planning baseline/main as appropriate.

Judge:

1. Scope matches v0.1 Health + Wealth and no major unapproved feature creep exists.
2. Existing Food primary flow still works.
3. Existing Water primary flow still works.
4. Today aggregates only current-user data.
5. Wealth account/transaction math is deterministic.
6. Obligations/recurrence/delivery dedupe are deterministic.
7. Paid/Done/Snooze are idempotent and ownership-safe.
8. Telegram local tests are clearly identified as mocked unless a separate live test was authorized.
9. No bank/payment credentials or payment initiation exist.
10. Security/authorization negative tests are credible.
11. Build/type/tests/browser/runtime evidence is complete and truthful.
12. Lint baseline limitation is not misrepresented.
13. Secret scan and `git diff --check` pass.
14. No production migration/deployment claim is made.
15. No unresolved blocker is silently ignored.
16. Branch is suitable for owner PR review.

PASS means the branch may proceed to PR finalization. It does not authorize production migration, deployment, merge or release.

## Reviewer response template

```text
NUTRISNAP V0.1 REVIEW <A|B|C>
Target branch: feature/v0.1-health-wealth
Target SHA: <full SHA>
Verdict: PASS | FAIL | BLOCKED

Evidence reviewed:
- ...

Findings:
1. ...

Required repairs (FAIL only):
1. ...

Scope/production boundary respected: YES/NO
```
