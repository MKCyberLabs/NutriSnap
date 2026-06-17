
'use server';
/**
 * @fileOverview A GenAI flow for analyzing meals with an itemized breakdown mock system.
 *
 * - mealNutritionalAnalysis - Handles analysis with keyword-based itemized data.
 * - MealNutritionalAnalysisInput - The input type.
 * - MealNutritionalAnalysisOutput - The itemized Health Matrix return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MealNutritionalAnalysisInputSchema = z.object({
  mealDescription: z
    .string()
    .optional()
    .describe('A text description of the meal.'),
  mealPhotoDataUri: z
    .string()
    .optional()
    .describe(
      "A photo of a meal, as a data URI."
    ),
  mealTime: z
    .string()
    .optional()
    .describe('The time the meal was consumed (HH:mm format).'),
});
export type MealNutritionalAnalysisInput = z.infer<
  typeof MealNutritionalAnalysisInputSchema
>;

const MealNutritionalAnalysisOutputSchema = z.object({
  calories: z.number().describe('Total calories'),
  protein: z.number().describe('Total protein'),
  carbs: z.number().describe('Total carbs'),
  fat: z.number().describe('Total fat'),
  fiber: z.number().describe('Total fiber'),
  saturatedFat: z.number().describe('Total saturated fat'),
  sugar: z.number().describe('Total sugar'),
  healthInsight: z.string().describe('Nutritional insight text'),
  foodItems: z.array(z.object({
    name: z.string(),
    grams: z.number(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
    saturatedFat: z.number(),
    sugar: z.number()
  })).optional()
});
export type MealNutritionalAnalysisOutput = z.infer<
  typeof MealNutritionalAnalysisOutputSchema
>;

/**
 * Mock database of nutritional items (values per base grams).
 */
const ITEM_DB: Record<string, { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number; fiber: number; saturatedFat: number; sugar: number }> = {
  rice: { name: "Rice", grams: 150, calories: 195, protein: 4.1, carbs: 45.0, fat: 0.4, fiber: 0.6, saturatedFat: 0.1, sugar: 0.1 },
  dal: { name: "Dal", grams: 200, calories: 230, protein: 14.5, carbs: 38.0, fat: 1.5, fiber: 12.0, saturatedFat: 0.2, sugar: 1.5 },
  paneer: { name: "Paneer", grams: 100, calories: 265, protein: 18.2, carbs: 1.2, fat: 20.8, fiber: 0.0, saturatedFat: 12.5, sugar: 1.2 },
  lassi: { name: "Lassi", grams: 250, calories: 160, protein: 3.5, carbs: 18.0, fat: 8.2, fiber: 0.0, saturatedFat: 5.1, sugar: 16.0 },
  chicken: { name: "Grilled Chicken", grams: 150, calories: 247, protein: 31.0, carbs: 0.0, fat: 12.5, fiber: 0.0, saturatedFat: 3.5, sugar: 0.0 },
  egg: { name: "Boiled Egg", grams: 50, calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0.0, saturatedFat: 1.6, sugar: 0.6 },
  banana: { name: "Banana", grams: 120, calories: 105, protein: 1.3, carbs: 27.0, fat: 0.3, fiber: 3.1, saturatedFat: 0.1, sugar: 14.4 },
  oats: { name: "Oats", grams: 100, calories: 389, protein: 16.9, carbs: 66.0, fat: 6.9, fiber: 10.6, saturatedFat: 1.2, sugar: 0.0 },
  bread: { name: "Whole Wheat Bread", grams: 40, calories: 95, protein: 4.0, carbs: 18.0, fat: 1.1, fiber: 2.8, saturatedFat: 0.2, sugar: 2.0 },
  pasta: { name: "Pasta", grams: 200, calories: 316, protein: 11.6, carbs: 61.2, fat: 1.8, fiber: 3.2, saturatedFat: 0.3, sugar: 2.1 },
};

/**
 * Generates itemized data based on user input keywords.
 */
function generateSampleMatrixData(userInput: string = ''): MealNutritionalAnalysisOutput {
  const input = userInput.toLowerCase();
  const matchedItems = [];
  
  for (const [key, data] of Object.entries(ITEM_DB)) {
    if (input.includes(key)) {
      matchedItems.push({ ...data });
    }
  }

  if (matchedItems.length === 0) {
    matchedItems.push({ name: "Mixed Balanced Meal", grams: 300, calories: 450, protein: 30, carbs: 50, fat: 15, fiber: 5, saturatedFat: 4, sugar: 10 });
  }

  const totalCalories = matchedItems.reduce((acc, item) => acc + item.calories, 0);
  const totalProtein = matchedItems.reduce((acc, item) => acc + item.protein, 0);
  const totalCarbs = matchedItems.reduce((acc, item) => acc + item.carbs, 0);
  const totalFat = matchedItems.reduce((acc, item) => acc + item.fat, 0);
  const totalFiber = matchedItems.reduce((acc, item) => acc + item.fiber, 0);
  const totalSaturatedFat = matchedItems.reduce((acc, item) => acc + item.saturatedFat, 0);
  const totalSugar = matchedItems.reduce((acc, item) => acc + item.sugar, 0);

  let insight = "Great choice! This meal provides a diverse range of nutrients.";
  if (input.includes('rice') && input.includes('dal')) {
    insight = "A classic balanced combination. The rice and dal provide a complete amino acid profile.";
  } else if (input.includes('chicken') || input.includes('paneer')) {
    insight = "Excellent protein source. Great for muscle maintenance and satiety.";
  }

  return {
    calories: Math.round(totalCalories),
    protein: Number(totalProtein.toFixed(1)),
    carbs: Number(totalCarbs.toFixed(1)),
    fat: Number(totalFat.toFixed(1)),
    fiber: Number(totalFiber.toFixed(1)),
    saturatedFat: Number(totalSaturatedFat.toFixed(1)),
    sugar: Number(totalSugar.toFixed(1)),
    healthInsight: insight,
    foodItems: matchedItems
  };
}

export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  try {
    return generateSampleMatrixData(input.mealDescription);
  } catch (error) {
    console.error("AI Analysis Error (falling back to mock):", error);
    return generateSampleMatrixData(input.mealDescription);
  }
}
