# NutriSnap — Shared Agent Memory

This file is the common project memory for **Codex, AGY-Manickam, AGY-Rohit, and any future implementation/review agent** working in this repository.

Do not rely on private agent memory for project state. Re-read this file after a model/agent switch, new session, context reset, or long interruption.

## Active v0.1 execution

- Repository: `MKCyberLabs/NutriSnap`
- Active branch: `feature/v0.1-health-wealth`
- GitHub execution issue: **#131 — NutriSnap v0.1 Health + Wealth — Herdr execution**
- Execution system: **OpenClaw / Herdr**
- Primary lead/orchestrator/integrator: **AGY-Manickam**
- Primary bounded implementation helper: **AGY-Rohit**
- Independent architecture/security/review agent: **Codex**
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
5. `versions/v0.1/HERDR_PANEL_WORKFLOW.md` — split-panel / multi-agent rules.
6. `versions/v0.1/HEALTH_WEALTH_ROADMAP.md` — product milestones.
7. `versions/v0.1/MASTER_PLAN.md` — detailed product scope.
8. `versions/v0.1/ARCHITECTURE.md` — domain/schema/migration rules.
9. `versions/v0.1/IMPLEMENTATION_CHECKLIST.md` — implementation completeness.
10. `versions/v0.1/TEST_MATRIX.md` — deterministic behavior/security tests.
11. `versions/v0.1/COMPLETE_VERIFICATION_PLAN.md` — authoritative mark-as-you-go verification.
12. `versions/v0.1/OPEN_QUESTIONS.md` — `NSV01-Q###` blocker protocol.
13. `docs/DEVELOPMENT_BASELINE.md` — isolated development environment.

For AGY-Manickam long-run execution also read `versions/v0.1/HERDR_MASTER_PROMPT.md` and `versions/v0.1/HERDR_EXECUTION_PLAN.md`.

## Token-efficient role contract

### AGY-Manickam

Primary **lead + orchestrator + integrator + long-running implementer**.

- Own milestone sequencing and integration.
- Keep the main Herdr pane/session.
- Use the larger AGY token budget for normal implementation and orchestration.
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
- Prefer focused implementation/test work that can be independently verified.
- Do not create/switch feature branches unless explicitly instructed.
- Do not invent product/accounting/recurrence/security semantics.
- Run relevant focused tests and `git diff --check`.
- Return exact files changed, tests/results, remaining concerns, and commit SHA when authorized to commit.
- Do not merge, deploy production, or touch owner stashes.

### Codex

Architecture / security / difficult-debugging / independent-review agent.

**Codex is NOT the default orchestrator for v0.1.** Use AGY-Manickam for orchestration to conserve Codex tokens.

Use Codex primarily for:

- Review A / Review B / Review C;
- schema/migration architecture;
- recurrence/idempotency reasoning;
- authorization/security review;
- difficult debugging where a second reasoning pass is valuable;
- a very small isolated repair only when explicitly delegated.

During an independent review Codex is read-only by default.

- Use `versions/v0.1/REVIEW_GUIDE.md` for Review A/B/C.
- Review the actual branch diff and evidence; do not infer runtime PASS from code inspection.
- Verdicts must be explicit: `PASS`, `FAIL`, or `BLOCKED` with actionable findings.
- Do not broadly rewrite implementation during an independent review unless the owner/lead explicitly changes the task from review to repair.

## Herdr split-panel default

Herdr/OpenClaw may run multiple agents in the same overall panel using split panes/tabs.

Default layout:

```text
Pane 1: AGY-Manickam  -> lead/orchestrator/integrator
Pane 2: Codex         -> read-only architecture/review/security when needed
Pane 3: AGY-Rohit     -> bounded implementation/test slice when useful
```

Before opening a second agent pane, AGY-Manickam must record the assignment in `versions/v0.1/AGENT_HANDOFF.md`.

Every secondary pane reads `AGENTS.md`, `AGENT_HANDOFF.md`, `STATUS.md`, `AGENT_SKILLS.md`, and the exact assigned source-of-truth section before acting.

### Concurrency rule

- Read-only review may happen in parallel against an exact pushed SHA.
- Only one agent may write the main worktree at a time.
- If AGY-Manickam and AGY-Rohit must both write concurrently, Rohit must use a separate Git worktree/helper branch and report a commit SHA for AGY-Manickam to inspect/cherry-pick.
- Never let two agents concurrently edit the same files in `/home/openclaw/Projects/NutriSnap`.

The complete procedure is authoritative in `versions/v0.1/HERDR_PANEL_WORKFLOW.md`.

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

The OpenClaw clone contains an owner-controlled historical stash from `main`. The useful September work has already been recovered, validated, committed on `recovery/september-wip`, and integrated into `feature/v0.1-health-wealth`; the original stash remains preserved as a safety copy.

Treat all pre-existing stashes as owner-owned. Do not `stash pop`, `stash apply`, `stash drop`, rewrite, or automatically reuse them without explicit owner instruction.

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
- delegated work still outstanding;
- active split panes and write mode if another agent is running.

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

---

# Repository Guidelines

## Project Structure & Module Organization

The Next.js App Router lives in `src/app`; API handlers are in `src/app/api`, and page components sit beside their routes. Reusable components are in `src/components` (`ui` for shared controls), hooks in `src/hooks`, utilities and database access in `src/lib`, and AI flows in `src/ai`. Prisma schema and seed files live in `prisma/`. Static assets are in `public/`; project and architecture notes are in `docs/`. The image analysis Python service is a separate deployment; this repository calls it through `PYTHON_API_URL`.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile`: install dependencies using the committed lockfile.
- `pnpm exec prisma generate`: generate the Prisma client after schema or dependency changes.
- `pnpm dev`: start Next.js with Turbopack on port 9002.
- `pnpm build` and `pnpm start`: build and serve the production app.
- `pnpm typecheck`: run strict TypeScript checks; `pnpm lint` runs the configured Next.js lint command.
- `pnpm test:analysis-contract`: run the Python response adapter contract test.

For container development, see `SETUP.md` and `docker-compose.dev.yml`. Database changes start in `prisma/schema.prisma`; review schema updates before applying them to a database.

## Coding Style & Naming Conventions

Use TypeScript and TSX with two-space indentation, semicolons, and the existing style in the file you edit; quote style varies across the codebase. Prefer the `@/` alias for imports from `src`. Name React components in PascalCase (`MealCategoryCard.tsx`), hooks with `use` prefixes, and route handlers `route.ts`. Keep shared logic in `src/lib` and validate external payloads with Zod where appropriate. TypeScript `strict` mode is enabled; no repository-wide formatter configuration is present.

## Testing Guidelines

The current automated test uses Node's test runner through `tsx` in `src/lib/python-analysis-response.test.ts`. Place focused tests beside the code as `*.test.ts` or `*.test.tsx`, and add a package script when introducing a new test suite. Run the relevant test command and `pnpm typecheck` for behavior changes. No coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries (`Support structured meal analysis responses`) and, for scoped changes, prefixes such as `feat:` or `perf(react):`. Keep commits focused. In pull requests, describe the behavior changed, affected routes or schema, and commands run; link related issues and include screenshots for visible UI changes.

## Configuration & Security

Keep secrets in ignored `.env` files, never in commits. Document new environment variables and avoid committing user uploads or production data. Follow `docs/AI_PROVIDER_ARCHITECTURE.md` when changing the Python service contract.
