# Routes & User Flows

## Canonical routes

Existing:
- `/` login
- `/today`
- `/dashboard` Food
- `/hydration` Water
- `/finance` Money overview
- `/reminders`
- `/admin`

Add:
- `/finance/accounts`
- `/finance/transactions`
- `/finance/bills`
- `/settings`

The new Money sub-routes must reuse current server actions/services. They are presentation decomposition, not new accounting logic.

## Login flow

Priority:
1. invalid login -> remain login;
2. `requiresPasswordReset` -> `/reset-password`;
3. not onboarded -> `/onboarding`;
4. onboarded ADMIN or USER -> `/today`.

Do not redirect ADMIN to `/admin` merely because role = ADMIN.

## Desktop navigation

Sidebar order:

NutriSnap
---
Today
Food
Water
Money
  Overview
  Accounts
  Transactions
  Bills & Subscriptions
Reminders
Settings
---
Admin (ADMIN only)
Profile footer / Logout

Behavior:
- Money is a parent group;
- child route gets active state;
- `/finance` defaults Overview;
- Admin is visually separated near bottom.

## Mobile navigation

Fixed bottom navigation:
1. Today
2. Food
3. Water
4. Money
5. More

More opens bottom sheet/drawer:
- Reminders
- Settings
- Admin (ADMIN only)
- Logout

Do not render six or seven tiny bottom tabs.

## Primary flows

### Daily check-in
Login -> Today -> inspect nutrition/water/money/reminders -> Quick Add -> Today updates.

### Food
Today -> Food -> log meal -> return Today -> Nutrition card updates.

### Water
Today -> Water or +250/+500 -> Today -> progress updates.

### Expense
Today Quick Add or Money -> Add Transaction -> Expense -> Save -> dashboard totals/recent transaction update.

### Transfer
Money -> Transactions -> Add Transaction -> Transfer -> source + destination -> Save -> account balances update; income/expense totals unchanged.

### Bill
Money -> Bills & Subscriptions -> Add obligation -> recurrence/reminders -> Today upcoming bill -> mark Paid -> one expense -> next occurrence.

### Admin
Login as ADMIN -> Today -> optional Admin nav -> manage users -> Back/Today.
Admin is not an automatic landing page.
