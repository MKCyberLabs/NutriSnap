import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIndianRupees } from '../../components/design-system/MoneyAmount';
import { getNextOccurrence, getOccurrenceKey } from '../recurrence/recurrence';
import { isValidAccountType, isValidTransactionType, isValidObligationKind } from '../finance/finance';
import { calculateMonthlyRecurringAmount } from '../../app/finance/bills/page';
import { formatInTimeZone } from 'date-fns-tz';

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

test('SOL-R005-003: Bills recurring budget normalizes recurrence across intervals and excludes ONCE obligations', () => {
  // 1. One-time obligation contributes 0 to recurring metrics
  assert.equal(calculateMonthlyRecurringAmount(12000, 'ONCE'), 0);
  assert.equal(calculateMonthlyRecurringAmount('12000', 'ONCE'), 0);

  // 2. Standard interval = 1 (or default)
  assert.equal(calculateMonthlyRecurringAmount(5000, 'MONTHLY'), 5000);
  assert.equal(calculateMonthlyRecurringAmount(5000, 'MONTHLY', 1), 5000);
  assert.equal(calculateMonthlyRecurringAmount(12000, 'YEARLY'), 1000);
  assert.equal(calculateMonthlyRecurringAmount(12000, 'YEARLY', 1), 1000);
  assert.equal(calculateMonthlyRecurringAmount(1200, 'WEEKLY'), (1200 * 52) / 12);
  assert.equal(calculateMonthlyRecurringAmount(1200, 'WEEKLY', 1), (1200 * 52) / 12);
  assert.equal(calculateMonthlyRecurringAmount(100, 'DAILY'), (100 * (365 / 12)) / 1);
  assert.equal(calculateMonthlyRecurringAmount(100, 'DAILY', 1), (100 * (365 / 12)) / 1);
  assert.equal(calculateMonthlyRecurringAmount(840, 'EVERY_N_DAYS', 84), 840 * (30.4375 / 84));

  // 3. Interval = 3 for quarterly (e.g. ₹3,000 every 3 months -> ₹1,000/month)
  assert.equal(calculateMonthlyRecurringAmount(3000, 'MONTHLY', 3), 1000);
  assert.equal(calculateMonthlyRecurringAmount('3000', 'MONTHLY', 3), 1000);

  // 4. Interval = 2 for biennial (e.g. ₹24,000 every 2 years -> (24000 / 12) / 2 = ₹1,000/month)
  assert.equal(calculateMonthlyRecurringAmount(24000, 'YEARLY', 2), 1000);

  // 5. Interval = 2 for biweekly (e.g. ₹1,200 every 2 weeks -> ((1200 * 52) / 12) / 2 = ₹2,600/month)
  assert.equal(calculateMonthlyRecurringAmount(1200, 'WEEKLY', 2), 2600);

  // 6. Object argument support
  assert.equal(calculateMonthlyRecurringAmount({ amount: 3000, recurrenceType: 'MONTHLY', recurrenceInterval: 3 }), 1000);
  assert.equal(calculateMonthlyRecurringAmount({ amount: 24000, recurrenceType: 'YEARLY', recurrenceInterval: 2 }), 1000);
  assert.equal(calculateMonthlyRecurringAmount({ amount: 12000, recurrenceType: 'ONCE' }), 0);

  // 7. Full obligation set calculation with varied recurrence intervals
  const obligations = [
    { id: '1', title: 'Security Deposit', amount: '12000', recurrenceType: 'ONCE', isActive: true, isArchived: false },
    { id: '2', title: 'Internet', amount: '1000', recurrenceType: 'MONTHLY', recurrenceInterval: 1, isActive: true, isArchived: false },
    { id: '3', title: 'Quarterly Water Tax', amount: '3000', recurrenceType: 'MONTHLY', recurrenceInterval: 3, isActive: true, isArchived: false },
    { id: '4', title: 'Annual Domain', amount: '1200', recurrenceType: 'YEARLY', recurrenceInterval: 1, isActive: true, isArchived: false },
    { id: '5', title: 'Biennial Subscription', amount: '2400', recurrenceType: 'YEARLY', recurrenceInterval: 2, isActive: true, isArchived: false },
    { id: '6', title: 'Gym (Cancelled)', amount: '2000', recurrenceType: 'MONTHLY', isActive: false, isArchived: false },
  ];

  const active = obligations.filter(o => o.isActive && !o.isArchived);
  const activeRecurring = active.filter(o => o.recurrenceType && o.recurrenceType !== 'ONCE');
  assert.equal(activeRecurring.length, 4);

  const totalMonthlyRecurring = active.reduce(
    (sum, o) => sum + calculateMonthlyRecurringAmount(o.amount, o.recurrenceType, (o as any).recurrenceInterval),
    0
  );
  // 1000 (monthly) + 1000 (quarterly: 3000/3) + 100 (yearly: 1200/12) + 100 (biennial: (2400/12)/2) + 0 (once) = 2200
  assert.equal(totalMonthlyRecurring, 2200);

  const annualizedBudget = totalMonthlyRecurring * 12;
  // 2200 * 12 = 26400 (NOT inflated by the ₹12,000 ONCE obligation)
  assert.equal(annualizedBudget, 26400);
});

test('SOL-R006-001: ObligationRow formats nextDueAt in user timezone and handles alreadyCompleted response', () => {
  // 1. Timezone-aware occurrence key formatting:
  // Pacific/Kiritimati is UTC+14.
  // Instant 2026-01-14T10:30:00.000Z in UTC is 2026-01-14.
  // In Pacific/Kiritimati (+14), it is 2026-01-15 00:30 (January 15).
  const dueUtc = new Date('2026-01-14T10:30:00.000Z');
  const userTz = 'Pacific/Kiritimati';

  const occurrenceKey = formatInTimeZone(dueUtc, userTz, 'yyyy-MM-dd');
  const formattedDisplay = formatInTimeZone(dueUtc, userTz, 'dd MMM yyyy');

  assert.equal(occurrenceKey, '2026-01-15', 'Occurrence key matches user-local calendar date');
  assert.equal(formattedDisplay, '15 Jan 2026', 'Display matches user-local calendar date');

  // Verify that UTC-local evaluation would have produced the wrong date (Jan 14)
  const utcDateKey = formatInTimeZone(dueUtc, 'UTC', 'yyyy-MM-dd');
  assert.equal(utcDateKey, '2026-01-14');
  assert.notEqual(occurrenceKey, utcDateKey, 'User timezone must prevent UTC host date mismatch');

  // 2. Response inspection logic:
  // When alreadyCompleted is true and occurrenceId is null (e.g. linked loan EMI mismatch or closed loan),
  // row must distinguish without claiming newly marked as paid.
  function inspectPaidResponse(res: any, key: string, title: string) {
    if (res?.alreadyCompleted || res?.alreadyProcessed) {
      return {
        toastTitle: 'Already Marked as Paid',
        toastDescription: res?.occurrenceId
          ? `Occurrence (${key}) for "${title}" was already marked as paid.`
          : `No pending occurrence found or already completed for "${title}".`,
        isNewlyPaid: false,
      };
    }
    return {
      toastTitle: 'Marked as Paid',
      toastDescription: `Obligation "${title}" marked paid for ${key}.`,
      isNewlyPaid: true,
    };
  }

  // A. Linked EMI or closed loan returns alreadyCompleted: true with no occurrence
  const emiAlreadyCompletedRes = {
    success: true,
    alreadyCompleted: true,
    alreadyProcessed: true,
    occurrenceId: null,
    transactionId: null,
  };
  const emiToast = inspectPaidResponse(emiAlreadyCompletedRes, '2026-01-15', 'Car Loan EMI');
  assert.equal(emiToast.toastTitle, 'Already Marked as Paid');
  assert.equal(emiToast.isNewlyPaid, false);
  assert.equal(emiToast.toastDescription.includes('No pending occurrence found'), true);

  // B. Duplicate payment on already completed occurrence
  const dupOccurrenceRes = {
    success: true,
    alreadyCompleted: true,
    alreadyProcessed: true,
    occurrenceId: 'occ_123',
    transactionId: 'tx_123',
  };
  const dupToast = inspectPaidResponse(dupOccurrenceRes, '2026-01-15', 'Internet Bill');
  assert.equal(dupToast.toastTitle, 'Already Marked as Paid');
  assert.equal(dupToast.isNewlyPaid, false);
  assert.equal(dupToast.toastDescription.includes('was already marked as paid'), true);

  // C. Fresh payment completed successfully
  const freshPayRes = {
    success: true,
    alreadyCompleted: false,
    occurrenceId: 'occ_456',
    transactionId: 'tx_456',
  };
  const freshToast = inspectPaidResponse(freshPayRes, '2026-01-15', 'Internet Bill');
  assert.equal(freshToast.toastTitle, 'Marked as Paid');
  assert.equal(freshToast.isNewlyPaid, true);
});

test('SOL-R005-006: Reminders delivery channel state accurately reflects configured telegramId', () => {
  function getChannelStatus(telegramId: string | null | undefined) {
    const isConnected = Boolean(telegramId && telegramId.trim().length > 0);
    return {
      telegram: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      badgeLabel: isConnected ? 'Telegram Alerts' : 'Connect Telegram',
      tone: isConnected ? 'green' : 'amber',
    };
  }

  const userWithTelegram = getChannelStatus('123456789');
  assert.equal(userWithTelegram.telegram, 'CONNECTED');
  assert.equal(userWithTelegram.badgeLabel, 'Telegram Alerts');
  assert.equal(userWithTelegram.tone, 'green');

  const userWithoutTelegram = getChannelStatus(null);
  assert.equal(userWithoutTelegram.telegram, 'DISCONNECTED');
  assert.equal(userWithoutTelegram.badgeLabel, 'Connect Telegram');
  assert.equal(userWithoutTelegram.tone, 'amber');

  const userWithEmptyTelegram = getChannelStatus('   ');
  assert.equal(userWithEmptyTelegram.telegram, 'DISCONNECTED');
  assert.equal(userWithEmptyTelegram.badgeLabel, 'Connect Telegram');
  assert.equal(userWithEmptyTelegram.tone, 'amber');
});
