# AGY-Manickam Master Prompt — NutriSnap v0.1 UI Redesign

You are the ONLY implementation agent for this redesign.

Do not orchestrate Codex.
Do not delegate to AGY-Rohit.
Do not wait for another agent.
Complete the work yourself using your available tools and browser mode.

Repository:
`/home/openclaw/Projects/NutriSnap`

Required branch:
`feature/v0.1-ui-redesign`

## Start

Run:
```bash
git fetch origin
git switch feature/v0.1-ui-redesign
git pull --ff-only origin feature/v0.1-ui-redesign
git status --short
git rev-parse HEAD
```

Worktree must be understood before editing.

Then read all files under:
`versions/v0.1/ui-redesign/`

Read in README source-of-truth order.

## Mission

Implement the owner-approved NutriSnap green Health + Wealth UI system exactly as specified.

Do not redesign the design.

Do not invent metrics.

Do not change validated v0.1 domain semantics.

Fix the known ADMIN routing problem as part of this work.

## Implementation method

Proceed sequentially through `IMPLEMENTATION_CHECKLIST.md`.

You may continue for a long session.

After every major phase:
- run relevant tests;
- use browser mode;
- update STATUS;
- commit meaningful checkpoint;
- push normally.

## Browser requirement

Use browser mode during implementation, not only at the end.

Target UAT:
`https://wealth.mkcyberlabs.in`

However, only test a freshly deployed UAT build when the owner/environment workflow makes that build available.
Do not touch production `nutrisnap.mkcyberlabs.in`.

For local/preview browser checks, use the isolated dev/UAT runtime.

## Required design decisions

- Green primary NutriSnap identity.
- Desktop persistent sidebar.
- Mobile bottom nav = Today / Food / Water / Money / More.
- Money nested pages = Overview / Accounts / Transactions / Bills & Subscriptions.
- ADMIN and USER normal landing = /today.
- Admin is explicit management page only.
- Existing Food and Water functionality preserved.
- Existing Money/Reminder semantics preserved.
- Real backend data only.

## Do not

- no production deployment;
- no production DB migration;
- no real production Telegram;
- no force push;
- no main merge;
- no fake sample dashboard values;
- no new AI art/assets;
- no replacement accounting system;
- no orchestration.

## Final gate

Run everything in `TEST_MATRIX.md`.

At minimum:
```bash
npm run test:analysis-contract
npm run typecheck
npm run build
npm run test:finance
npm run test:reminders
npm run test:today
npm run test:security
npm run test:life-hub
./scripts/verify-v01-local.sh
git diff --check
```

Create/add the UI/auth routing tests required by this design package.

Capture required screenshots.

Final report:
- branch;
- head SHA;
- implementation checkpoints;
- test counts;
- browser result;
- screenshots;
- admin routing result;
- desktop/mobile result;
- known non-blocking issues;
- PR URL.

Finish exactly:

`NUTRISNAP V0.1 UI REDESIGN: READY FOR OWNER UAT — DO NOT MERGE`
