# NutriSnap Life Hub v0.1 — Provider Recovery Test Cases

These tests validate orchestration behavior around provider interruption. They complement `TEST_MATRIX.md`; they do not replace product tests.

Do not intentionally exhaust a paid provider account. Use deterministic/synthetic helper tests plus observed real failures when they naturally occur.

## PR — provider interruption matrix

| ID | Scenario | Expected |
|---|---|---|
| PR01 | AGY output contains `RESOURCE_EXHAUSTED` / individual quota reached | current child is parked as provider-quota hold; no product FAIL |
| PR02 | AGY exits non-zero for ordinary code/adapter error without quota markers | not reclassified as quota hold |
| PR03 | active implementation child hits quota | parent remains blocked on the same child; no duplicate implementation child |
| PR04 | task is already `done` or `cancelled` when quota helper runs | terminal issue is never reopened |
| PR05 | issue is already blocked with `[provider-quota-hold:v1]` | helper is idempotent; no unbounded duplicate hold comment |
| PR06 | workspace has uncommitted edits at quota interruption | branch/HEAD/dirty count recorded; helper does not commit/reset/discard edits |
| PR07 | Codex-Master review run hits provider quota before verdict | verdict remains UNKNOWN; zero negative repair rounds consumed |
| PR08 | quota recovers and operator uses Retry | same task/review context is retried; no replacement child |
| PR09 | Retry hits quota again | still same child; no substitution or repair-round increment |
| PR10 | retried implementation completes after quota recovery | normal existing review flow resumes from same parent/child chain |
| PR11 | retried Codex review posts explicit FAIL | exactly one normal negative round begins at that explicit verdict |
| PR12 | retried Codex review posts explicit PASS | parent can continue/complete normally; historical quota run remains audit evidence |
| PR13 | quota hold comment sanitization | no API key, raw provider stderr, credentials or provider payload copied into issue comment |
| PR14 | Paperclip creates a no-replay recovery action | supported reconciliation/resolve path used; no direct DB mutation or replacement task |

## Required infra verification before assignment

On Paperclip VM, from clean `paperclip-infra` main at or after:

`48bfd0a6bc6a6bc8be208d574fe2fc38ea008c46`

run:

```bash
bash scripts/verify-provider-quota-recovery.sh
```

Expected components include:

- `tests/provider-quota-hold.test.mjs` green;
- existing task-binding regression green;
- secret scan green;
- `git diff --check` green;
- deployed `agy-paperclip-run` byte-identical to repository copy;
- deployed `paperclip-provider-quota-hold.mjs` byte-identical to repository copy;
- both deployed helpers executable.

## Live-task assertions during Issue #129

If a real provider interruption happens, record these assertions before continuing:

```text
same parent?               YES
same affected child?       YES
replacement child created? NO
review verdict inferred?   NO
repair count incremented?  NO
workspace preserved?       YES
checkpoint HEAD recorded?  YES
manual/supported Retry?    YES after provider recovery
```

Any `NO` in the safety-preservation expectations above blocks continuation until reconciled.

## Final report

Issue #129 final evidence must include either:

```text
Provider interruption: none observed
```

or, for every observed interruption:

```text
Agent:
Child:
Run ID:
Checkpoint SHA:
Dirty entries at hold:
Recovery action reconciliation required: yes/no
Retry run:
Retry result:
Duplicate child created: no
False PASS/FAIL created: no
Repair-round count changed by quota: no
```
