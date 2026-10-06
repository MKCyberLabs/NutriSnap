# NutriSnap v0.1 — Health + Wealth

Status: **Herdr execution package**

Target branch: `feature/v0.1-health-wealth`

GitHub execution issue: **#131 — NutriSnap v0.1 Health + Wealth — Herdr execution**

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

## Shared-memory rule

Every agent switch, new session, context reset, or long resume starts with the repo-based shared memory. Private agent memory is never authoritative.

Read in this order:

1. repo root `AGENTS.md` — common memory, role rules, safety and invariants.
2. `AGENT_HANDOFF.md` — current live cross-agent resume baton.
3. `STATUS.md` — milestone/checkpoint state.
4. `AGENT_SKILLS.md` — common Git, delegation, migration, testing and review workflows.
5. `HERDR_PANEL_WORKFLOW.md` — same-panel/split-tab multi-agent workflow and concurrency rules.
6. `HEALTH_WEALTH_ROADMAP.md` — milestone roadmap and product boundary.
7. `MASTER_PLAN.md` — detailed v0.1 product behavior.
8. `ARCHITECTURE.md` — schema, migration, recurrence, idempotency and ownership design.
9. `HERDR_EXECUTION_PLAN.md` — AGY-Manickam execution workflow and checkpoint rules.
10. `IMPLEMENTATION_CHECKLIST.md` — implementation completeness checklist.
11. `TEST_MATRIX.md` — deterministic functional/security matrix.
12. `COMPLETE_VERIFICATION_PLAN.md` — authoritative mark-as-you-go verification gate.
13. `OPEN_QUESTIONS.md` — blocker/doubt protocol.
14. `HERDR_MASTER_PROMPT.md` — reusable OpenClaw/Herdr AGY-Manickam instruction.
15. `docs/DEVELOPMENT_BASELINE.md` — isolated dev environment baseline.

`PAPERCLIP_TASK.md`, `PAPERCLIP_EXECUTION.json`, `CHECKPOINT_RECOVERY.md`, and `PROVIDER_RECOVERY_TESTS.md` are retained as historical planning/control artifacts. They are **not** the active execution path for this branch.

## Execution model

Primary implementation/orchestration agent: **AGY-Manickam in OpenClaw/Herdr**.

Default token-efficient roles:

- **AGY-Manickam** — lead, orchestrator, integrator, long-running implementation.
- **AGY-Rohit** — bounded implementation/testing slices.
- **Codex** — architecture, security, difficult debugging, and independent Review A/B/C; not the default orchestrator.

Herdr may use split panes/tabs. Only one agent may write the main worktree at a time. True parallel writers require separate Git worktrees/helper branches. See `HERDR_PANEL_WORKFLOW.md`.

AGY-Manickam remains responsible for integrating work, running/collecting tests, updating evidence, committing meaningful checkpoints, updating `STATUS.md` + `AGENT_HANDOFF.md`, and pushing this branch.

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

## Owner stash boundary

The useful September WIP has been recovered, validated, and integrated into this feature branch. The original pre-v0.1 `main` stash remains preserved as an owner-controlled safety copy. Do not apply/pop/drop it without explicit owner instruction.

## Resume rule

The owner may start **any** of the three agents with only:

> Read root `AGENTS.md`, then `versions/v0.1/AGENT_HANDOFF.md`, `versions/v0.1/STATUS.md`, `versions/v0.1/AGENT_SKILLS.md`, and `versions/v0.1/HERDR_PANEL_WORKFLOW.md`. Work only on `feature/v0.1-health-wealth`. Continue the exact next action recorded in the handoff within your role. Do not touch owner stashes, merge main, deploy production, or invent missing product semantics.

For AGY-Manickam long-run execution also read `versions/v0.1/HERDR_MASTER_PROMPT.md` completely before continuing.
