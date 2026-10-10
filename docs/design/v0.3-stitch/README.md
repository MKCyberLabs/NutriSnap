# NutriSnap V0.3 — Stitch UI Design Handoff

**Status: implementation reference, NOT a released UI and NOT verified persistent CRUD.** Design imported from the approved [Google Stitch project](https://stitch.withgoogle.com/projects/4448411547551220279), audited 2026-10-09.

This folder contains:

- `AUDIT_REPORT.md` — visual/code audit, blocking gaps, implementation acceptance checks.
- `CRUD_ACTION_MATRIX.csv` — create/update/delete/close actions mapped to modules and device gaps.
- `SCREEN_INVENTORY.csv` — 55 exported HTML screens (31 desktop / 24 mobile), 54 previews.
- `DESIGN_STITCH_ORIGINAL.md` — original reference design tokens; conflicting colors require normalization.
- `STITCH_CHANGE_REQUEST.md` — outstanding corrections for the live Stitch project.
- `archive/stitch-v0.3-optimized.zip.part00..04` — all 55 exported HTML screens, 54 optimized WebP previews, six reference-only boards and offline gallery.
- `extract-assets.sh` — reassembles parts, validates the SHA-256 and extracts them to a temporary location.

## Reconstruct designs

From the repo root:

```bash
bash docs/design/v0.3-stitch/extract-assets.sh
# Offline gallery: /tmp/nutrisnap-stitch-v0.3/index.html
```

You can pass another output directory as first argument. The resulting ZIP and unpacked screens appear there.

PNG previews were converted to visually readable WebP (quality 81) to reduce Git history size; exported HTML markup was not modified. Gallery references point to `screen.webp`. The Bills desktop screenshot was missing from the original export and stays missing by design, documented as a defect.

## V0.3 implementation sequence

1. Create a **code worktree** from the current approved app baseline. Copy this design folder from `origin/design/v0.3-stitch-ui` into it. Do not implement on `main` or the design-only branch.
2. Inspect existing Next.js routes, Prisma models, server actions and tests. Do not override production business logic or database data.
3. Establish canonical tokens (primary `#6D28D9`), shared shell/sidebar, mobile Today/Food/Water/Money/More nav, cards, input forms, dialogs, responsive and accessibility states.
4. Implement Today/Auth, Food/AI, Water, Finance, Reminders/Settings/Admin page groups. HTML and WebP are **visual reference only**, not standalone working routes or production code.
5. For each module wire Create, Edit, Delete/Archive actions to existing APIs/server actions, validate authorization, derived totals, and post-refresh persistence per `CRUD_ACTION_MATRIX.csv`.
6. Do not assume blank/missing Stitch previews are intended UI. Repair them or reproduce appropriate app states manually before claiming visual parity.
7. Run `npm run typecheck`, `npm run test:ui`, `npm run test:food`, `npm run test:finance`, `npm run test:reminders`, `npm run test:security` and `npm run build` with isolated DB tests where required. Do not claim any test passes before execution.
8. Require independent review and human approval before merging or deploying. No destructive Prisma schema operations.

### First commands

```bash
git fetch origin
git worktree add ../NutriSnap-v0.3 -b feature/v0.3-stitch-integration origin/main
cd ../NutriSnap-v0.3
git checkout origin/design/v0.3-stitch-ui -- docs/design/v0.3-stitch
bash docs/design/v0.3-stitch/extract-assets.sh
```

If the feature branch already exists, inspect it rather than recreating it. Main may advance after publication; re-check the approved baseline at implementation time.

### Design reconciliation

The user reports 51 numbered titles in live Stitch after duplicate cleanup; this archived export has **55 HTML exports**, including **six reference-only state/action boards** which must not become application routes. Do not silently drop or rename any screens. Use `SCREEN_INVENTORY.csv` to reconcile.