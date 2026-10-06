# NutriSnap v0.1 UI Redesign — Single-Agent Execution Package

Status: FROZEN FOR IMPLEMENTATION
Owner: Manickam
Primary implementation agent: AGY-Manickam only
Branch: `feature/v0.1-ui-redesign`
Base main SHA: `0e44cb3fdf8789ad8a8e004b27d905dabae8ec00`

## Goal

Implement the approved clean green NutriSnap Health + Wealth visual system across the existing v0.1 application without changing validated business semantics.

The design direction is the owner-approved reference board:
- green NutriSnap identity;
- white surfaces;
- soft semantic color cards;
- desktop sidebar;
- compact mobile bottom navigation;
- data-dense but calm dashboard;
- Accounts / Transactions / Bills grouped under Money;
- Health and Wealth visible together on Today.

This package is intentionally detailed so AGY-Manickam does not need to invent spacing, hierarchy, routes, labels, component structure, or responsive behavior.

## Source-of-truth order

1. `AGY_MANICKAM_MASTER_PROMPT.md`
2. `MASTER_PLAN.md`
3. `DESIGN_SYSTEM.md`
4. `ROUTES_AND_FLOWS.md`
5. `COMPONENT_ARCHITECTURE.md`
6. `PAGE_SPECS.md`
7. `DATA_BINDING_MAP.md`
8. `RESPONSIVE_AND_ACCESSIBILITY.md`
9. `ADMIN_AUTH_FIX.md`
10. `ASSET_MANIFEST.md`
11. `IMPLEMENTATION_CHECKLIST.md`
12. `TEST_MATRIX.md`
13. `STATUS.md`

Existing v0.1 domain behavior remains governed by the existing Health + Wealth architecture and tests.

## Non-goals

- No new finance accounting semantics.
- No production deployment.
- No production DB migration.
- No real Telegram sends.
- No bank integration.
- No investment portfolio redesign.
- No API schema redesign unless required to expose already-existing data.
- No replacement of working server actions with mock state.
- No fake dashboard KPI data.

## Definition of done

The redesign is complete only when:
- every target page uses the same app shell and design tokens;
- desktop and mobile layouts match this specification;
- ADMIN and USER both land on `/today` after normal successful login;
- Admin remains explicitly accessible only to ADMIN users;
- current Health + Wealth data is rendered truthfully;
- all existing automated v0.1 tests pass;
- new UI/navigation/auth-routing tests pass;
- browser UAT screenshots are captured at desktop and mobile breakpoints;
- no horizontal overflow at 360px;
- no production environment is touched.
