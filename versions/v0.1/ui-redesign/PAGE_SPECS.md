# Page-by-Page Visual & Functional Specification

## A. Login `/`

Desktop:
- centered auth card, max 420px;
- NutriSnap green Leaf mark;
- title `NutriSnap`;
- subtitle `Eat Well · Drink More · Manage Smart · Live Better`;
- labels `Email`, `Password`;
- primary button `Sign in`.
Remove overly security-marketing language such as `Hardened Production Environment` from the visual UI.

Behavior:
- preserve existing secure API/session implementation;
- ADMIN does not auto-land on Admin;
- no password in URLs/logs.

## B. Today `/today`

### Desktop frame

Header:
- H1 `Today`;
- local date under title;
- search optional only if implemented meaningfully; otherwise omit;
- Quick Add primary action;
- notification icon may be omitted if no notification center exists.

Row 1: 4 KPI cards
1. Total Balance -> `wealth.totalBalance`
2. Monthly Income -> `wealth.monthlyIncome`
3. Monthly Expenses -> `wealth.monthlyExpense`
4. Upcoming Bill -> next due title/amount/date or `None due`

No percentage trend chip unless a real trend is computed from backend data.

Row 2:
- Today's Focus: 5-6 concise action rows.
- Recent Transactions: latest real transactions; if no backend data, show proper empty state.
- Health & Wellness: Food calories/progress + Water ml/progress.

Today's Focus composition:
- Food: `Log your meals` -> X / target meal categories where truthful; if target not modeled, show logged count only.
- Water: current ml / goal ml.
- Money: `Review expenses` -> monthly expense summary.
- Upcoming bill: next obligation and due relative text.
- Reminder: nearest reminder if available.

### Mobile
- header `Today`;
- large total balance card;
- four module shortcut circles: Food, Water, Money, Reminders;
- Today's Focus card;
- stack Health & Money summaries below;
- bottom nav fixed.

## C. Food `/dashboard`

Preserve:
- meal logging/analyze;
- daily/weekly/custom views;
- edit grams;
- append item;
- charts/history.

Redesign:
- wrap in AppShell;
- remove admin redirect;
- use global neutral background;
- orange remains local Food accent;
- simplify decorative glass effects;
- primary daily summary at top;
- meal category cards below;
- history/charts in SectionCard.

## D. Water `/hydration`

Preserve all existing hydration functionality.

Redesign:
- AppShell;
- global neutral shell;
- blue accent inside hydration content;
- top daily intake KPI + progress;
- +250 / +500 / Custom buttons;
- history list and weekly chart;
- settings affordance.

Do not make the entire app background blue.

## E. Money Overview `/finance`

Header:
Money
`Accounts, spending and upcoming obligations`
Primary action: `Add transaction`
Secondary: `Add account`

KPI:
- Total balance
- Monthly income
- Monthly expense
- Upcoming obligations count or nearest due (real data only)

Then:
- Accounts preview
- Recent transactions
- Upcoming bills

Desktop subnavigation:
Overview | Accounts | Transactions | Bills & Subscriptions

Mobile:
same as segmented horizontal tab row near header or use route-preserving compact tabs.

## F. Accounts `/finance/accounts`

Top:
Total balance card.
Primary: + Add Account.

List:
- BANK
- CASH
- WALLET
- CREDIT_CARD.

Each:
icon, name, institution, type, balance, credit limit if relevant, menu/archive.

Empty state:
`No accounts yet`
`Create a bank, cash, wallet or credit card account to start tracking money.`

## G. Transactions `/finance/transactions`

Header + Add Transaction.

Filter chips:
All | Expense | Income | Transfer.

Row:
icon; category/title; date/account; amount.

Form:
type segmented control Expense/Income/Transfer;
amount;
category;
source account;
destination account only for Transfer;
date;
note;
Save Transaction.

## H. Bills & Subscriptions `/finance/bills`

Tabs:
Upcoming | Paid.

Each row/card:
kind icon;
title;
due date;
amount;
relative badge (`3 days left`, `Overdue`, etc.);
recurrence line;
Paid action.

Use obligation model; do not create a parallel Bills table.

## I. Reminders `/reminders`

Filter chips:
All | Bills | Health | Custom.

List card:
icon; title; recurrence/due summary; status pill; overflow/edit.

Floating + button on mobile allowed.
Desktop uses normal `Add reminder` button in header.

## J. Settings `/settings`

Convert existing settings experience into page sections while reusing existing actions:
- Profile
- Notifications / reminders
- Telegram Integration
- App Preferences
- Data & Backup placeholder only if actual function exists; otherwise omit
- About

Do not invent Help/Support backend.

Desktop may render sections in card list.
Mobile follows reference list-row style.

## K. Admin `/admin`

Admin is role-gated utility, not home.

Header:
Admin
`Manage NutriSnap users and system access`

Use same AppShell.
Keep user table/features.
Provide obvious `Today` navigation via shell.
No auto redirect into Admin from login or Food.

Mobile admin table may become stacked user cards if table overflows.

## L. Quick Add

Keep existing modalities:
- Food
- Water
- Expense
- Income
- Reminder.

Visual:
- compact modal/sheet;
- mobile uses bottom sheet-like dialog if feasible;
- consistent green selected/primary state;
- semantic icons remain colored.
