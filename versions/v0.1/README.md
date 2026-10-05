# NutriSnap v0.1 — Health + Wealth

Status: **Herdr execution package**

Target branch: `feature/v0.1-health-wealth`

GitHub tracking issue: created for the Herdr execution run.

## Product goal

NutriSnap v0.1 becomes a small personal Health + Wealth hub without breaking the current Food and Water experience.

```text
NutriSnap
├── Today
├── Health
│   ├── Food
│   ├── Water
│   └── Health Reminders
├── Wealth
│   ├── Accounts
│   ├── Transactions
│   └── Bills / Subscriptions / Recharge / EMI
└── Shared Reminders + Telegram
```

The visible v0.1 navigation may remain `Today / Food / Water / Money / Reminders`; Health + Wealth is the product/domain architecture, not a forced navigation redesign.

## Source of truth

Read in this order:

1. `HEALTH_WEALTH_ROADMAP.md` — milestone roadmap and product boundary.
2. `MASTER_PLAN.md` — detailed v0.1 product behavior.
3. `ARCHITECTURE.md` — schema, migration, recurrence, idempotency and ownership design.
4. `HERDR_EXECUTION_PLAN.md` — AGY-Manickam execution workflow and checkpoint rules.
5. `IMPLEMENTATION_CHECKLIST.md` — implementation completeness checklist.
6. `TEST_MATRIX.md` — deterministic functional/security matrix.
7. `COMPLETE_VERIFICATION_PLAN.md` — authoritative mark-as-you-go verification gate.
8. `OPEN_QUESTIONS.md` — blocker/doubt protocol.
9. `STATUS.md` — current resume point and latest verified checkpoint.
10. `HERDR_MASTER_PROMPT.md` — reusable OpenClaw/Herdr AGY-Manickam instruction.

`PAPERCLIP_TASK.md`, `PAPERCLIP_EXECUTION.json`, `CHECKPOINT_RECOVERY.md`, and `PROVIDER_RECOVERY_TESTS.md` are retained as historical planning/control artifacts. They are **not** the active execution path for this branch.

## Execution model

Primary implementation agent: **AGY-Manickam in OpenClaw/Herdr**.

AGY-Manickam may use other agents only for bounded support. It remains responsible for integrating the work, running tests, updating evidence, committing meaningful checkpoints, and pushing this branch.

Independent review gates:

1. Review A — schema / migration / recurrence / authorization foundation.
2. Review B — Wealth + Reminder integration.
3. Review C — final v0.1 local release candidate.

A review failure blocks only the affected phase until repaired and re-reviewed. Do not discard already verified work.

## Development boundary

Use the isolated Omarchy development environment documented in `docs/DEVELOPMENT_BASELINE.md`.

- Local PostgreSQL only.
- Mock health analysis is acceptable for development.
- Telegram remains mocked for the local gate.
- No OpenClaw production DB mutation.
- No production deployment.
- No production Prisma destructive operation.
- No merge to `main` until owner approval.

## Resume rule

The owner may start or resume AGY-Manickam with only:

> Read `versions/v0.1/HERDR_MASTER_PROMPT.md` and `versions/v0.1/STATUS.md`. Continue from the first unfinished phase on `feature/v0.1-health-wealth`. Treat `COMPLETE_VERIFICATION_PLAN.md` as the authoritative verification checklist. Commit and push meaningful verified checkpoints. Do not merge or deploy production.
