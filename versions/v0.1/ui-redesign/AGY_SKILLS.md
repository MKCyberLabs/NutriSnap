# AGY-Manickam Skills — UI Redesign

This is a single-agent execution project.

## Skill 1 — Read before editing

At every fresh AGY session:
1. read this folder README;
2. read STATUS;
3. inspect git branch/status/log;
4. resume first unfinished checklist item.

Do not depend on private conversation memory.

## Skill 2 — Design-system-first

Before styling a page:
- use shared token;
- use shared shell;
- use shared card/list primitives;
- avoid page-local one-off colors/radii unless domain semantic.

If two pages need the same pattern, extract component before the second copy.

## Skill 3 — Preserve domain behavior

UI work must call existing authenticated actions/services.
Do not rewrite finance, reminder, food or hydration logic merely to make layout easier.

## Skill 4 — Truthful data

If data is absent:
- add the smallest authenticated read model;
- or show empty state.

Never fabricate demo values.

## Skill 5 — Browser implementation loop

For each major page:
1. implement;
2. typecheck;
3. open browser;
4. inspect at desktop;
5. inspect at 390px;
6. test interactions;
7. check console/network;
8. fix;
9. capture evidence;
10. commit checkpoint.

## Skill 6 — Keep scope bounded

Do not add:
- new finance concepts;
- new social/profile features;
- new AI features;
- new admin powers;
- new notification channels.

## Skill 7 — Admin safety

ADMIN is both a normal app user and privileged manager.
Do not make ADMIN unusable in normal Health/Wealth pages.
Do not weaken /admin authorization.

## Skill 8 — Commit discipline

Suggested checkpoints:
- design tokens/shell;
- auth routing;
- Today;
- Money routes;
- Food/Water;
- Reminders/Settings/Admin;
- responsive/a11y/tests.

Push after verified meaningful checkpoint.
No force push.
No merge.

## Skill 9 — Stop conditions

Stop and report only if:
- persisted data semantics must change;
- authorization must weaken;
- a destructive DB operation seems necessary;
- owner-approved route/UX specification is impossible with current architecture.

Otherwise make the smallest reasonable implementation choice and continue.
