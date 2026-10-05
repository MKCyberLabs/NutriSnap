import assert from 'node:assert/strict';
import test from 'node:test';
import { TZDate } from '@date-fns/tz';
import {
  getNextOccurrence,
  getOccurrenceKey,
  getNotificationTimes,
  isDue,
  clampDayToMonth,
  getDaysInMonth,
  RecurrenceRule
} from './recurrence';

test('NSV01-0230: ONCE future occurrence deterministic', () => {
  const anchor = new Date('2026-10-15T10:00:00.000Z');
  const rule: RecurrenceRule = { type: 'ONCE', timezone: 'UTC' };

  // Before anchor -> returns anchor
  const before = new Date('2026-10-10T00:00:00.000Z');
  const next1 = getNextOccurrence(rule, anchor, before);
  assert.equal(next1?.toISOString(), anchor.toISOString());

  // At or after anchor -> returns null (completed)
  const after = new Date('2026-10-15T10:00:00.000Z');
  const next2 = getNextOccurrence(rule, anchor, after);
  assert.equal(next2, null);
});

test('NSV01-0231: DAILY recurrence deterministic', () => {
  const rule: RecurrenceRule = { type: 'DAILY', interval: 1, timezone: 'Asia/Kolkata' };
  // 10:30 AM IST on Oct 10, 2026 (05:00 UTC)
  const anchor = new TZDate(2026, 9, 10, 10, 30, 0, 'Asia/Kolkata');

  // Next after anchor
  const next1 = getNextOccurrence(rule, anchor, anchor);
  assert.ok(next1);
  const next1InTz = new TZDate(next1, 'Asia/Kolkata');
  assert.equal(next1InTz.getFullYear(), 2026);
  assert.equal(next1InTz.getMonth(), 9); // October
  assert.equal(next1InTz.getDate(), 11);
  assert.equal(next1InTz.getHours(), 10);
  assert.equal(next1InTz.getMinutes(), 30);

  // Jump several days forward
  const futureAfter = new TZDate(2026, 9, 15, 12, 0, 0, 'Asia/Kolkata');
  const next2 = getNextOccurrence(rule, anchor, futureAfter);
  assert.ok(next2);
  const next2InTz = new TZDate(next2, 'Asia/Kolkata');
  assert.equal(next2InTz.getDate(), 16);
  assert.equal(next2InTz.getHours(), 10);
  assert.equal(next2InTz.getMinutes(), 30);
});

test('NSV01-0232: WEEKLY recurrence deterministic', () => {
  // Weekly on Mondays and Thursdays in UTC
  const rule: RecurrenceRule = {
    type: 'WEEKLY',
    activeDays: ['Monday', 'Thursday'],
    timezone: 'UTC'
  };
  // Monday Oct 5, 2026 at 09:00 UTC
  const anchor = new Date('2026-10-05T09:00:00.000Z');

  // Next after Monday should be Thursday Oct 8, 2026
  const next1 = getNextOccurrence(rule, anchor, anchor);
  assert.ok(next1);
  assert.equal(next1.toISOString(), '2026-10-08T09:00:00.000Z');

  // Next after Thursday Oct 8 should be Monday Oct 12, 2026
  const next2 = getNextOccurrence(rule, anchor, next1);
  assert.ok(next2);
  assert.equal(next2.toISOString(), '2026-10-12T09:00:00.000Z');
});

test('NSV01-0233 & NSV01-0234: MONTHLY Jan 31 clamps to Feb 28 and does NOT drift in March', () => {
  // Anchored on January 31, 2026 at 15:00 UTC (non-leap year)
  const anchor = new Date('2026-01-31T15:00:00.000Z');
  const rule: RecurrenceRule = {
    type: 'MONTHLY',
    interval: 1,
    timezone: 'UTC'
  };

  // 1. Next after Jan 31 -> February 28, 2026 (clamped)
  const febOccurrence = getNextOccurrence(rule, anchor, anchor);
  assert.ok(febOccurrence);
  assert.equal(febOccurrence.toISOString(), '2026-02-28T15:00:00.000Z');

  // 2. Next after Feb 28 -> March 31, 2026 (restores day 31, NO DRIFT to 28!)
  const marOccurrence = getNextOccurrence(rule, anchor, febOccurrence);
  assert.ok(marOccurrence);
  assert.equal(marOccurrence.toISOString(), '2026-03-31T15:00:00.000Z');

  // 3. Next after March 31 -> April 30, 2026 (clamped to 30)
  const aprOccurrence = getNextOccurrence(rule, anchor, marOccurrence);
  assert.ok(aprOccurrence);
  assert.equal(aprOccurrence.toISOString(), '2026-04-30T15:00:00.000Z');

  // 4. Next after April 30 -> May 31, 2026 (restores day 31!)
  const mayOccurrence = getNextOccurrence(rule, anchor, aprOccurrence);
  assert.ok(mayOccurrence);
  assert.equal(mayOccurrence.toISOString(), '2026-05-31T15:00:00.000Z');
});

test('NSV01-0235: YEARLY leap-day rule explicit and tested', () => {
  // Anchored on Feb 29, 2024 (leap year) at 12:00 UTC
  const anchor = new Date('2024-02-29T12:00:00.000Z');
  const rule: RecurrenceRule = {
    type: 'YEARLY',
    interval: 1,
    timezone: 'UTC'
  };

  // In 2025 (non-leap year), clamps to Feb 28
  const next2025 = getNextOccurrence(rule, anchor, anchor);
  assert.ok(next2025);
  assert.equal(next2025.toISOString(), '2025-02-28T12:00:00.000Z');

  // In 2026 (non-leap year), clamps to Feb 28
  const next2026 = getNextOccurrence(rule, anchor, next2025);
  assert.ok(next2026);
  assert.equal(next2026.toISOString(), '2026-02-28T12:00:00.000Z');

  // In 2027 (non-leap year), clamps to Feb 28
  const next2027 = getNextOccurrence(rule, anchor, next2026);
  assert.ok(next2027);
  assert.equal(next2027.toISOString(), '2027-02-28T12:00:00.000Z');

  // In 2028 (leap year), returns Feb 29!
  const next2028 = getNextOccurrence(rule, anchor, next2027);
  assert.ok(next2028);
  assert.equal(next2028.toISOString(), '2028-02-29T12:00:00.000Z');
});

test('NSV01-0236: EVERY_N_DAYS for 28, 56, and 84 days', () => {
  // Mobile recharge use cases: 28 days, 56 days, 84 days
  const anchor = new Date('2026-01-01T09:00:00.000Z');

  // 28 days
  const rule28: RecurrenceRule = { type: 'EVERY_N_DAYS', interval: 28, timezone: 'UTC' };
  const next28 = getNextOccurrence(rule28, anchor, anchor);
  assert.ok(next28);
  // Jan 1 + 28 days = Jan 29
  assert.equal(next28.toISOString(), '2026-01-29T09:00:00.000Z');

  // 56 days
  const rule56: RecurrenceRule = { type: 'EVERY_N_DAYS', interval: 56, timezone: 'UTC' };
  const next56 = getNextOccurrence(rule56, anchor, anchor);
  assert.ok(next56);
  // Jan 1 + 56 days = Feb 26
  assert.equal(next56.toISOString(), '2026-02-26T09:00:00.000Z');

  // 84 days
  const rule84: RecurrenceRule = { type: 'EVERY_N_DAYS', interval: 84, timezone: 'UTC' };
  const next84 = getNextOccurrence(rule84, anchor, anchor);
  assert.ok(next84);
  // Jan 1 + 84 days = Mar 26
  assert.equal(next84.toISOString(), '2026-03-26T09:00:00.000Z');

  // Advancing after next84 produces anchor + 168 days
  const next84_2 = getNextOccurrence(rule84, anchor, next84);
  assert.ok(next84_2);
  const diffDays = (next84_2.getTime() - next84.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(diffDays, 84);
});

test('NSV01-0237: Asia/Kolkata local time preservation', () => {
  // Recharge at 18:00 IST every 84 days
  const tz = 'Asia/Kolkata';
  const anchor = new TZDate(2026, 0, 1, 18, 0, 0, tz); // 2026-01-01 18:00 IST
  const rule: RecurrenceRule = { type: 'EVERY_N_DAYS', interval: 84, timezone: tz };

  const next = getNextOccurrence(rule, anchor, anchor);
  assert.ok(next);
  const nextInTz = new TZDate(next, tz);
  assert.equal(nextInTz.getHours(), 18);
  assert.equal(nextInTz.getMinutes(), 0);
  assert.equal(nextInTz.getFullYear(), 2026);
  assert.equal(nextInTz.getMonth(), 2); // March
  assert.equal(nextInTz.getDate(), 26);
});

test('NSV01-0238: Representative DST transition preservation (America/New_York)', () => {
  // Daily reminder at 09:00 local time in America/New_York
  // US DST transition in 2026: Nov 1, 2026 (clocks go back 1 hr from EDT to EST)
  const tz = 'America/New_York';
  const rule: RecurrenceRule = { type: 'DAILY', interval: 1, timezone: tz };

  // Oct 31, 2026 at 09:00 EDT (13:00 UTC)
  const oct31 = new TZDate(2026, 9, 31, 9, 0, 0, tz);
  assert.equal(oct31.getHours(), 9);

  // Next day: Nov 1, 2026 (DST shift occurs at 02:00)
  const nov1 = getNextOccurrence(rule, oct31, oct31);
  assert.ok(nov1);
  const nov1InTz = new TZDate(nov1, tz);
  assert.equal(nov1InTz.getHours(), 9); // Still 09:00 AM local time!

  // Next day: Nov 2, 2026 in standard time (EST, 14:00 UTC)
  const nov2 = getNextOccurrence(rule, oct31, nov1);
  assert.ok(nov2);
  const nov2InTz = new TZDate(nov2, tz);
  assert.equal(nov2InTz.getHours(), 9); // Still 09:00 AM local time!
  assert.equal(nov2.toISOString(), '2026-11-02T14:00:00.000Z');
});

test('NSV01-0239: Snooze changes delivery attempt but NOT recurrence anchor', () => {
  // Monthly bill due on 15th of each month at 10:00 UTC
  const anchor = new Date('2026-10-15T10:00:00.000Z');
  const rule: RecurrenceRule = { type: 'MONTHLY', interval: 1, timezone: 'UTC' };

  // User snoozes the reminder to Oct 18, 2026
  const snoozedUntil = new Date('2026-10-18T10:00:00.000Z');

  // The recurrence anchor remains Oct 15, 2026.
  // When Paid on Oct 18, the next occurrence must be November 15, 2026, NOT Nov 18!
  const nextOccurrence = getNextOccurrence(rule, anchor, anchor);
  assert.ok(nextOccurrence);
  assert.equal(nextOccurrence.toISOString(), '2026-11-15T10:00:00.000Z');
  assert.notEqual(nextOccurrence.toISOString(), '2026-11-18T10:00:00.000Z');
});

test('Deterministic occurrence keys and notification offsets', () => {
  const dueAt = new Date('2026-10-15T14:30:00.000Z');

  // Occurrence key in UTC
  const keyUtc = getOccurrenceKey(dueAt, 'UTC');
  assert.equal(keyUtc, '2026-10-15T14:30');

  // Occurrence key in Asia/Kolkata (+5:30 -> 20:00)
  const keyIst = getOccurrenceKey(dueAt, 'Asia/Kolkata');
  assert.equal(keyIst, '2026-10-15T20:00');

  // Offsets: 0 (due time), 1440 (1 day), 4320 (3 days), 10080 (7 days)
  const offsets = [0, 1440, 4320, 10080];
  const schedules = getNotificationTimes(dueAt, offsets);

  assert.equal(schedules.length, 4);
  // Sorted by notification time ascending:
  // 1. 7 days before
  assert.equal(schedules[0].offsetMinutes, 10080);
  assert.equal(schedules[0].notificationTime.toISOString(), '2026-10-08T14:30:00.000Z');
  // 2. 3 days before
  assert.equal(schedules[1].offsetMinutes, 4320);
  assert.equal(schedules[1].notificationTime.toISOString(), '2026-10-12T14:30:00.000Z');
  // 3. 1 day before
  assert.equal(schedules[2].offsetMinutes, 1440);
  assert.equal(schedules[2].notificationTime.toISOString(), '2026-10-14T14:30:00.000Z');
  // 4. At due time
  assert.equal(schedules[3].offsetMinutes, 0);
  assert.equal(schedules[3].notificationTime.toISOString(), '2026-10-15T14:30:00.000Z');
});

test('isDue tolerance window check', () => {
  const notifTime = new Date('2026-10-15T10:00:00.000Z');

  // 1 second before -> false
  assert.equal(isDue(new Date('2026-10-15T09:59:59.000Z'), notifTime, 5), false);

  // Exactly on time -> true
  assert.equal(isDue(new Date('2026-10-15T10:00:00.000Z'), notifTime, 5), true);

  // 2 minutes later -> true
  assert.equal(isDue(new Date('2026-10-15T10:02:00.000Z'), notifTime, 5), true);

  // 5 minutes later -> true
  assert.equal(isDue(new Date('2026-10-15T10:05:00.000Z'), notifTime, 5), true);

  // 6 minutes later -> false (outside window)
  assert.equal(isDue(new Date('2026-10-15T10:06:00.000Z'), notifTime, 5), false);
});
