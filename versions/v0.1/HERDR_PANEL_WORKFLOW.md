# NutriSnap v0.1 — Herdr Split-Panel Multi-Agent Workflow

This file defines how AGY-Manickam, AGY-Rohit, and Codex may work in the same Herdr/OpenClaw panel without losing context or corrupting Git state.

## Default roles

### Pane 1 — AGY-Manickam

**Lead / orchestrator / integrator / primary long-running implementer.**

AGY-Manickam owns:

- reading and maintaining the shared repo memory;
- milestone sequencing;
- deciding when bounded parallel help is useful;
- integrating accepted work;
- running/collecting checkpoint evidence;
- updating `AGENT_HANDOFF.md`, `STATUS.md`, and verification evidence;
- final branch cleanliness and push.

AGY-Manickam remains responsible even when another pane is working.

### Pane 2 — Codex

**Architecture / security / difficult debugging / independent reviewer by default.**

Codex is NOT the default orchestrator for v0.1.

Use Codex for:

- Review A / Review B / Review C;
- schema/migration architecture review;
- recurrence/idempotency reasoning;
- authorization/security review;
- difficult debugging where a second reasoning pass is valuable;
- a very small repair only when AGY-Manickam/owner explicitly changes Codex from review mode to repair mode.

During an independent review, Codex should be read-only unless explicitly authorized to repair.

### Pane 3 — AGY-Rohit

**Bounded implementation/test worker.**

Use AGY-Rohit for focused slices such as:

- pure recurrence functions + tests;
- one Finance server-action family + tests;
- one migration/backfill fixture;
- one browser/test fixture;
- one bounded UI component group.

Do not give Rohit the entire milestone as one task.

## Same-panel rule

Herdr may keep AGY-Manickam in the main pane and open another split/tab for Codex or AGY-Rohit.

Before starting a second pane, the lead must write the assignment into `versions/v0.1/AGENT_HANDOFF.md` with:

- agent;
- objective;
- allowed scope/files;
- starting full SHA;
- source-of-truth section;
- expected tests/evidence;
- write permission: `READ-ONLY`, `WRITE-SAME-TREE-SEQUENTIAL`, or `WRITE-SEPARATE-WORKTREE`;
- what must not be changed.

Every secondary pane first reads:

1. root `AGENTS.md`;
2. `versions/v0.1/AGENT_HANDOFF.md`;
3. `versions/v0.1/STATUS.md`;
4. `versions/v0.1/AGENT_SKILLS.md`;
5. the exact milestone/review source files named in the assignment.

Do not rely on private memory from a previous agent/session.

## Concurrency safety

### Safe: read-only parallel work

Codex may review/inspect the same checkout while AGY-Manickam is paused at a checkpoint or while no conflicting write is occurring.

Preferred review flow:

```text
AGY-Manickam checkpoint + push
        ↓
Codex split pane reads exact SHA
        ↓
PASS / FAIL / BLOCKED
        ↓
AGY-Manickam integrates next action
```

### Safe: sequential same-tree writer

AGY-Rohit may edit the main worktree only when AGY-Manickam is not simultaneously editing it.

Flow:

```text
AGY-Manickam records handoff
        ↓
AGY-Manickam stops editing
        ↓
AGY-Rohit writes/tests/commits bounded slice
        ↓
AGY-Rohit updates handoff
        ↓
AGY-Manickam resumes and reviews/integrates
```

### Safe: true parallel writer

If AGY-Manickam must continue writing while AGY-Rohit also writes, Rohit MUST use a separate Git worktree and bounded helper branch.

Example:

```bash
# From the main NutriSnap checkout after fetching origin
BASE_SHA=$(git rev-parse HEAD)
SLUG=recurrence-tests
git worktree add ../NutriSnap-rohit-$SLUG -b agent/rohit-$SLUG "$BASE_SHA"
```

Rohit works only inside that worktree/branch.

After tests and a clean commit, Rohit reports the full commit SHA. AGY-Manickam inspects and integrates with a normal cherry-pick when appropriate:

```bash
git switch feature/v0.1-health-wealth
git fetch origin
git status --short
git cherry-pick <rohit-commit-sha>
```

Never force-push. Never delete the helper branch/worktree until integration is verified.

## Forbidden concurrency

Never allow two agents to concurrently modify the same files in the same working tree.

Never let one pane run destructive Git cleanup to solve another pane's changes.

Forbidden examples:

- simultaneous AGY-Manickam + Rohit writes in `/home/openclaw/Projects/NutriSnap`;
- Codex repairing files during an independent review while Manickam is also editing them;
- `git reset --hard`, `git clean -fd`, stash pop/apply/drop, or force push to reconcile agent conflicts;
- broad `git add -A` without inspecting whether another pane created files.

## Commit / push ownership

For the main feature branch, AGY-Manickam is the default integrator and pusher.

Secondary agents:

- may commit only when the handoff explicitly authorizes it;
- may push helper branches when explicitly authorized;
- must not merge `main`;
- must not push unrelated work;
- must report full SHA + tests + files changed.

After accepted integration, AGY-Manickam:

1. runs relevant tests;
2. runs `git diff --check`;
3. updates `AGENT_HANDOFF.md` and `STATUS.md`;
4. pushes `feature/v0.1-health-wealth` normally;
5. records the new full SHA.

## Recommended token-efficient usage

Use the agents this way by default:

```text
AGY-Manickam
  long implementation + orchestration + integration

AGY-Rohit
  bounded coding/testing slices when parallel help saves time

Codex
  architecture/security/difficult debugging + Review A/B/C
```

Do not spend Codex tokens continuously coordinating normal implementation when AGY-Manickam can do that work.

## Split-pane prompts

### Codex review pane

> Read `AGENTS.md`, `versions/v0.1/AGENT_HANDOFF.md`, `versions/v0.1/STATUS.md`, `versions/v0.1/AGENT_SKILLS.md`, and the assigned review section in `REVIEW_GUIDE.md`. Stay READ-ONLY unless explicitly authorized to repair. Review the exact checkpoint SHA recorded in the handoff and return PASS / FAIL / BLOCKED with evidence and actionable findings. Do not orchestrate the project or rewrite unrelated implementation.

### AGY-Rohit implementation pane

> Read `AGENTS.md`, `versions/v0.1/AGENT_HANDOFF.md`, `versions/v0.1/STATUS.md`, and `versions/v0.1/AGENT_SKILLS.md`. Work only on the bounded assignment recorded in the handoff. Respect the stated write mode. Run focused tests and `git diff --check`. Return files changed, exact test results, full commit SHA if authorized, remaining concerns, and update the handoff before stopping.

## Owner stash

The historical owner stash from `main` remains owner-controlled. No pane may apply/pop/drop it unless the owner explicitly authorizes that specific operation.
