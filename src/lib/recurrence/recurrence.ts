import { TZDate } from '@date-fns/tz';

export type RecurrenceType =
  | 'ONCE'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY'
  | 'EVERY_N_DAYS';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval?: number | null; // e.g., 1 for every month, 28/56/84 for EVERY_N_DAYS
  activeDays?: string[] | null; // e.g., ['Monday', 'Wednesday']
  targetDayOfMonth?: number | null; // explicit day (1-31), if omitted derived from anchor in user's timezone
  timezone: string; // e.g. 'Asia/Kolkata', 'UTC', 'America/New_York'
}

export interface NotificationOffsetSchedule {
  offsetMinutes: number;
  notificationTime: Date;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Returns the number of days in the given month of the given year.
 * month is 0-indexed (0 = Jan, 1 = Feb, ... 11 = Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Clamps a target day of the month to the maximum valid day in that month.
 * e.g., Jan 31 in Feb (non-leap) -> Feb 28.
 */
export function clampDayToMonth(year: number, month: number, targetDay: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.max(1, Math.min(targetDay, maxDays));
}

/**
 * Returns a unique, deterministic occurrence key for an occurrence at dueAt.
 * Formatted as YYYY-MM-DDTHH:mm in the given timezone.
 */
export function getOccurrenceKey(dueAt: Date, timezone: string = 'UTC'): string {
  const d = new TZDate(dueAt, timezone);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Calculates notification times for a given dueAt and list of offsets in minutes.
 * Returns sorted ascending by notification time.
 */
export function getNotificationTimes(
  dueAt: Date,
  offsetsMinutes: number[] = [0]
): NotificationOffsetSchedule[] {
  const uniqueOffsets = Array.from(new Set(offsetsMinutes)).sort((a, b) => b - a);
  return uniqueOffsets.map((offsetMinutes) => ({
    offsetMinutes,
    notificationTime: new Date(dueAt.getTime() - offsetMinutes * 60 * 1000)
  })).sort((a, b) => a.notificationTime.getTime() - b.notificationTime.getTime());
}

/**
 * Checks if a scheduled notification is due right now within a given tolerance window.
 */
export function isDue(
  now: Date,
  notificationTime: Date,
  windowMinutes: number = 5
): boolean {
  const diffMs = now.getTime() - notificationTime.getTime();
  return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000;
}

/**
 * Calculates the next occurrence strictly after `after` for a given recurrence rule and anchor.
 * Returns null if no future occurrence exists (e.g. for ONCE).
 *
 * Invariants:
 * 1. Time-of-day is preserved in the user's timezone across DST and standard time.
 * 2. Monthly recurrence clamps to month-end without permanent drift (Jan 31 -> Feb 28 -> Mar 31).
 * 3. Yearly recurrence on Feb 29 clamps to Feb 28 in non-leap years, and fires on Feb 29 in leap years.
 * 4. EVERY_N_DAYS advances by exact multiples of N days from the anchor.
 * 5. Snooze changes delivery attempt but does not mutate the recurrence anchor.
 */
export function getNextOccurrence(
  rule: RecurrenceRule,
  anchor: Date,
  after: Date
): Date | null {
  const tz = rule.timezone || 'UTC';
  const anchorInTz = new TZDate(anchor, tz);
  const afterInTz = new TZDate(after, tz);

  const anchorHour = anchorInTz.getHours();
  const anchorMinute = anchorInTz.getMinutes();
  const anchorSecond = anchorInTz.getSeconds();

  switch (rule.type) {
    case 'ONCE': {
      if (anchor.getTime() > after.getTime()) {
        return new Date(anchor.getTime());
      }
      return null;
    }

    case 'DAILY': {
      const interval = Math.max(1, rule.interval ?? 1);
      if (anchor.getTime() > after.getTime()) {
        return new Date(anchor.getTime());
      }

      // Start from anchor date in user timezone
      let currentYear = anchorInTz.getFullYear();
      let currentMonth = anchorInTz.getMonth();
      let currentDay = anchorInTz.getDate();

      // Estimate steps to jump close to after date for efficiency
      const msDiff = after.getTime() - anchor.getTime();
      const approxDays = Math.floor(msDiff / (24 * 60 * 60 * 1000));
      const steps = Math.max(1, Math.floor(approxDays / interval));

      let candidate = new TZDate(
        currentYear,
        currentMonth,
        currentDay + steps * interval,
        anchorHour,
        anchorMinute,
        anchorSecond,
        0,
        tz
      );

      while (candidate.getTime() <= after.getTime()) {
        candidate = new TZDate(
          candidate.getFullYear(),
          candidate.getMonth(),
          candidate.getDate() + interval,
          anchorHour,
          anchorMinute,
          anchorSecond,
          0,
          tz
        );
      }

      return new Date(candidate.getTime());
    }

    case 'WEEKLY': {
      const intervalWeeks = Math.max(1, rule.interval ?? 1);
      const activeDays = rule.activeDays && rule.activeDays.length > 0
        ? rule.activeDays
        : [WEEKDAY_NAMES[anchorInTz.getDay()]];

      if (anchor.getTime() > after.getTime() && activeDays.includes(WEEKDAY_NAMES[anchorInTz.getDay()])) {
        return new Date(anchor.getTime());
      }

      // Anchor's Sunday in user timezone
      const anchorDayOfWeek = anchorInTz.getDay();
      const anchorSunday = new TZDate(
        anchorInTz.getFullYear(),
        anchorInTz.getMonth(),
        anchorInTz.getDate() - anchorDayOfWeek,
        0,
        0,
        0,
        0,
        tz
      );
      const anchorSundayMs = anchorSunday.getTime();

      // Estimate starting cursor
      let cursor = new TZDate(
        anchorInTz.getFullYear(),
        anchorInTz.getMonth(),
        anchorInTz.getDate(),
        anchorHour,
        anchorMinute,
        anchorSecond,
        0,
        tz
      );

      // Fast-forward close to `after` if it is in the future
      if (after.getTime() > cursor.getTime()) {
        const afterDayOfWeek = afterInTz.getDay();
        const afterSunday = new TZDate(
          afterInTz.getFullYear(),
          afterInTz.getMonth(),
          afterInTz.getDate() - afterDayOfWeek,
          0,
          0,
          0,
          0,
          tz
        );
        const rawWeeks = Math.floor((afterSunday.getTime() - anchorSundayMs) / (7 * 24 * 60 * 60 * 1000));
        if (rawWeeks > 0) {
          const intervalsToSkip = Math.max(0, Math.floor(rawWeeks / intervalWeeks));
          const weeksToSkip = intervalsToSkip * intervalWeeks;
          if (weeksToSkip > 0) {
            cursor = new TZDate(
              anchorSunday.getFullYear(),
              anchorSunday.getMonth(),
              anchorSunday.getDate() + (weeksToSkip * 7),
              anchorHour,
              anchorMinute,
              anchorSecond,
              0,
              tz
            );
          }
        }
      }

      while (true) {
        const cursorDayOfWeek = cursor.getDay();
        const cursorSunday = new TZDate(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate() - cursorDayOfWeek,
          0,
          0,
          0,
          0,
          tz
        );
        const diffWeeks = Math.round((cursorSunday.getTime() - anchorSundayMs) / (7 * 24 * 60 * 60 * 1000));
        const isIntervalWeek = diffWeeks >= 0 && (diffWeeks % intervalWeeks === 0);

        if (!isIntervalWeek) {
          // Jump to Sunday of next week
          cursor = new TZDate(
            cursorSunday.getFullYear(),
            cursorSunday.getMonth(),
            cursorSunday.getDate() + 7,
            anchorHour,
            anchorMinute,
            anchorSecond,
            0,
            tz
          );
          continue;
        }

        if (
          cursor.getTime() >= anchor.getTime() &&
          cursor.getTime() > after.getTime() &&
          activeDays.includes(WEEKDAY_NAMES[cursor.getDay()])
        ) {
          return new Date(cursor.getTime());
        }

        // Advance by 1 day
        cursor = new TZDate(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate() + 1,
          anchorHour,
          anchorMinute,
          anchorSecond,
          0,
          tz
        );
      }
    }

    case 'MONTHLY': {
      const intervalMonths = Math.max(1, rule.interval ?? 1);
      const targetDay = rule.targetDayOfMonth ?? anchorInTz.getDate();

      if (anchor.getTime() > after.getTime()) {
        return new Date(anchor.getTime());
      }

      // Advance month by month from anchor
      const anchorYear = anchorInTz.getFullYear();
      const anchorMonth = anchorInTz.getMonth();

      // Estimate month offset
      const yearDiff = afterInTz.getFullYear() - anchorYear;
      const monthDiff = yearDiff * 12 + (afterInTz.getMonth() - anchorMonth);
      let step = Math.max(1, Math.floor(monthDiff / intervalMonths));

      while (true) {
        const totalMonths = anchorMonth + step * intervalMonths;
        const candidateYear = anchorYear + Math.floor(totalMonths / 12);
        const candidateMonth = ((totalMonths % 12) + 12) % 12;
        const clampedDay = clampDayToMonth(candidateYear, candidateMonth, targetDay);

        const candidate = new TZDate(
          candidateYear,
          candidateMonth,
          clampedDay,
          anchorHour,
          anchorMinute,
          anchorSecond,
          0,
          tz
        );

        if (candidate.getTime() > after.getTime()) {
          return new Date(candidate.getTime());
        }
        step++;
      }
    }

    case 'YEARLY': {
      const intervalYears = Math.max(1, rule.interval ?? 1);
      const targetMonth = anchorInTz.getMonth();
      const targetDay = rule.targetDayOfMonth ?? anchorInTz.getDate();

      if (anchor.getTime() > after.getTime()) {
        return new Date(anchor.getTime());
      }

      const anchorYear = anchorInTz.getFullYear();
      const yearDiff = afterInTz.getFullYear() - anchorYear;
      let step = Math.max(0, Math.floor(yearDiff / intervalYears));

      while (true) {
        const candidateYear = anchorYear + step * intervalYears;
        const clampedDay = clampDayToMonth(candidateYear, targetMonth, targetDay);

        const candidate = new TZDate(
          candidateYear,
          targetMonth,
          clampedDay,
          anchorHour,
          anchorMinute,
          anchorSecond,
          0,
          tz
        );

        if (candidate.getTime() > after.getTime()) {
          return new Date(candidate.getTime());
        }
        step++;
      }
    }

    case 'EVERY_N_DAYS': {
      const intervalDays = Math.max(1, rule.interval ?? 1);

      if (anchor.getTime() > after.getTime()) {
        return new Date(anchor.getTime());
      }

      const anchorYear = anchorInTz.getFullYear();
      const anchorMonth = anchorInTz.getMonth();
      const anchorDay = anchorInTz.getDate();

      const msDiff = after.getTime() - anchor.getTime();
      const estimatedSteps = Math.floor(msDiff / (intervalDays * 24 * 60 * 60 * 1000));
      let step = Math.max(1, estimatedSteps);

      while (true) {
        const candidate = new TZDate(
          anchorYear,
          anchorMonth,
          anchorDay + step * intervalDays,
          anchorHour,
          anchorMinute,
          anchorSecond,
          0,
          tz
        );

        if (candidate.getTime() > after.getTime()) {
          return new Date(candidate.getTime());
        }
        step++;
      }
    }

    default:
      return null;
  }
}
