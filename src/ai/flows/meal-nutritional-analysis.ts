
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
});
export type MealNutritionalAnalysisInput = z.infer<
  typeof MealNutritionalAnalysisInputSchema
>;

const MealNutritionalAnalysisOutputSchema = z.object({
  calories: z.number().describe('Total calories'),
  protein: z.number().describe('Total protein'),
  carbs: z.number().describe('Total carbs'),
  fat: z.number().describe('Total fat'),
  healthInsight: z.string().describe('Nutritional insight text'),
  foodItems: z.array(z.object({
    name: z.string(),
    grams: z.number(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number()
  })).optional()
});
export type MealNutritionalAnalysisOutput = z.infer<
  typeof MealNutritionalAnalysisOutputSchema
>;

/**
 * Mock database of nutritional items (values per 100g base).
 */
const ITEM_DB: Record<string, { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }> = {
  rice: { name: "Rice", grams: 150, calories: 195, protein: 4.1, carbs: 45.0, fat: 0.4 },
  dal: { name: "Dal", grams: 200, calories: 230, protein: 14.5, carbs: 38.0, fat: 1.5 },
  paneer: { name: "Paneer", grams: 100, calories: 265, protein: 18.2, carbs: 1.2, fat: 20.8 },
  lassi: { name: "Lassi", grams: 250, calories: 160, protein: 3.5, carbs: 18.0, fat: 8.2 },
  chicken: { name: "Grilled Chicken", grams: 150, calories: 247, protein: 31.0, carbs: 0.0, fat: 12.5 },
  egg: { name: "Boiled Egg", grams: 50, calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  banana: { name: "Banana", grams: 120, calories: 105, protein: 1.3, carbs: 27.0, fat: 0.3 },
  oats: { name: "Oats", grams: 100, calories: 389, protein: 16.9, carbs: 66.0, fat: 6.9 },
  bread: { name: "Whole Wheat Bread", grams: 40, calories: 95, protein: 4.0, carbs: 18.0, fat: 1.1 },
  pasta: { name: "Pasta", grams: 200, calories: 316, protein: 11.6, carbs: 61.2, fat: 1.8 },
  meat: { name: "Red Meat", grams: 150, calories: 375, protein: 39.0, carbs: 0.0, fat: 22.5 },
  steak: { name: "Beef Steak", grams: 200, calories: 540, protein: 56.0, carbs: 0.0, fat: 34.0 },
};

/**
 * Generates itemized data based on user input keywords.
 */
function generateSampleMatrixData(userInput: string = ''): MealNutritionalAnalysisOutput {
  const input = userInput.toLowerCase();
  const matchedItems = [];
  
  // Find all matches
  for (const [key, data] of Object.entries(ITEM_DB)) {
    if (input.includes(key)) {
      matchedItems.push({ ...data });
    }
  }

  // Fallback if no keywords found
  if (matchedItems.length === 0) {
    matchedItems.push({ name: "Mixed Balanced Meal", grams: 300, calories: 450, protein: 30, carbs: 50, fat: 15 });
  }

  const totalCalories = matchedItems.reduce((acc, item) => acc + item.calories, 0);
  const totalProtein = matchedItems.reduce((acc, item) => acc + item.protein, 0);
  const totalCarbs = matchedItems.reduce((acc, item) => acc + item.carbs, 0);
  const totalFat = matchedItems.reduce((acc, item) => acc + item.fat, 0);

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
    healthInsight: insight,
    foodItems: matchedItems
  };
}

export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  // Simulating a brief delay for "AI Analysis" feel
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  try {
    return generateSampleMatrixData(input.mealDescription);
  } catch (error) {
    console.error("AI Analysis Error (falling back to mock):", error);
    return generateSampleMatrixData(input.mealDescription);
  }
}
