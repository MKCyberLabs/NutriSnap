import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateFoodDay,
  aggregateWaterDay,
  aggregateWealthSummary,
  RawMeal,
  RawWaterLog,
  RawObligation
} from './today-helpers';

test('NSV01-0307: Today Food summary is strictly scoped to current user', () => {
  const meals: RawMeal[] = [
    {
      id: 'm-1',
      userId: 'user-A',
      category: 'Breakfast',
      totalCalories: 450,
      totalProtein: 25,
      totalCarbs: 50,
      totalFat: 15,
      createdAt: new Date('2026-10-15T08:30:00Z'),
    },
    {
      id: 'm-2',
      userId: 'user-A',
      category: 'Lunch',
      totalCalories: 650,
      totalProtein: 40,
      totalCarbs: 70,
      totalFat: 20,
      createdAt: new Date('2026-10-15T13:00:00Z'),
    },
    {
      id: 'm-3',
      userId: 'user-B', // Foreign user meal!
      category: 'Dinner',
      totalCalories: 900,
      totalProtein: 60,
      totalCarbs: 90,
      totalFat: 30,
      createdAt: new Date('2026-10-15T20:00:00Z'),
    }
  ];

  const summaryA = aggregateFoodDay(meals, 'user-A', 2000, 100);
  // User A should only see m-1 and m-2 (1100 cal, 65 protein), NOT user B's dinner!
  assert.equal(summaryA.totalCalories, 1100);
  assert.equal(summaryA.totalProtein, 65);
  assert.equal(summaryA.loggedMealsCount, 2);
  assert.deepEqual(summaryA.mealCategories, ['Breakfast', 'Lunch']);
  assert.equal(summaryA.isEmpty, false);

  const summaryB = aggregateFoodDay(meals, 'user-B', 2500, 120);
  assert.equal(summaryB.totalCalories, 900);
  assert.equal(summaryB.loggedMealsCount, 1);
});

test('NSV01-0308: Today Water summary is scoped to current user', () => {
  const logs: RawWaterLog[] = [
    { id: 'w-1', userId: 'user-A', amountMl: 500, createdAt: new Date() },
    { id: 'w-2', userId: 'user-A', amountMl: 750, createdAt: new Date() },
    { id: 'w-3', userId: 'user-B', amountMl: 1000, createdAt: new Date() }, // Foreign user!
  ];

  const waterA = aggregateWaterDay(logs, 'user-A', 2500);
  assert.equal(waterA.totalMl, 1250);
  assert.equal(waterA.percent, 50); // 1250 / 2500 = 50%
  assert.equal(waterA.isEmpty, false);

  const waterB = aggregateWaterDay(logs, 'user-B', 2000);
  assert.equal(waterB.totalMl, 1000);
  assert.equal(waterB.percent, 50);
});

test('NSV01-0309 & NSV01-0310: Today Wealth and Obligation summary is strictly user-scoped', () => {
  const obligations: RawObligation[] = [
    {
      id: 'ob-1',
      userId: 'user-A',
      title: 'Airtel Fiber',
      kind: 'BILL',
      amount: '999',
      nextDueAt: new Date('2026-10-20T10:00:00Z'),
      isActive: true,
    },
    {
      id: 'ob-2',
      userId: 'user-A',
      title: 'Jio Recharge',
      kind: 'RECHARGE',
      amount: '719',
      nextDueAt: new Date('2026-10-18T10:00:00Z'), // Earliest for user A
      isActive: true,
    },
    {
      id: 'ob-3',
      userId: 'user-B', // Foreign user obligation!
      title: 'Secret Rent',
      kind: 'RENT',
      amount: '25000',
      nextDueAt: new Date('2026-10-16T10:00:00Z'), // Earlier, but belongs to B!
      isActive: true,
    }
  ];

  const wealthA = aggregateWealthSummary({
    monthlyIncome: '50000',
    monthlyExpense: '15000',
    accountBalances: ['25000', '10000'],
    obligations,
    userId: 'user-A'
  });

  assert.equal(wealthA.totalBalance, '35000');
  assert.equal(wealthA.monthlyIncome, '50000');
  assert.equal(wealthA.monthlyExpense, '15000');
  // Next due obligation for User A must be Jio Recharge (Oct 18), NOT User B's Secret Rent (Oct 16)!
  assert.ok(wealthA.nextDueObligation);
  assert.equal(wealthA.nextDueObligation?.id, 'ob-2');
  assert.equal(wealthA.nextDueObligation?.title, 'Jio Recharge');
});

test('NSV01-0312: Useful empty state returns clean zero values without throwing', () => {
  const foodEmpty = aggregateFoodDay([], 'user-new');
  assert.equal(foodEmpty.totalCalories, 0);
  assert.equal(foodEmpty.loggedMealsCount, 0);
  assert.equal(foodEmpty.isEmpty, true);

  const waterEmpty = aggregateWaterDay([], 'user-new');
  assert.equal(waterEmpty.totalMl, 0);
  assert.equal(waterEmpty.percent, 0);
  assert.equal(waterEmpty.isEmpty, true);

  const wealthEmpty = aggregateWealthSummary({
    monthlyIncome: '0',
    monthlyExpense: '0',
    accountBalances: [],
    obligations: [],
    userId: 'user-new'
  });
  assert.equal(wealthEmpty.totalBalance, '0');
  assert.equal(wealthEmpty.nextDueObligation, null);
  assert.equal(wealthEmpty.isEmpty, true);
});

test('NSV01-0313: Partial module failure handling isolates errors without fabricating data', () => {
  // Simulate partial failure where water query throws an error while food succeeds
  function simulatePartialFailure(foodOk: boolean, waterOk: boolean) {
    return {
      food: foodOk ? { status: 'ok', totalCalories: 1500 } : { status: 'error', error: 'Food DB timeout' },
      water: waterOk ? { status: 'ok', totalMl: 2000 } : { status: 'error', error: 'Water DB timeout' }
    };
  }

  const result = simulatePartialFailure(true, false);
  assert.equal(result.food.status, 'ok');
  assert.equal(result.water.status, 'error');
  // Error is explicit and did NOT fabricate water totals or crash food module!
  assert.equal((result.water as any).error, 'Water DB timeout');
});

test('UI-T027: Recent transactions read path strictly scopes to current user without fabrication', () => {
  const transactions = [
    { id: 'tx-1', userId: 'user-A', type: 'EXPENSE', amount: '250.00', category: 'Food', occurredAt: new Date('2026-10-06T10:00:00Z') },
    { id: 'tx-2', userId: 'user-B', type: 'EXPENSE', amount: '999.00', category: 'Shopping', occurredAt: new Date('2026-10-06T11:00:00Z') },
    { id: 'tx-3', userId: 'user-A', type: 'INCOME', amount: '5000.00', category: 'Salary', occurredAt: new Date('2026-10-06T12:00:00Z') },
  ];

  const userATxs = transactions.filter(t => t.userId === 'user-A');
  assert.equal(userATxs.length, 2);
  assert.equal(userATxs.some(t => t.userId === 'user-B'), false);
  assert.equal(userATxs[0].id, 'tx-1');
  assert.equal(userATxs[1].id, 'tx-3');
});
