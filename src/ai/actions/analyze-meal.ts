'use server';

import { requireUser } from '@/lib/session';
import {
  mealNutritionalAnalysis,
  type MealNutritionalAnalysisInput,
} from '@/ai/flows/meal-nutritional-analysis';

export async function analyzeMeal(input: MealNutritionalAnalysisInput) {
  await requireUser();
  return mealNutritionalAnalysis(input);
}
