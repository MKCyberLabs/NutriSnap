# NutriSnap V0.3 — Stitch UI/UX audit & implementation handoff

Audit source: `stitch_nutrisnap_ui_ux_v0.1(1).zip` (uploaded 2026-10-09). This is an inspection of exported HTML, screenshots and the connected GitHub repository's described architecture/tests; **not** a successful live-browser check of Stitch and **not** an end-to-end validation against a running NutriSnap database.

## Verdict
**Conditionally ready for UI implementation, not ready to treat as complete functional CRUD.** Keep exported HTML/screenshots as a design reference. Implement against existing Next.js, Prisma/PostgreSQL services and APIs/server actions; avoid dropping generated HTML directly into production.

### Inventory
- 55 distinct HTML exports: 31 desktop, 24 mobile, 54 PNG previews.
- Original `DESIGN.md` is retained as `DESIGN_STITCH_ORIGINAL.md`.
- No byte-identical duplicate HTML files or PNG files were found (not proof of no visually similar screens).
- Six auxiliary *reference boards* must **not** become actual application routes: CRUD templates, health action templates, money action templates, profile/admin action templates, edge states, state specimens.
- 32 screens have at least one placeholder `href="#"`; 36 of 55 have no inline DOM event attributes; no screen HTML contains a `fetch(...)` call. Some screens have local JavaScript demo handlers. These exports are not proof of persistent CRUD.
- All 55 HTML files load Tailwind through `cdn.tailwindcss.com`; many use external fonts/images. Production implementation should use the project's compiled Tailwind and approved asset pipeline.

## Priority 0: Fix / verify before signing off design
1. `onboarding_goal_setup_desktop_1440px`: screenshot is almost entirely blank below top progress header. Verify actual design is rendered and re-export correct preview.
2. `meal_confirmation_editing_mobile_390px`: screenshot is almost entirely blank/black, despite HTML containing editing controls. Re-export or repair before implementing this crucial workflow.
3. `today_overview_desktop_1440px`: multiple major dashboard widgets appear empty/undrawn. Replace with visible chart/value/fallback states and re-export.
4. `bills_subscriptions_desktop_1440px`: `screen.png` is missing; HTML exists. Re-export screenshot.
5. `login_mobile_390px` is absent. Generate it and verify registration/login/reset-password flows match the actual authentication functionality; do not invent a provider integration.
6. Reconcile the user-reported 51 live numbered Stitch titles with this ZIP's 55 exported screens. They are not necessarily duplicates; identify extra and missing variants before deleting anything.

## Priority 1: Complete real CRUD visibility, especially mobile
See `CRUD_ACTION_MATRIX.csv`. The main issue is not a missing desktop design language: CRUD specimen boards demonstrate Add/Edit/Delete. The problem is that multiple main mobile screens show Add only, with edit/delete reachable nowhere obvious. Make Edit/Delete available through a visible row/card action or accessible overflow menu with reliable selection. Include entity-named confirmation dialogs, optimistic/error states, and Save/Cancel.

- **Health:** Meals have UI for Add/Edit/Delete on both diaries. Water mobile has quick Add but needs a history list with Edit/Delete (desktop already shows them). Reminders mobile needs Edit/Delete, not just Add/toggle. Goals need Update/Save, not necessarily Delete.
- **Money:** Accounts need edit full details and Close/Archive; transactions mobile needs Delete/confirm; bills require a missing explicit Edit form plus pause, mark-paid, undo, archive/delete; loans/EMI lack an explicit Edit form and need payment correction and close/archive; peers require settlement correction and delete/void; wishlist needs a missing Edit form, Delete and purchase-confirmation.
- **Profile/Admin:** mobile profile should make edits/saving explicit; admin users need guarded Role/Status/Revoke operations with RBAC and audit trail. Do not expose a destructive button in a normal-user session.

## Priority 2: Design & data-integrity polish
- **Brand tokens conflict:** `DESIGN.md` YAML primary is `#5300B7` while prose uses `#6D28D9`; YAML background `#F9F9FF` vs prose `#FAFAFC`. Adopt a single canonical palette (`#6D28D9` preferred primary), define its accessible hover/focus states, then align all screens.
- **Mock content:** many screens include static examples and an October 2024 date. All records/date labels must be bound to actual user, locale (`en-IN`), timezone (`Asia/Kolkata` when chosen), currency, and current date. Do not hardcode sample amounts in final UI.
- **Navigation:** desktop nested finance menu and mobile five-tab Today/Food/Water/Money/More must remain consistent with existing tested route map. Some references show different bottom-tab labels and isolated headers.
- **State coverage:** show loading, no records, error, validation, success, delete confirmation and user-safe undo/restore where appropriate. Existing state boards can guide all screens.
- **AI meal estimate:** user must be able to correct food, portions, ingredients and calories before Save; clarify whether editing after Save updates nutrient totals and history.
- **Finance safety:** respect derived balances, two-sided transfers, credit-card payments, payment undo, partial failures, and user ownership. Do not mutate persisted financial data directly from demo controls or simply overwrite calculated balances.
- **Privacy/security:** server-side auth and authorization, confirm before destructive changes, guard admin actions; do not infer 'Telegram connected' or real bank sync from visual mockups.
- **Responsive:** test 390px, 768px and 1440px for clipping, 44px targets, keyboard access and screen reader labels; live PNG dimensions aren't proof of responsive functionality.

## Design-to-implementation mapping

- **01_Core_Auth_Dashboard:** landing, login, registration, onboarding, today overview
- **02_Health_Nutrition:** diary, add/search, camera/upload, AI review, meal edit/save/success, insights, water, history, goals
- **03_Finance_Life_Hub:** overview, accounts, transactions, bills, loans, peer ledger, wishlist
- **04_Reminders_Settings_Admin:** reminders, profile, admin portal
- **90_Reference_Only_Not_Routes:** six design standards/action/state boards

Files are numbered within their groups. Source-folder names are preserved in `SCREEN_INVENTORY.csv`. `index.html` offers a visual gallery.

## V0.3 implementation gates
1. **No production rewrite:** use a feature branch/worktree; keep schema/API/server-action contracts and existing data intact.
2. **Componentize:** reuse app shell, mobile nav, form fields, lists, dialogs, empty/loading/error states, controlled forms, and shared tokens.
3. **Wire each CRUD action:** Create saves once, Update persists correct entity and recalculates derived totals, Delete/Archive confirms and preserves invariants. Verify changes still appear correctly after reload.
4. **Run automated regression:** `npm run typecheck`, `npm run test:ui`, `npm run test:food`, `npm run test:finance`, `npm run test:reminders`, `npm run test:security`; `npm run build`; integration tests against an isolated DB for business logic. Review failures, do not assume they pass.
5. **Acceptance matrix:** for each entity and device, test create/update/delete or appropriate archive, empty/error/loading, cancel, duplicate clicks, stale state, keyboard navigation and user-to-user isolation.
6. **Visual review:** fresh screenshots at desktop/mobile breakpoints compared with the approved Stitch references. Fix significant differences before merging.
7. **Release gate:** independent review before merging into `main`; no destructive migrations (`prisma db push --accept-data-loss` is forbidden).

## GitHub cross-check
The connected repository `MKCyberLabs/NutriSnap` identifies a Next.js frontend, Python Gemini image-analysis backend, Telegram input, Prisma/PostgreSQL and existing `test:finance`, `test:food`, `test:ui`, and `test:security` scripts. The repository includes a transaction/account CRUD test that invokes `createAccount`, `recordTransaction`, `updateTransaction`, and `deleteTransaction`; this is evidence of test *coverage in code*, not execution/pass status. Avoid rebuilding these contracts merely from Stitch screenshots.

## What is verified / not verified
**Verified:** filesystem contents, visual PNG previews, structural HTML markup, presence of user-facing control labels, and presence of some connected GitHub source/tests.

**Not verified:** live Stitch project title sequence, functional navigation, database-backed insert/update/delete in a running app, current deployed behavior, responsive browser re-render, or automated test pass/fail. Local headless loading of extracted HTML was blocked in the tool environment, so no repaired previews are claimed.