# NutriSnap Life Hub v0.1

Planning baseline for GitHub Issue #129.

## Goal

Deliver the first Life Hub milestone without breaking existing Food and Water features:

```text
Today + Food + Water + Finance + Generic Reminders
```

## Files

- `MASTER_PLAN.md` — product scope, phases, non-goals and release gates.
- `ARCHITECTURE.md` — domain boundaries, proposed schema, migration safety, recurrence and idempotency design.
- `CHECKPOINT_RECOVERY.md` — mandatory provider-quota interruption, checkpoint and same-task retry contract.
- `IMPLEMENTATION_CHECKLIST.md` — execution checklist for implementation and review.
- `TEST_MATRIX.md` — deterministic product verification cases and integrated acceptance scenario.
- `PROVIDER_RECOVERY_TESTS.md` — deterministic orchestration/recovery cases for quota interruption.
- `PAPERCLIP_TASK.md` — Paperclip decomposition, review gates, Git policy and final evidence requirements.

## Implementation branch

`paperclip/gh-129-life-hub-v0.1`

## Assignment gate

Do not assign the Life Hub parent until the live Paperclip VM has the provider-quota hardening from `MKCyberLabs/paperclip-infra` Issue #7 deployed and:

```bash
bash scripts/verify-provider-quota-recovery.sh
```

passes from a clean `paperclip-infra` checkout at or after commit:

`48bfd0a6bc6a6bc8be208d574fe2fc38ea008c46`

## Review model

Three explicit gates:

1. Review A — schema/migration/security architecture.
2. Review B — Finance + Reminder domain integration.
3. Review C — final v0.1 integration/release candidate.

Each explicit negative review uses the bounded Paperclip repair/re-review path; default max is two negative rounds.

Provider interruption is not a negative review. Quota exhaustion, adapter timeout or provider failure without an explicit reviewer verdict is `UNKNOWN` and must resume/retry on the same child according to `CHECKPOINT_RECOVERY.md`.

## Production boundary

The task may implement and test schema/migration artifacts in a safe non-production environment, but production migration/deployment is not implicit. It requires owner approval after the PR is reviewed.

## Owner merge

Agents may push the task branch and open a PR. They must not merge to `main`.
