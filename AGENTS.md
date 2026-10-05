# NutriSnap — Shared Agent Memory

This file is the common project memory for **Codex, AGY-Manickam, AGY-Rohit, and any future implementation/review agent** working in this repository.

Do not rely on private agent memory for project state. Re-read this file after a model/agent switch, new session, context reset, or long interruption.

## Active v0.1 execution

- Repository: `MKCyberLabs/NutriSnap`
- Active branch: `feature/v0.1-health-wealth`
- GitHub execution issue: **#131 — NutriSnap v0.1 Health + Wealth — Herdr execution**
- Execution system: **OpenClaw / Herdr**
- Primary lead: **AGY-Manickam**
- Primary bounded implementation helper: **AGY-Rohit**
- Independent architecture/review agent: **Codex**
- Owner: Manickam; owner retains merge, production, credential and destructive-operation authority.

Paperclip-specific files under `versions/v0.1/` are historical on this branch and do not control execution.

## Product in one minute

NutriSnap v0.1 is a small **Health + Wealth** hub:

```text
NutriSnap
├── Today
├── Health
│   ├── Food
│   ├── Water
│   └── Health Reminders
├── Wealth
│   ├── Accounts
│   ├── Income / Expense / Transfer
│   └── Bills / Subscriptions / Recharge / EMI
└── Shared Reminder Engine + Telegram contract
```

Visible navigation may stay `Today / Food / Water / Money / Reminders`. Do not redesign merely to expose the internal Health/Wealth grouping.

Existing Food and Water behavior are regression-protected and must continue to work.

## Mandatory read order after any agent switch

1. `AGENTS.md` — this common memory.
2. `versions/v0.1/AGENT_HANDOFF.md` — current live resume point.
3. `versions/v0.1/STATUS.md` — milestone/checkpoint status.
4. `versions/v0.1/AGENT_SKILLS.md` — shared operating workflow.
5. `versions/v0.1/HEALTH_WEALTH_ROADMAP.md` — product milestones.
6. `versions/v0.1/MASTER_PLAN.md` — detailed product scope.
7. `versions/v0.1/ARCHITECTURE.md` — domain/schema/migration rules.
8. `versions/v0.1/IMPLEMENTATION_CHECKLIST.md` — implementation completeness.
9. `versions/v0.1/TEST_MATRIX.md` — deterministic behavior/security tests.
10. `versions/v0.1/COMPLETE_VERIFICATION_PLAN.md` — authoritative mark-as-you-go verification.
11. `versions/v0.1/OPEN_QUESTIONS.md` — `NSV01-Q###` blocker protocol.
12. `docs/DEVELOPMENT_BASELINE.md` — isolated development environment.

For AGY-Manickam long-run execution also read `versions/v0.1/HERDR_MASTER_PROMPT.md` and `versions/v0.1/HERDR_EXECUTION_PLAN.md`.

## Role contract

### AGY-Manickam

Primary integrator and long-running Herdr lead.

- Own milestone sequencing and integration.
- May delegate bounded, well-defined slices to AGY-Rohit or Codex.
- Must not delegate the entire milestone and disappear from integration responsibility.
- Runs/collects deterministic evidence before checkpointing.
- Updates `STATUS.md` and `AGENT_HANDOFF.md` after meaningful verified checkpoints.
- Stops major UI work until Review A is explicitly PASS.
- Stops final integration progression when Review B fails.
- Opens/finalizes PR only after Review C PASS.

### AGY-Rohit

Bounded implementation engineer.

- Read this file + `AGENT_HANDOFF.md` before editing.
- Work only on the exact delegated slice.
- Do not create/switch feature branches unless explicitly instructed.
- Do not invent product/accounting/recurrence/security semantics.
- Run relevant focused tests and `git diff --check`.
- Return exact files changed, tests/results, remaining concerns, and commit SHA when authorized to commit.
- Do not merge, deploy production, or touch owner stashes.

### Codex

Architecture/review/debugging agent.

- Use `versions/v0.1/REVIEW_GUIDE.md` for Review A/B/C.
- Review the actual branch diff and evidence; do not infer runtime PASS from code inspection.
- Verdicts must be explicit: `PASS`, `FAIL`, or `BLOCKED` with actionable findings.
- Do not broadly rewrite implementation during an independent review unless the owner/lead explicitly changes the task from review to repair.
- Small isolated repair/debug work is acceptable only when explicitly delegated.

## Current development/runtime boundary

The verified isolated development runtime is documented in `docs/DEVELOPMENT_BASELINE.md`:

- Omarchy workstation dev runtime;
- PostgreSQL 15 dev DB / isolated Docker volume;
- mock health-analysis API;
- mock Telegram token;
- no production database access intended.

OpenClaw is the Herdr/agent workspace. **Do not assume an OpenClaw command proves the Omarchy runtime gate.** Environment-dependent browser/Docker verification must be run in an explicitly isolated non-production runtime and recorded as such.

## Non-negotiable domain invariants

- Money uses Prisma `Decimal` / PostgreSQL numeric, never Float.
- Transaction amount is positive; direction comes from type.
- `TRANSFER` moves value between two different user-owned accounts and must not inflate income or expense totals.
- Every Finance/Reminder mutation verifies authenticated ownership server-side.
- Client-computed totals are never authoritative.
- Finance reminders are not fake meal categories.
- Recurrence is deterministic and timezone-aware.
- `EVERY_N_DAYS` supports 28/56/84-day recharge use cases.
- Monthly end-of-month and Feb-29 behavior must be explicit and tested.
- Reminder delivery is durably idempotent across repeated scheduler runs/restarts.
- `Paid` is occurrence-idempotent; optional linked expense creation happens exactly once.
- Snooze changes the next delivery attempt, not the recurrence anchor.
- Keep one scheduler entry point; do not create a second Finance cron engine.
- Existing Food, Water, meal-reminder and hydration behavior are regression targets.

## Security / safety boundaries

Never add/store or request:

- bank passwords;
- UPI PINs;
- OTPs;
- CVVs;
- card PINs;
- broker credentials.

Never initiate payments or trading.

Without explicit owner approval:

- NO production DB migration;
- NO production deployment;
- NO destructive production Prisma command;
- NO real production-user Telegram send;
- NO merge to `main`;
- NO tag/release;
- NO force push.

## Git rules

Work on `feature/v0.1-health-wealth`.

Before edits:

```bash
git fetch origin
git branch --show-current
git status --short
git rev-parse HEAD
```

Use `git pull --ff-only` when synchronization is safe.

Never use `git reset --hard`, `git clean -fd`, or force-push to solve an unclear workspace state.

### Owner stash warning

The OpenClaw clone may contain a stash created before switching from `main` to this v0.1 branch, containing older September work.

Treat **all pre-existing stashes as owner-owned**. Do not `stash pop`, `stash apply`, `stash drop`, rewrite, or inspect secret-bearing content beyond what is necessary without explicit owner instruction. Never apply an old `main` stash onto `feature/v0.1-health-wealth` automatically.

## Testing rules

Tests are milestone gates, not final cleanup.

Preserve these baseline commands:

```bash
npm run test:analysis-contract
npm run typecheck
npm run build
```

v0.1 must add/document deterministic suites, preferably:

```bash
npm run test:finance
npm run test:reminders
npm run test:life-hub
```

Before meaningful checkpoint commits:

```bash
git diff --check
```

Use `scripts/verify-v01-local.sh` for the final local software gate when its required suites exist.

The pre-existing `npm run lint` limitation is documented in `docs/DEVELOPMENT_BASELINE.md`; do not hide new lint problems, but do not claim the baseline lint script passes when it does not.

## Shared handoff protocol

`versions/v0.1/AGENT_HANDOFF.md` is the common cross-agent resume state.

Before starting work, read it.

After completing a meaningful verified slice, the integrating agent updates it with:

- current milestone/review gate;
- full verified SHA;
- what changed;
- exact tests/results;
- working-tree/remote state;
- next action;
- blockers/open question IDs;
- delegated work still outstanding.

Do not erase useful history; move completed handoff entries into its history section when updating the current state.

`STATUS.md` remains the milestone-level project status; `AGENT_HANDOFF.md` is the short operational baton between agents.

## Doubt protocol

If a real ambiguity affects accounting semantics, schema/migration, recurrence, authorization, Food/Water compatibility, Telegram behavior, data safety, or owner boundaries:

1. do not guess;
2. create the next `NSV01-Q###` entry in `versions/v0.1/OPEN_QUESTIONS.md`;
3. preserve evidence;
4. stop only the affected path;
5. continue unrelated safe work when possible;
6. report the question ID to the owner.

## Definition of good agent behavior

A different agent should be able to continue after reading repo state without needing the previous agent's private memory.

If your work would make that false, update the shared handoff/status/evidence before stopping.
