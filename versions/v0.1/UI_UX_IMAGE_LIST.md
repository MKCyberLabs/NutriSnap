# NutriSnap Life Hub v0.1 — UI/UX Image List

Status: design inventory for GitHub Issue #129  
Branch: `paperclip/gh-129-life-hub-v0.1`  
Product scope: Today + Food + Water + Money + Reminders

## Purpose

This file is the v0.1 visual-design checklist. It defines the reference images/mockups that should be created before or alongside UI implementation so the product has one coherent visual language across desktop and mobile.

This is not permission to expand product scope. The v0.1 behavior remains defined by `MASTER_PLAN.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_CHECKLIST.md`.

## Visual direction

Preserve the existing NutriSnap identity:

- sophisticated navy: `#354F7D`;
- cool slate background: `#F5F6F8`;
- calm indigo accent: `#7D7DCE`;
- Literata for prominent journal-style headings;
- Inter for dense dashboard/data UI;
- spacious cards, soft borders, restrained shadows;
- lightweight geometric line icons;
- calm wellness feel, not a banking-app aesthetic;
- financial data should feel trustworthy and readable without overpowering Food/Water.

Suggested design workspace:

```text
design/v0.1/
├── foundations/
├── shell/
├── today/
├── food/
├── water/
├── finance/
├── reminders/
├── settings/
└── states/
```

Use desktop target around 1440×1024 and mobile target around 390×844 unless a component sheet needs another size.

---

## P0 — Required before final v0.1 UI implementation

| ID | Planned image | Suggested Git path | What the image must show | Status |
|---|---|---|---|---|
| UX-01 | V0.1 visual foundation sheet | `design/v0.1/foundations/01-design-system.png` | Colors, typography, radius, spacing, shadows, button/input/card styles, semantic success/warning/error colors | [ ] |
| UX-02 | Desktop Life Hub shell | `design/v0.1/shell/02-desktop-navigation.png` | NutriSnap + Today / Food / Water / Money / Reminders, active state, account/settings area | [ ] |
| UX-03 | Mobile Life Hub shell | `design/v0.1/shell/03-mobile-navigation.png` | Home / Food / Water / Money / Remind bottom navigation using the same information architecture | [ ] |
| UX-04 | Today — desktop | `design/v0.1/today/04-today-desktop.png` | Food progress, Water progress, month Money summary, upcoming obligations, reminder summary, Quick Add | [ ] |
| UX-05 | Today — mobile | `design/v0.1/today/05-today-mobile.png` | Same information hierarchy as desktop, stacked for one-hand use | [ ] |
| UX-06 | Quick Add launcher | `design/v0.1/today/06-quick-add.png` | Food, Water, Expense, Income, Reminder actions; reusable sheet/dialog behavior | [ ] |
| UX-07 | Money overview — desktop | `design/v0.1/finance/07-money-overview-desktop.png` | Month income, expense, balance context, accounts summary, upcoming bills, recent transactions | [ ] |
| UX-08 | Money overview — mobile | `design/v0.1/finance/08-money-overview-mobile.png` | Mobile information priority and clear add action | [ ] |
| UX-09 | Accounts | `design/v0.1/finance/09-accounts.png` | Bank, Cash, Wallet, Credit Card cards/list; current balance; archived/inactive treatment | [ ] |
| UX-10 | Add/Edit Account | `design/v0.1/finance/10-account-editor.png` | Name, type, institution, opening balance, optional credit limit; no credential fields | [ ] |
| UX-11 | Transactions | `design/v0.1/finance/11-transactions.png` | Income/Expense/Transfer rows, filters, category, account, date, amount hierarchy | [ ] |
| UX-12 | Add transaction flows | `design/v0.1/finance/12-transaction-editor.png` | Expense + Income + Transfer states, source/destination account rules | [ ] |
| UX-13 | Bills & Subscriptions | `design/v0.1/finance/13-bills-subscriptions.png` | Upcoming obligations, due date, amount optional, recurrence, reminder chips, Paid state | [ ] |
| UX-14 | Add/Edit Obligation | `design/v0.1/finance/14-obligation-editor.png` | Recharge/Bill/Subscription/Rent/EMI/etc., recurrence, offsets, linked account, notes | [ ] |
| UX-15 | Mark Paid flow | `design/v0.1/finance/15-mark-paid.png` | Paid confirmation, optional “create expense”, already-paid/idempotent state | [ ] |
| UX-16 | Reminders — desktop | `design/v0.1/reminders/16-reminders-desktop.png` | Health + Finance reminders, due/upcoming grouping, active state, Done/Paid/Snooze/Open semantics | [ ] |
| UX-17 | Reminders — mobile | `design/v0.1/reminders/17-reminders-mobile.png` | Compact list/cards with obvious next action and due time | [ ] |
| UX-18 | Add/Edit Reminder | `design/v0.1/reminders/18-reminder-editor.png` | Domain, title, recurrence, time/date, offsets, active toggle; meal compatibility without finance-as-meal UX | [ ] |
| UX-19 | Telegram finance reminder reference | `design/v0.1/reminders/19-telegram-finance-reminder.png` | Example: credit-card/recharge reminder with Paid / Snooze / Open actions | [ ] |
| UX-20 | Loading / Empty / Partial Error states | `design/v0.1/states/20-system-states.png` | Skeleton, no accounts, no transactions, no bills, no reminders, one Today module failing | [ ] |

---

## P1 — Polish / consistency images

| ID | Planned image | Suggested Git path | What the image must show | Status |
|---|---|---|---|---|
| UX-21 | Food visual alignment — desktop | `design/v0.1/food/21-food-desktop.png` | Existing Food behavior restyled only enough to fit shared shell; no functional rewrite | [ ] |
| UX-22 | Food visual alignment — mobile | `design/v0.1/food/22-food-mobile.png` | Existing meal flow in new mobile shell | [ ] |
| UX-23 | Water mobile alignment | `design/v0.1/water/23-water-mobile.png` | Existing Hydration Hub adapted to shared mobile navigation | [ ] |
| UX-24 | Settings alignment | `design/v0.1/settings/24-settings.png` | Timezone, Telegram ID, health goals, hydration settings; reminder editing clearly moved/linked to Reminders | [ ] |
| UX-25 | Confirmation/destructive dialogs | `design/v0.1/states/25-confirmation-dialogs.png` | Delete transaction, archive account, disable obligation, discard edits | [ ] |
| UX-26 | Responsive component sheet | `design/v0.1/states/26-responsive-components.png` | Cards, tables-to-lists, tabs, chips, amount formatting, long titles, overflow behavior | [ ] |

---

## Existing repo images to reuse as references

Do not recreate these unless the visual language is intentionally revised:

1. `public/Hydration Hub Reference Pic/Hydration Hub Dashboard.png`
2. `public/Hydration Hub Reference Pic/hydration_hub_dashboard_weekly.png`
3. `public/Hydration Hub Reference Pic/Reminder schedule.png`
4. `public/Hydration Hub Reference Pic/edit cup size.png`
5. `public/stitch_advanced_settings_dashboard/screen.png`

These are reference assets, not necessarily final v0.1 screenshots.

---

## Recommended creation order

Create and approve the images in this sequence:

1. UX-01 design system.
2. UX-02 + UX-03 shared shell.
3. UX-04 + UX-05 Today.
4. UX-06 Quick Add.
5. UX-07 through UX-15 Money.
6. UX-16 through UX-19 Reminders + Telegram.
7. UX-20 states.
8. UX-21 through UX-26 cross-module polish.

This order mirrors the v0.1 implementation architecture and avoids redesigning screens after the shell and component language are settled.

## Design acceptance rules

Each final mockup should:

- use the shared v0.1 shell;
- have a clear desktop/mobile hierarchy;
- avoid exposing bank passwords, UPI PINs, CVV/PIN/OTP or broker credentials;
- display INR consistently for v0.1 Money views;
- keep transfers visually distinct from income and expense;
- make Paid/Done/Snooze/Open actions semantically obvious;
- show recurrence/reminder information without technical jargon;
- preserve Food and Water familiarity;
- include realistic but fake sample data only;
- meet readable contrast and keyboard/focus expectations when translated to implementation.

## Definition of design-ready

The v0.1 UI is design-ready when:

- UX-01 through UX-20 are approved or explicitly marked “implementation can infer”;
- desktop and mobile navigation are consistent;
- Today establishes the cross-domain visual hierarchy;
- Money and Reminders share one coherent interaction language;
- Quick Add has one reusable design;
- empty/loading/error states are not left to ad-hoc implementation;
- Food and Water remain recognizable and functional inside the new Life Hub shell.
