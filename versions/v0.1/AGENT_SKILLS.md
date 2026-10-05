# NutriSnap v0.1 — Shared Agent Skills

This file defines reusable project workflows for AGY-Manickam, AGY-Rohit, Codex, and replacement agents. It is repo-based shared context, not private model memory.

## Skill 1 — Recover context safely

Before changing code:

1. read root `AGENTS.md`;
2. read `AGENT_HANDOFF.md`;
3. read `STATUS.md`;
4. confirm branch/worktree/HEAD;
5. inspect recent commits;
6. only then read the milestone-specific product/test files needed for the next action.

Never assume another agent's private memory is still valid.

## Skill 2 — Safe Git continuation

Preferred preflight:

```bash
git fetch origin
git branch --show-current
git status --short
git rev-parse HEAD
git log --oneline --decorate -8
```

If clean and on the expected branch:

```bash
git pull --ff-only origin feature/v0.1-health-wealth
```

Rules:

- no force push;
- no `reset --hard` / `clean -fd` to resolve ambiguity;
- no automatic stash apply/pop/drop;
- never commit unrelated owner WIP;
- checkpoint only coherent verified work;
- run `git diff --check` before checkpoint commits.

## Skill 3 — Bounded delegation

When AGY-Manickam delegates to AGY-Rohit or Codex, the request must include:

- exact objective;
- allowed scope/files;
- source-of-truth document section;
- acceptance tests/evidence;
- what NOT to change;
- starting branch/SHA;
- whether commit/push is authorized.

Avoid `implement v0.1` as a delegated task. Prefer slices such as:

- recurrence pure functions + tests;
- account ownership validation + tests;
- Today read-model query only;
- one review gate against a specific checkpoint.

Record outstanding delegation in `AGENT_HANDOFF.md`.

## Skill 4 — Schema / migration safety

For Prisma/schema changes:

1. inspect existing schema and dev data assumptions;
2. make additive changes first where possible;
3. use Decimal/numeric for money;
4. define ownership relations explicitly;
5. preserve legacy meal reminder data;
6. document/backfill before relaxing old constraints;
7. test migration/backfill on non-production data;
8. verify row counts and semantic preservation;
9. never use production `--accept-data-loss` as a shortcut;
10. production migration remains owner-authorized work after PR review.

Review A must PASS before major UI expansion.

## Skill 5 — Finance correctness

Always test these invariants:

- amount > 0;
- account ownership matches authenticated user;
- transfer source != destination;
- both transfer accounts belong to same authenticated user;
- transfer changes balances but not income/expense totals;
- category/month totals are recomputed server-side;
- archived accounts preserve historical transactions;
- forged client IDs are rejected.

Never trust a client-provided authoritative total.

## Skill 6 — Reminder / recurrence correctness

Prefer pure deterministic recurrence functions independent of Telegram/Prisma where feasible.

Required cases:

- ONCE;
- DAILY;
- WEEKLY;
- MONTHLY 28/29/30/31;
- YEARLY Feb-29 behavior;
- EVERY_N_DAYS 28/56/84;
- Asia/Kolkata;
- representative DST zone;
- snooze without recurrence-anchor mutation.

Delivery rules:

- durable claim before send;
- unique occurrence/offset/channel identity or equivalent;
- repeated scheduler runs must not duplicate;
- process restart must not erase dedupe state;
- Paid/Done operates on occurrence identity;
- optional expense creation is exactly once.

## Skill 7 — Authorization / security testing

For every new Finance/Reminder mutation add negative tests for foreign IDs.

Test at minimum:

- foreign account;
- foreign transaction;
- foreign obligation;
- foreign reminder/delivery;
- stale callback;
- invalid enum/date/amount/recurrence input;
- XSS-like title/note content handling.

Do not add fields for bank passwords, UPI PIN, OTP, CVV, card PIN or broker credentials.

## Skill 8 — Regression discipline

Health features are regression-protected.

Do not mark a new milestone PASS unless relevant existing behavior also passes:

```bash
npm run test:analysis-contract
npm run typecheck
npm run build
```

and the applicable Food/Water/auth/Telegram regression cases in the verification plan.

Final v0.1 should expose runnable suites for:

```bash
npm run test:finance
npm run test:reminders
npm run test:life-hub
```

or deliberately equivalent documented commands.

## Skill 9 — Evidence-first testing

`COMPLETE_VERIFICATION_PLAN.md` is the authoritative mark-as-you-go verification file.

Use only:

- `NOT RUN`;
- `PASS`;
- `FAIL`;
- `BLOCKED`.

For PASS/FAIL/BLOCKED record concrete evidence:

- command;
- pass/fail count;
- fixture/environment;
- browser result;
- DB row/count observation;
- commit SHA;
- screenshot/path where relevant.

Never infer runtime PASS from compilation or source inspection.

## Skill 10 — Review A/B/C

Use `REVIEW_GUIDE.md`.

### Review A

Focus: schema, migration, Decimal money, recurrence, delivery/paid idempotency, ownership/security.

### Review B

Focus: Wealth + obligations/reminder integration, recurrence behavior, dedupe, snooze semantics, Food/Water compatibility.

### Review C

Focus: complete scope, tests/evidence, browser/runtime security, branch cleanliness, PR readiness.

Independent reviewer returns explicit `PASS`, `FAIL`, or `BLOCKED`.

A review agent should not silently become the implementer.

## Skill 11 — Environment separation

OpenClaw/Herdr is the agent workspace. Omarchy is the verified isolated development runtime documented in `docs/DEVELOPMENT_BASELINE.md`.

Do not claim:

- Omarchy Docker PASS from OpenClaw-only commands;
- live Telegram PASS from mocked tests;
- production migration PASS from a dev schema test.

Name the environment in evidence.

## Skill 12 — Blocker protocol

When product semantics or safety are genuinely ambiguous:

1. create next `NSV01-Q###` in `OPEN_QUESTIONS.md`;
2. include exact observation/evidence/options;
3. run `git diff --check` if repository files changed;
4. commit/push the question when useful;
5. stop only the affected path;
6. continue unrelated safe work where possible;
7. report the question ID to the owner.

Do not guess through money, migration, recurrence, auth or production-safety ambiguity.

## Skill 13 — Handoff between agents

Before stopping or switching agents, leave enough repo state that the next agent does not need your private memory.

At a meaningful checkpoint update:

- `AGENT_HANDOFF.md` — operational baton;
- `STATUS.md` — milestone state;
- `COMPLETE_VERIFICATION_PLAN.md` — actual verification evidence;
- `OPEN_QUESTIONS.md` — unresolved ambiguity, if any.

A good handoff states:

- current milestone/review;
- full verified SHA;
- tests/results;
- worktree/remote state;
- exact next action;
- blockers;
- outstanding delegation.
