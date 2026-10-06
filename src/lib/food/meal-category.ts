import { MealCategory } from '@/lib/types';

export const MEAL_CATEGORY_OPTIONS: MealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

/**
 * Deterministically infers meal category based on time string in "HH:mm" format (24-hour).
 *
 * Rules:
 * - Breakfast: 05:00 - 10:59
 * - Lunch:     11:00 - 15:59
 * - Snacks:    16:00 - 17:59
 * - Dinner:    18:00 - 22:59
 * - Snacks:    23:00 - 04:59
 */
export function inferMealCategoryFromTime(timeStr: string): MealCategory {
  if (!timeStr || !timeStr.includes(':')) {
    return 'Lunch';
  }

  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return 'Lunch';
  }

  const totalMinutes = hours * 60 + minutes;

  // Breakfast: 05:00 - 10:59 (300 to 659 mins)
  if (totalMinutes >= 5 * 60 && totalMinutes <= 10 * 60 + 59) {
    return 'Breakfast';
  }

  // Lunch: 11:00 - 15:59 (660 to 959 mins)
  if (totalMinutes >= 11 * 60 && totalMinutes <= 15 * 60 + 59) {
    return 'Lunch';
  }

  // Snacks: 16:00 - 17:59 (960 to 1079 mins)
  if (totalMinutes >= 16 * 60 && totalMinutes <= 17 * 60 + 59) {
    return 'Snacks';
  }

  // Dinner: 18:00 - 22:59 (1080 to 1379 mins)
  if (totalMinutes >= 18 * 60 && totalMinutes <= 22 * 60 + 59) {
    return 'Dinner';
  }

  // Snacks: 23:00 - 04:59 (1380 to 1439 or 0 to 299 mins)
  return 'Snacks';
}
