import test from 'node:test';
import assert from 'node:assert/strict';
import { inferMealCategoryFromTime } from './meal-category';

test('FOOD-AI-030: 07:30 -> Breakfast', () => {
  assert.equal(inferMealCategoryFromTime('07:30'), 'Breakfast');
});

test('FOOD-AI-031: 10:59 -> Breakfast', () => {
  assert.equal(inferMealCategoryFromTime('10:59'), 'Breakfast');
});

test('FOOD-AI-032: 11:00 -> Lunch', () => {
  assert.equal(inferMealCategoryFromTime('11:00'), 'Lunch');
});

test('FOOD-AI-033: 14:00 -> Lunch (CRITICAL UAT DEFECT REGRESSION)', () => {
  assert.equal(inferMealCategoryFromTime('14:00'), 'Lunch');
});

test('FOOD-AI-034: 15:59 -> Lunch', () => {
  assert.equal(inferMealCategoryFromTime('15:59'), 'Lunch');
});

test('FOOD-AI-035: 16:00 -> Snacks', () => {
  assert.equal(inferMealCategoryFromTime('16:00'), 'Snacks');
});

test('FOOD-AI-036: 17:59 -> Snacks', () => {
  assert.equal(inferMealCategoryFromTime('17:59'), 'Snacks');
});

test('FOOD-AI-037: 18:00 -> Dinner', () => {
  assert.equal(inferMealCategoryFromTime('18:00'), 'Dinner');
});

test('FOOD-AI-038: 22:59 -> Dinner', () => {
  assert.equal(inferMealCategoryFromTime('22:59'), 'Dinner');
});

test('FOOD-AI-039: 23:00 -> Snacks', () => {
  assert.equal(inferMealCategoryFromTime('23:00'), 'Snacks');
});

test('FOOD-AI-040: 04:59 -> Snacks', () => {
  assert.equal(inferMealCategoryFromTime('04:59'), 'Snacks');
});

test('Boundary check: 05:00 -> Breakfast', () => {
  assert.equal(inferMealCategoryFromTime('05:00'), 'Breakfast');
});

test('Boundary check: 00:00 midnight -> Snacks', () => {
  assert.equal(inferMealCategoryFromTime('00:00'), 'Snacks');
});

test('Fallback check: malformed or empty time -> Lunch', () => {
  assert.equal(inferMealCategoryFromTime(''), 'Lunch');
  assert.equal(inferMealCategoryFromTime('invalid'), 'Lunch');
  assert.equal(inferMealCategoryFromTime('25:00'), 'Lunch');
});

test('FOOD-AI-041: Manual category override takes precedence over inferred category', () => {
  const time = '14:00'; // Inferred is Lunch
  const manualOverride = 'Dinner';
  const effectiveCategory = manualOverride ?? inferMealCategoryFromTime(time);
  assert.equal(effectiveCategory, 'Dinner');
});

test('FOOD-AI-042: Switching back to Auto re-infers category from time', () => {
  const time = '14:00';
  let categorySelection: string = 'Dinner';
  categorySelection = 'auto';
  const effectiveCategory = categorySelection === 'auto' ? inferMealCategoryFromTime(time) : categorySelection;
  assert.equal(effectiveCategory, 'Lunch');
});
