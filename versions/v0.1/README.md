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
- `IMPLEMENTATION_CHECKLIST.md` — execution checklist for implementation and review.
- `TEST_MATRIX.md` — deterministic verification cases and integrated acceptance scenario.
- `PAPERCLIP_TASK.md` — Paperclip decomposition, review gates, Git policy and final evidence requirements.

## Implementation branch

`paperclip/gh-129-life-hub-v0.1`

## Review model

Three explicit gates:

1. Review A — schema/migration/security architecture.
2. Review B — Finance + Reminder domain integration.
3. Review C — final v0.1 integration/release candidate.

Each negative review uses the bounded Paperclip repair/re-review path; default max is two negative rounds.

## Production boundary

The task may implement and test schema/migration artifacts in a safe non-production environment, but production migration/deployment is not implicit. It requires owner approval after the PR is reviewed.

## Owner merge

Agents may push the task branch and open a PR. They must not merge to `main`.
