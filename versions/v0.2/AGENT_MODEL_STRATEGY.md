# Agent / Model Strategy

## Recommended setup

### Main session — AGY-Manickam
Model:
`gemini-3.8-flash-high`

Role:
- primary orchestrator;
- primary coder;
- test runner;
- browser implementation;
- integration;
- Git checkpoints;
- status updates.

Reason:
Gemini 3.8 Flash is specifically positioned for long-horizon software engineering and autonomous/agentic workflows.

### Architecture session — Gemini 3.1 Pro High
Model:
`gemini-3.1-pro-high`

Role:
- architecture review only;
- accounting semantics review;
- schema relationships;
- migration risks;
- idempotency/security review;
- challenge assumptions.

It should NOT be the main orchestrator and should NOT concurrently edit the main worktree.

## Session topology

```text
Herdr / terminal workspace

Pane 1
AGY-Manickam
gemini-3.8-flash-high
WRITE
main implementation branch/worktree

Pane 2
Architecture Reviewer
gemini-3.1-pro-high
READ-ONLY by default
same repository
reads planning + diffs
returns bounded architecture verdict
```

The two model sessions do not need shared conversational memory.

Git/repo documents are the shared memory.

## Architecture gates

### Gate A — before schema implementation
3.1 Pro reviews:
- debt transaction semantics;
- Loan vs Obligation relationship;
- LoanPayment idempotency;
- wishlist purchase link;
- edit rules;
- migration safety;
- credit-card EMI double-count risk.

Output:
`versions/v0.2/ARCHITECTURE_REVIEW_A.md`

Verdict:
`PASS | CHANGES_REQUIRED`

AGY-Manickam applies any changes.

### Gate B — after debt + loan domain implementation
3.1 Pro read-only review:
- actual schema;
- services;
- calculations;
- negative auth tests;
- migration SQL.

Output:
`ARCHITECTURE_REVIEW_B.md`.

### Gate C — optional final delta
Use 3.1 Pro only if architecture materially changed after Gate B.

Do not spend Pro tokens reviewing cosmetic UI work.

## Important rule

Do not change model inside an active long-running AGY-Manickam turn just to get an architecture opinion.

Open a separate session/pane using 3.1 Pro High.

This preserves the main 3.8 Flash High implementation context and avoids concurrent-writer conflicts.

## CLI discovery

Before relying on hardcoded names:
`agy models`

Expected relevant IDs:
- `gemini-3.8-flash-high`
- `gemini-3.1-pro-high`

Use the exact IDs reported by the installed CLI.
