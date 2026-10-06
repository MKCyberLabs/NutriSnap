# Component Architecture

## Target structure

```text
src/components/
├── app-shell/
│   ├── AppShell.tsx
│   ├── DesktopSidebar.tsx
│   ├── MobileTopBar.tsx
│   ├── MobileBottomNav.tsx
│   ├── MobileMoreSheet.tsx
│   ├── UserMenu.tsx
│   └── PageHeader.tsx
├── design-system/
│   ├── Brand.tsx
│   ├── MetricCard.tsx
│   ├── SectionCard.tsx
│   ├── StatusPill.tsx
│   ├── MoneyAmount.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   ├── LoadingCard.tsx
│   ├── ProgressMetric.tsx
│   └── SegmentedFilter.tsx
├── today/
│   ├── TodayMetricGrid.tsx
│   ├── TodayFocusList.tsx
│   ├── RecentTransactions.tsx
│   ├── HealthWellnessCard.tsx
│   └── UpcomingBillCard.tsx
├── finance/
│   ├── FinanceTabs.tsx
│   ├── AccountCard.tsx
│   ├── AccountList.tsx
│   ├── TransactionList.tsx
│   ├── TransactionRow.tsx
│   ├── TransactionForm.tsx
│   ├── ObligationList.tsx
│   ├── ObligationRow.tsx
│   └── ObligationForm.tsx
└── reminders/
    ├── ReminderFilters.tsx
    ├── ReminderList.tsx
    ├── ReminderRow.tsx
    └── ReminderForm.tsx
```

Existing Radix/shadcn controls under `src/components/ui` remain the low-level primitives.

## AppShell contract

Props:
- `children`
- optional page title metadata only if needed.

Responsibilities:
- desktop sidebar;
- mobile top bar;
- mobile bottom nav;
- responsive page offset/padding;
- user/admin menu;
- Quick Add entry point;
- logout;
- active navigation state.

Pages must not duplicate global navigation.

## MetricCard contract

Inputs:
- label;
- value;
- icon;
- tone: neutral | green | blue | amber | red;
- helper text optional;
- href optional.

Must not accept arbitrary Tailwind class strings from every page. Keep visual variants centralized.

## SectionCard

Inputs:
- title;
- description optional;
- action optional;
- children.

Used for Recent Transactions, Today's Focus, Health & Wellness, lists.

## EmptyState

Inputs:
- icon;
- title;
- description;
- primary action optional.

Every list page must have an intentional empty state.

## Money components

`TransactionRow`:
- icon/tone derived from category/type;
- merchant/note/category title;
- date/account metadata;
- amount aligned right;
- expense red negative;
- income green positive;
- transfer neutral/blue.

`AccountCard`:
- name;
- type;
- institution optional;
- derived balance;
- credit limit if card;
- archived state.

`ObligationRow`:
- kind icon;
- title;
- next due;
- amount;
- due/status pill;
- Paid action if actionable.

## Page component rule

Large pages should orchestrate data and compose components.
Do not keep 25k-35k line-of-sight monoliths with every dialog/list/card in one file.

Target:
- page files generally < 350 lines after decomposition;
- complex domain behavior remains in existing actions/services;
- local reusable UI state lives in feature components.

## State rule

Do not duplicate persisted backend state into localStorage unless preserving an existing Food compatibility path.
No new finance/reminder localStorage source of truth.
