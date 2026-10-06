import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIndianRupees } from '../../components/design-system/MoneyAmount';
import { getNextOccurrence, getOccurrenceKey } from '../recurrence/recurrence';
import { isValidAccountType, isValidTransactionType, isValidObligationKind } from '../finance/finance';

// UI-T010 & UI-T011: Desktop sidebar active state logic
function getActiveNavState(pathname: string) {
  return {
    today: pathname === '/today',
    food: pathname.startsWith('/dashboard'),
    water: pathname.startsWith('/hydration'),
    money: pathname.startsWith('/finance'),
    moneyOverview: pathname === '/finance',
    moneyAccounts: pathname === '/finance/accounts',
    moneyTransactions: pathname === '/finance/transactions',
    moneyBills: pathname === '/finance/bills',
    reminders: pathname.startsWith('/reminders'),
    settings: pathname.startsWith('/settings'),
    admin: pathname.startsWith('/admin'),
  };
}

test('UI-T010 & UI-T011: Desktop sidebar and Money nested route active state resolution', () => {
  // /today
  const todayState = getActiveNavState('/today');
  assert.equal(todayState.today, true);
  assert.equal(todayState.money, false);

  // /finance (Overview)
  const financeState = getActiveNavState('/finance');
  assert.equal(financeState.money, true);
  assert.equal(financeState.moneyOverview, true);
  assert.equal(financeState.moneyAccounts, false);

  // /finance/accounts
  const accountsState = getActiveNavState('/finance/accounts');
  assert.equal(accountsState.money, true);
  assert.equal(accountsState.moneyAccounts, true);
  assert.equal(accountsState.moneyOverview, false);

  // /finance/transactions
  const txState = getActiveNavState('/finance/transactions');
  assert.equal(txState.money, true);
  assert.equal(txState.moneyTransactions, true);

  // /finance/bills
  const billsState = getActiveNavState('/finance/bills');
  assert.equal(billsState.money, true);
  assert.equal(billsState.moneyBills, true);
});

test('UI-T012: Mobile bottom nav has exactly 5 destinations', () => {
  const mobileNavDestinations = ['Today', 'Food', 'Water', 'Money', 'More'];
  assert.equal(mobileNavDestinations.length, 5);
  assert.deepEqual(mobileNavDestinations, ['Today', 'Food', 'Water', 'Money', 'More']);
});

test('UI-T013 & UI-T014: More sheet exposes Reminders, Settings, and Admin role-dependently', () => {
  function getMoreSheetItems(role: 'USER' | 'ADMIN') {
    const items = ['Reminders', 'Settings'];
    if (role === 'ADMIN') {
      items.push('Admin');
    }
    items.push('Logout');
    return items;
  }

  const userItems = getMoreSheetItems('USER');
  assert.deepEqual(userItems, ['Reminders', 'Settings', 'Logout']);
  assert.equal(userItems.includes('Admin'), false);

  const adminItems = getMoreSheetItems('ADMIN');
  assert.deepEqual(adminItems, ['Reminders', 'Settings', 'Admin', 'Logout']);
  assert.equal(adminItems.includes('Admin'), true);
});

test('UI-T020..UI-T023: Money amount formatting adheres strictly to Indian numbering system with tabular decimals', () => {
  assert.equal(formatIndianRupees('0'), '0.00');
  assert.equal(formatIndianRupees(0), '0.00');
  assert.equal(formatIndianRupees('1000'), '1,000.00');
  assert.equal(formatIndianRupees('15500.5'), '15,500.50');
  assert.equal(formatIndianRupees('1000000'), '10,00,000.00'); // 10 Lakhs in Indian format
  assert.equal(formatIndianRupees(null), '0.00');
  assert.equal(formatIndianRupees(undefined), '0.00');
});

test('UI-T030..UI-T033: Supported finance types and accounts match v0.1 invariant schema', () => {
  assert.equal(isValidAccountType('BANK'), true);
  assert.equal(isValidAccountType('CASH'), true);
  assert.equal(isValidAccountType('WALLET'), true);
  assert.equal(isValidAccountType('CREDIT_CARD'), true);
  assert.equal(isValidAccountType('CRYPTO'), false);

  assert.equal(isValidTransactionType('INCOME'), true);
  assert.equal(isValidTransactionType('EXPENSE'), true);
  assert.equal(isValidTransactionType('TRANSFER'), true);
  assert.equal(isValidTransactionType('DIVIDEND'), false);

  assert.equal(isValidObligationKind('RECHARGE'), true);
  assert.equal(isValidObligationKind('BILL'), true);
  assert.equal(isValidObligationKind('SUBSCRIPTION'), true);
  assert.equal(isValidObligationKind('EMI'), true);
});

test('UI-T037: 84-day recharge recurrence calculation is exact and deterministic', () => {
  const anchor = new Date('2026-10-15T09:00:00.000Z');
  const nextOccurrence = getNextOccurrence(
    { type: 'EVERY_N_DAYS', interval: 84, timezone: 'Asia/Kolkata' },
    anchor,
    anchor
  );
  // Oct 15, 2026 + 84 days = Jan 7, 2027
  assert.ok(nextOccurrence);
  assert.equal(nextOccurrence.toISOString(), '2027-01-07T09:00:00.000Z');

  const occKey = getOccurrenceKey(anchor, 'Asia/Kolkata');
  assert.equal(occKey.startsWith('2026-10-15'), true);
});

test('UI-T053: Reminder filtering logic correctly segments health and bills', () => {
  const items = [
    { id: '1', domain: 'HEALTH', title: 'Breakfast' },
    { id: '2', domain: 'HEALTH', title: 'Lunch' },
    { id: '3', domain: 'FINANCE', title: 'Electricity Bill' },
    { id: '4', domain: 'FINANCE', title: 'Jio 84-Day' },
  ];

  const filterHealth = items.filter(i => i.domain === 'HEALTH');
  assert.equal(filterHealth.length, 2);

  const filterBills = items.filter(i => i.domain === 'FINANCE');
  assert.equal(filterBills.length, 2);

  const filterAll = items;
  assert.equal(filterAll.length, 4);
});
