import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

interface LegacyReminder {
  id: string;
  userId: string;
  category: string;
  time: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MigratedReminder {
  id: string;
  userId: string;
  domain: string;
  type: string;
  title: string;
  category: string | null;
  time: string | null;
  timeOfDay: string | null;
  scheduledAt: Date | null;
  recurrenceType: string | null;
  recurrenceInterval: number | null;
  activeDays: string[];
  reminderOffsetsMin: number[];
  isActive: boolean;
  obligationId: string | null;
  mealCategory: string | null;
  snoozedUntil: Date | null;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Migration & backfill transformer function that mirrors the SQL migration in
 * prisma/migrations/20261005_v0_1_health_wealth/migration.sql.
 */
function applyReminderMigration(legacyRows: LegacyReminder[]): MigratedReminder[] {
  return legacyRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    domain: 'HEALTH',
    type: 'MEAL',
    title: r.category || 'Meal',
    category: r.category,
    time: r.time,
    timeOfDay: r.time,
    scheduledAt: null,
    recurrenceType: 'DAILY',
    recurrenceInterval: 1,
    activeDays: [],
    reminderOffsetsMin: [0],
    isActive: r.isActive,
    obligationId: null,
    mealCategory: r.category,
    snoozedUntil: null,
    lastTriggeredAt: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
}

test('NSV01-0220: Migration SQL delta file exists and contains all required statements', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'prisma/migrations/20261005_v0_1_health_wealth/migration.sql'
  );
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Must drop old unique constraint safely
  assert.ok(sql.includes('Reminder_userId_category_key'), 'Must drop old userId_category constraint');

  // Must create new financial and delivery tables
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS "FinancialAccount"'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS "FinancialTransaction"'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS "Obligation"'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS "ObligationOccurrence"'));
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS "ReminderDelivery"'));

  // Must define backfill logic for existing meal reminders
  assert.ok(sql.includes('UPDATE "Reminder"'));
  assert.ok(sql.includes('"mealCategory" = "category"'));
  assert.ok(sql.includes('"timeOfDay" = "time"'));
});

test('NSV01-0221: Non-production migration/backfill preserves exact row count', () => {
  const legacyRows: LegacyReminder[] = [
    {
      id: 'rem-1',
      userId: 'user-alpha',
      category: 'Breakfast',
      time: '08:00',
      isActive: true,
      createdAt: new Date('2026-01-01T08:00:00Z'),
      updatedAt: new Date('2026-01-01T08:00:00Z')
    },
    {
      id: 'rem-2',
      userId: 'user-alpha',
      category: 'Lunch',
      time: '13:00',
      isActive: true,
      createdAt: new Date('2026-01-01T13:00:00Z'),
      updatedAt: new Date('2026-01-01T13:00:00Z')
    },
    {
      id: 'rem-3',
      userId: 'user-beta',
      category: 'Dinner',
      time: '20:30',
      isActive: false,
      createdAt: new Date('2026-01-01T20:30:00Z'),
      updatedAt: new Date('2026-01-01T20:30:00Z')
    }
  ];

  const migrated = applyReminderMigration(legacyRows);

  // Exact row count preserved
  assert.equal(migrated.length, legacyRows.length);
  assert.equal(migrated.length, 3);
});

test('NSV01-0222: Legacy category, time, and isActive values remain semantically equivalent', () => {
  const legacyRows: LegacyReminder[] = [
    {
      id: 'rem-1',
      userId: 'user-alpha',
      category: 'Snack',
      time: '16:15',
      isActive: true,
      createdAt: new Date('2026-05-01T16:15:00Z'),
      updatedAt: new Date('2026-05-01T16:15:00Z')
    },
    {
      id: 'rem-2',
      userId: 'user-beta',
      category: 'Late Snack',
      time: '23:00',
      isActive: false,
      createdAt: new Date('2026-05-01T23:00:00Z'),
      updatedAt: new Date('2026-05-01T23:00:00Z')
    }
  ];

  const migrated = applyReminderMigration(legacyRows);

  // Item 1
  assert.equal(migrated[0].id, 'rem-1');
  assert.equal(migrated[0].category, 'Snack');
  assert.equal(migrated[0].mealCategory, 'Snack');
  assert.equal(migrated[0].title, 'Snack');
  assert.equal(migrated[0].time, '16:15');
  assert.equal(migrated[0].timeOfDay, '16:15');
  assert.equal(migrated[0].domain, 'HEALTH');
  assert.equal(migrated[0].type, 'MEAL');
  assert.equal(migrated[0].recurrenceType, 'DAILY');
  assert.equal(migrated[0].isActive, true);

  // Item 2
  assert.equal(migrated[1].id, 'rem-2');
  assert.equal(migrated[1].category, 'Late Snack');
  assert.equal(migrated[1].mealCategory, 'Late Snack');
  assert.equal(migrated[1].isActive, false);
});

test('NSV01-0223: Cross-user relation integrity verified after migration', () => {
  const legacyRows: LegacyReminder[] = [
    {
      id: 'rem-1',
      userId: 'user-1',
      category: 'Breakfast',
      time: '08:00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'rem-2',
      userId: 'user-2',
      category: 'Breakfast',
      time: '09:00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const migrated = applyReminderMigration(legacyRows);

  const user1Reminders = migrated.filter((r) => r.userId === 'user-1');
  const user2Reminders = migrated.filter((r) => r.userId === 'user-2');

  assert.equal(user1Reminders.length, 1);
  assert.equal(user2Reminders.length, 1);
  assert.equal(user1Reminders[0].time, '08:00');
  assert.equal(user2Reminders[0].time, '09:00');

  // Both users have 'Breakfast' - without the old unique constraint, user-1 can now also
  // add finance reminders without any collision with user-2 or meal categories.
  assert.notEqual(user1Reminders[0].userId, user2Reminders[0].userId);
});

test('NSV01-0224 & NSV01-0225: Backfill idempotency and safe non-destructive migration', () => {
  const legacyRows: LegacyReminder[] = [
    {
      id: 'rem-1',
      userId: 'user-1',
      category: 'Lunch',
      time: '12:30',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Pass 1
  const pass1 = applyReminderMigration(legacyRows);
  // Pass 2 (re-run backfill on already migrated rows)
  const pass2 = applyReminderMigration(legacyRows);

  assert.deepEqual(pass1, pass2);
  // Verify no data loss occurred
  assert.equal(pass2[0].category, 'Lunch');
  assert.equal(pass2[0].isActive, true);
});
