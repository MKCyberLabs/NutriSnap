# Test Matrix — NutriSnap v0.1 UI Redesign

## Automated regression

Must remain PASS:
- `npm run test:analysis-contract`
- `npm run typecheck`
- `npm run build`
- `npm run test:finance`
- `npm run test:reminders`
- `npm run test:today`
- `npm run test:security`
- `npm run test:life-hub`
- `./scripts/verify-v01-local.sh`
- `git diff --check`

## New UI/routing tests

### AUTH
- UI-T001 Admin login -> /today.
- UI-T002 User login -> /today.
- UI-T003 Reset-required -> /reset-password.
- UI-T004 Non-onboarded -> /onboarding.
- UI-T005 Admin opens Food.
- UI-T006 User denied Admin.
- UI-T007 logout works.

### SHELL
- UI-T010 desktop sidebar active state each route.
- UI-T011 Money nested route active state.
- UI-T012 mobile bottom nav contains exactly 5 destinations.
- UI-T013 More exposes Reminders and Settings.
- UI-T014 More exposes Admin only for ADMIN.
- UI-T015 Quick Add opens from shell.

### TODAY
- UI-T020 balance binds real summary.
- UI-T021 income binds real summary.
- UI-T022 expense binds real summary.
- UI-T023 next bill real/null state.
- UI-T024 food progress.
- UI-T025 water progress.
- UI-T026 due reminders.
- UI-T027 recent transaction list uses real read path.
- UI-T028 partial module error does not blank page.
- UI-T029 no hardcoded fake financial samples.

### MONEY
- UI-T030 account create still works.
- UI-T031 income create.
- UI-T032 expense create.
- UI-T033 transfer create.
- UI-T034 transfer excluded from totals.
- UI-T035 obligation create.
- UI-T036 paid exactly once.
- UI-T037 84-day next due.
- UI-T038 archive account.
- UI-T039 empty states.

### HEALTH
- UI-T040 Food log.
- UI-T041 Food edit grams.
- UI-T042 Food history refresh.
- UI-T043 Water +250.
- UI-T044 Water +500.
- UI-T045 Water custom.
- UI-T046 Water weekly view.

### REMINDERS
- UI-T050 create.
- UI-T051 edit.
- UI-T052 deactivate.
- UI-T053 filters.
- UI-T054 Once past rejection.
- UI-T055 recurrence labels.

## Browser visual matrix

Run in Antigravity Browser Mode or equivalent.

### 1440x900
- UI-V001 Login.
- UI-V002 Today.
- UI-V003 Food.
- UI-V004 Water.
- UI-V005 Money overview.
- UI-V006 Accounts.
- UI-V007 Transactions.
- UI-V008 Bills.
- UI-V009 Reminders.
- UI-V010 Settings.
- UI-V011 Admin.

### 390x844
- UI-V020 Login.
- UI-V021 Today.
- UI-V022 Food.
- UI-V023 Water.
- UI-V024 Money.
- UI-V025 Add transaction.
- UI-V026 Bills.
- UI-V027 Reminders.
- UI-V028 More.
- UI-V029 Settings.

### 360x800
- UI-V030 document has no horizontal overflow.
- UI-V031 dialogs fit.
- UI-V032 bottom nav does not cover final action.
- UI-V033 amount text does not overflow.

## Accessibility

- UI-A001 tab through login.
- UI-A002 tab through sidebar/header.
- UI-A003 dialog focus trap.
- UI-A004 escape closes dialogs.
- UI-A005 icon-only labels.
- UI-A006 form error association.
- UI-A007 visible focus.
- UI-A008 color not sole financial status.
- UI-A009 heading structure.
- UI-A010 reduced motion reasonable.

## Visual acceptance criteria

PASS only if:
- visual language is recognizably the approved green reference;
- no magenta primary UI remains;
- same shell across modules;
- desktop sidebar feels stable, not cramped;
- mobile feels purpose-built, not shrunk desktop;
- no invented sample data;
- important actions visible without hunting;
- empty data states look intentional.

## Evidence format

For each FAIL:
- test ID;
- route;
- viewport;
- screenshot;
- console/network error if any;
- exact reproduction;
- severity: BLOCKER/HIGH/MEDIUM/LOW/COSMETIC.

No code change is considered complete until its relevant tests are rerun.
