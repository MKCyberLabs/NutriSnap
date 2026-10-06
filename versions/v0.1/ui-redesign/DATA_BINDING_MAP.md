# UI Data Binding Map

This document prevents fake UI data.

## Today

Current source: `getTodaySummary()`.

### Total Balance
Source: `data.wealth.totalBalance`
Display: ₹ formatted.

### Monthly Income
Source: `data.wealth.monthlyIncome`
Tone: green.

### Monthly Expenses
Source: `data.wealth.monthlyExpense`
Tone: red.

### Upcoming Bill
Source: `data.wealth.nextDueObligation`
Fields:
- title;
- amount;
- nextDueAt;
- kind.

If null: show `No upcoming bills`.

### Food
Source:
- totalCalories;
- caloriesGoal;
- totalProtein;
- proteinGoal;
- totalCarbs;
- totalFat;
- loggedMealsCount;
- mealCategories.

Do not display a meal target like `0/3 meals` unless a target of 3 is explicitly adopted as a UI-only convention. Preferred v0.1: `X meals logged`.

### Water
Source:
- totalMl;
- dailyGoalMl;
- percent.

### Reminders
Source:
- dueToday[];
- upcomingThisWeek[].

Use actual `timeOrDue`, domain, type, overdue.

## Today recent transactions

Current `getTodaySummary` does not provide recent transactions.

Implementation choice is frozen:
- add a small authenticated read helper in Today actions OR reuse an existing finance read service;
- return latest 4-5 user transactions;
- fields: id, type, amount, category, occurredAt, account name, note optional;
- no writes;
- preserve ownership via authenticated user ID.

Do not hard-code sample transaction rows.

## Upcoming bills count

If desired on KPI, derive from real active obligations within a defined future window. Otherwise show nearest due item.

## Finance

Use existing:
- accounts;
- derived balances;
- financial transactions;
- monthly summary;
- obligations.

Never compute money in JS float if domain service already returns Decimal/string values.

## Relative dates

Use exact dates in persisted data.
UI may show:
- Today
- Tomorrow
- X days left
- X days overdue
while also retaining accessible exact date text/title where appropriate.

## Admin

Use actual user data already exposed to Admin page.
Never display:
- password hash;
- session token/tokenHash;
- secrets;
- DB URLs;
- webhook secrets.

## Avatar

No photo asset is required.
Use initials derived from name or existing UserCircle fallback.
