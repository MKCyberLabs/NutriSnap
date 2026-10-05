# NutriSnap Life Hub v0.1 — Provider Interruption and Checkpoint Recovery

GitHub Issue: #129
Task branch: `paperclip/gh-129-life-hub-v0.1`

This file is a mandatory execution contract for long-running Paperclip work. It exists because provider quota exhaustion is an infrastructure interruption, not a product defect.

## Assignment gate

Do **not** assign Issue #129 to Paperclip until the live Paperclip VM has the provider-quota hardening from `MKCyberLabs/paperclip-infra` Issue #7 deployed and verified.

Required infrastructure checkpoint:

`48bfd0a6bc6a6bc8be208d574fe2fc38ea008c46`

Required live verification command from the Paperclip VM's `paperclip-infra` checkout:

```bash
bash scripts/verify-provider-quota-recovery.sh
```

It must PASS before the Life Hub parent is assigned.

## Why this is needed

A provider may return `RESOURCE_EXHAUSTED`, an individual quota limit, insufficient quota, or another usage-limit error while an implementation or review child is active.

That event means:

```text
provider unavailable
!= implementation FAIL
!= review FAIL
!= permission to create a replacement child
```

The correct state is **provider interruption / checkpoint hold**.

## Checkpoint cadence

Long children must not depend on one final commit.

AGY-Rohit should create a meaningful verified Git checkpoint when any of these are true:

1. a bounded sub-slice is complete and its relevant tests are green;
2. before moving from schema/migration work to UI/application work;
3. before moving from Finance core to Reminder integration;
4. after a migration/recurrence/idempotency test cluster becomes green;
5. after a review repair is complete and re-review is about to begin;
6. before a known token-heavy or broad integration pass when there is already verified work worth preserving.

A checkpoint means:

- intended files only;
- deterministic relevant tests run;
- `git diff --check` run before commit;
- descriptive commit message;
- push to the existing task branch when task policy authorizes push.

Do not create meaningless timer-based commits and do not commit red/unverified partial work just to increase checkpoint count.

## What happens when AGY-Rohit quota is exhausted

The Paperclip AGY wrapper should detect the quota-style provider output and invoke the quota-hold helper.

Expected behavior:

1. keep the same Paperclip child;
2. keep the same project workspace;
3. record branch, HEAD and dirty-entry count when available;
4. mark the same child blocked with provider-quota evidence;
5. do not auto-commit the interrupted worktree;
6. do not reset, clean or discard the worktree;
7. do not create another implementation/repair child;
8. do not consume a review-repair round;
9. do not substitute Codex or another agent unless the owner explicitly authorizes it;
10. after quota is available again, Retry the failed run/same task context.

The failed provider run may remain visible as failed in Paperclip. That historical run is evidence; it does not mean the task itself failed.

## What happens when Codex-Master quota is exhausted

A reviewer provider interruption has verdict:

`UNKNOWN`

Never infer PASS or FAIL from adapter failure, timeout, quota exhaustion, missing transcript, or missing final reviewer comment.

Expected state:

```text
Review child still not complete
        ↓
Parent remains blocked on SAME review child
        ↓
Provider recovers
        ↓
Retry SAME review
        ↓
Only explicit PASS/FAIL enters normal CEO logic
```

A provider interruption must not increment the two-round negative review limit.

## AGY-Manickam note

The current Paperclip `manickam` process profile executes the deterministic CEO Node control plane directly rather than invoking AGY for the orchestration transition. Normal AGY provider quota therefore does not control this CEO transition.

The CEO must continue reusing the existing implementation/review child while it is non-terminal.

## Retry vs Resume

For provider quota exhaustion use Paperclip **Retry**, which creates another run with the same task context after the provider becomes available.

Do not use Resume unless Paperclip classifies the failure as `process_lost` and presents Resume for that condition.

## Dirty workspace rule

The quota helper intentionally does not create an emergency Git commit.

Reason: quota can interrupt a write between logically-related edits or before tests run. Automatically committing such state would turn an unknown partial workspace into durable history.

After Retry:

1. inspect current branch and HEAD;
2. inspect `git status --short`;
3. read the preserved diff before changing it;
4. run the relevant checks;
5. continue or repair on the same child;
6. commit only after the state is verified.

## No-replay recovery holds

Paperclip may preserve an execution/no-replay recovery hold when it cannot prove the failed process outcome.

If that occurs:

- use Paperclip's supported recovery-action reconciliation/resolve lifecycle;
- preserve the existing task and assignee;
- never patch Paperclip PostgreSQL directly;
- never bypass the execution hold by creating a replacement parent or replacement child;
- after the hold is reconciled and the provider is available, retry the same task.

## Review round accounting

Only explicit reviewer verdicts count:

- `PASS` / approved -> positive verdict;
- `FAIL` / changes requested -> one negative round;
- provider quota/error/timeout -> UNKNOWN, zero negative rounds.

A quota interruption during a repair also does not create a new repair round. The current repair resumes on the same implementation child.

## Final evidence requirement

The final Issue #129 report must include provider-interruption evidence when any occurred:

- affected agent;
- affected Paperclip child;
- failed run ID;
- preserved checkpoint SHA;
- whether worktree was dirty;
- whether a recovery action required reconciliation;
- same-child Retry result;
- confirmation that no duplicate child or false FAIL was created;
- confirmation that repair-round count was unchanged by the interruption.

If no interruption occurred, report `Provider interruption: none observed`.
