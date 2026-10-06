# NutriSnap v0.1 — Herdr Execution Plan

Status: **Active execution contract**

Target branch: `feature/v0.1-health-wealth`

Primary execution environment: OpenClaw / Herdr with **AGY-Manickam**.

## 1. Why Herdr is the active path

For v0.1, AGY-Manickam is expected to perform long implementation sessions through the existing CLI-oriented OpenClaw/Herdr workflow. Paperclip-specific orchestration files remain in the repository for history, but they are not authoritative for this branch.

The active execution model is:

```text
Owner
  ↓
AGY-Manickam / Herdr
  ├── inspect
  ├── implement bounded phase
  ├── run deterministic tests
  ├── update verification evidence
  ├── commit + push checkpoint
  └── continue
        ↓
independent Codex review gates
        ↓
owner PR/merge decision
```

## 2. AGY-Manickam responsibilities

AGY-Manickam is the primary implementation lead, not only an orchestrator.

It must:

- work only on `feature/v0.1-health-wealth`;
- read the v0.1 source-of-truth documents before edits;
- inspect current implementation before changing it;
- preserve existing Food and Water behavior;
- implement one milestone at a time;
- run the relevant tests before checkpointing;
- update `STATUS.md` after meaningful progress;
- mark `COMPLETE_VERIFICATION_PLAN.md` only from actual evidence;
- create meaningful commits and push normally;
- never force-push;
- never merge to `main`;
- never mutate production data or deploy production without owner authorization.

## 3. Delegation policy

AGY-Manickam may use AGY-Rohit, Codex-Child, Codex CLI or other existing local helpers only for bounded, clearly scoped support work.

Good delegation examples:

- write focused recurrence unit tests;
- inspect one Prisma relation;
- review one security boundary;
- debug one failing browser flow.

Bad delegation examples:

- hand off the entire milestone and wait blindly;
- create recursive agent chains;
- run competing agents on the same files without coordination;
- ask another agent to merge/release/deploy.

AGY-Manickam remains accountable for integration, tests and evidence.

## 4. Git workflow

Branch:

`feature/v0.1-health-wealth`

Rules:

1. fetch origin before beginning/resuming;
2. switch to the target branch;
3. pull `--ff-only`;
4. inspect `git status --short`;
5. never discard unknown work;
6. stage only intended files;
7. run `git diff --check` before every checkpoint commit;
8. run relevant deterministic tests before claiming checkpoint PASS;
9. use descriptive bounded commits;
10. push normally after meaningful verified checkpoints;
11. never force-push;
12. do not merge `main`.

Suggested checkpoint messages:

- `feat(v0.1): add finance and reminder schema foundation`
- `feat(v0.1): add today health wealth shell`
- `feat(v0.1): implement wealth accounts and transactions`
- `feat(v0.1): add obligations and reminder recurrence`
- `feat(v0.1): add paid and reminder actions`
- `test(v0.1): complete local health wealth verification`

Do not make timer-based or meaningless checkpoint commits. A checkpoint must represent a coherent state worth resuming from.

## 5. Phase execution protocol

For every milestone:

1. read the relevant section of `HEALTH_WEALTH_ROADMAP.md`;
2. read relevant architecture constraints;
3. inspect current code/tests first;
4. update `STATUS.md` to show the active phase if needed;
5. implement the smallest coherent slice;
6. run focused tests immediately;
7. repair failures before broadening scope;
8. run the milestone gate;
9. update `IMPLEMENTATION_CHECKLIST.md` and `COMPLETE_VERIFICATION_PLAN.md` only with evidence;
10. `git diff --check`;
11. inspect staged diff for scope/secrets;
12. commit and push;
13. record full SHA in `STATUS.md`;
14. proceed only if the phase exit criterion is satisfied.

## 6. Review gates

### Review A — foundation

Required before major UI/application work continues.

Review:

- Prisma relations;
- Decimal money representation;
- transfer semantics;
- migration/backfill of existing meal reminders;
- recurrence rules;
- timezone handling;
- durable delivery identity;
- mark-Paid idempotency design;
- server-side ownership boundaries.

Verdict must be explicit: `PASS` or `FAIL`.

On `FAIL`, repair only the findings, rerun relevant tests and re-review. Do not erase valid checkpoint history.

### Review B — Wealth + Reminder integration

Required after obligations/reminder engine.

Review:

- accounts/transactions/obligations relationship;
- generic reminders vs legacy meal reminders;
- recurrence/next-due correctness;
- durable dedupe;
- snooze semantics;
- disabled/archive behavior;
- user ownership;
- Food/Water regressions.

### Review C — local release candidate

Required after the complete local verification plan.

Review:

- full branch diff against baseline;
- all required tests/evidence;
- auth/privacy/security negatives;
- Today integration;
- Wealth calculations;
- reminder idempotency;
- mock Telegram behavior;
- isolated Docker/dev runtime;
- known limitations/deferred items;
- branch suitability for PR.

Do not open the final PR as release-ready until Review C PASS.

## 7. Testing strategy

Testing is not a final cleanup activity. Tests are phase gates.

### Fast loop

Run focused unit/type tests after each coherent change.

### Milestone loop

At the end of each milestone run the relevant stable IDs from `TEST_MATRIX.md`.

### Local release gate

Run `COMPLETE_VERIFICATION_PLAN.md` from the first unfinished item. Every item must end as exactly one of:

- NOT RUN
- PASS
- FAIL
- BLOCKED

Every PASS/FAIL/BLOCKED needs evidence.

### Baseline commands

The current repository baseline already supports:

```bash
npm run test:analysis-contract
npm run typecheck
npm run build
```

v0.1 must add deterministic finance/reminder/life-hub test scripts or equivalent documented commands.

`npm run lint` is a known baseline limitation because ESLint is absent from devDependencies. Do not hide new lint defects, but do not claim the pre-existing lint command is a valid gate until it is intentionally repaired.

## 8. Local development environment

Use `docs/DEVELOPMENT_BASELINE.md` as the environment reference.

Expected isolated development resources:

- Omarchy workstation;
- Next.js dev runtime on localhost:3000;
- PostgreSQL 15 dev container;
- isolated dev volume;
- `USE_MOCK_HEALTH_API=true`;
- mock Telegram token;
- no production DB route/credential dependency.

If AGY-Manickam works from OpenClaw, it may edit/push the repository there, but environment-dependent integration evidence must come from the isolated dev environment or another explicitly safe non-production environment. Do not describe a compile/unit test as a runtime PASS.

## 9. Production safety boundary

Never perform as part of this execution run:

- production schema migration;
- `prisma db push --accept-data-loss` against production;
- production database reset/delete;
- real bank/payment integration;
- real Telegram message sends to production users without owner authorization;
- OpenClaw production application redeploy;
- main merge;
- release/tag.

When local verification is complete, stop at PR-ready state.

## 10. Doubt/blocker protocol

A real ambiguity is anything that could change:

- persisted data semantics;
- migration safety;
- recurrence behavior;
- money/accounting behavior;
- authorization/security;
- existing Food/Water behavior;
- Telegram ownership/action behavior;
- production safety;
- milestone scope.

When one appears:

1. do not guess;
2. open/update `OPEN_QUESTIONS.md`;
3. allocate next `NSV01-Q###` ID;
4. include evidence and safe options;
5. commit and push the question/evidence;
6. stop only the affected path;
7. continue independent safe work where possible;
8. report `BLOCKED — ASK CHATGPT`, question ID and remote SHA.

## 11. Resume protocol

After interruption, reboot, quota limit, CLI exit or context loss:

1. `git fetch origin`;
2. `git switch feature/v0.1-health-wealth`;
3. `git pull --ff-only`;
4. inspect `git status --short`;
5. read `versions/v0.1/STATUS.md`;
6. read the latest completed/active phase in `COMPLETE_VERIFICATION_PLAN.md`;
7. inspect the last checkpoint diff/commit;
8. continue from the first unfinished item;
9. never restart from scratch unless the owner explicitly requests it.

## 12. Final completion report

AGY-Manickam must finish the local milestone with:

- branch name;
- full SHA;
- clean/local==origin status;
- milestone completion summary;
- exact automated test commands and counts;
- Review A/B/C verdicts;
- migration/backfill evidence;
- Food regression result;
- Water regression result;
- Wealth integrated scenario result;
- reminder recurrence/dedupe/idempotency result;
- browser/runtime result;
- Docker/dev result;
- Telegram test mode used;
- secret scan result;
- `git diff --check` result;
- all BLOCKED/NOT RUN IDs;
- PR URL if created;
- explicit statement that production was not deployed/migrated and `main` was not merged.
