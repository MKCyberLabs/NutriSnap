
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
  protein: z.string().describe('Total protein'),
  carbs: z.string().describe('Total carbs'),
  fat: z.string().describe('Total fat'),
  healthInsight: z.string().describe('Nutritional insight text'),
  foodItems: z.array(z.object({
    name: z.string(),
    calories: z.number(),
    protein: z.string(),
    carbs: z.string(),
    fat: z.string()
  })).optional()
});
export type MealNutritionalAnalysisOutput = z.infer<
  typeof MealNutritionalAnalysisOutputSchema
>;

/**
 * Mock database of nutritional items.
 */
const ITEM_DB: Record<string, { name: string; calories: number; protein: string; carbs: string; fat: string }> = {
  rice: { name: "Rice", calories: 200, protein: "4g", carbs: "45g", fat: "0.5g" },
  dal: { name: "Dal", calories: 180, protein: "12g", carbs: "30g", fat: "2g" },
  paneer: { name: "Paneer", calories: 250, protein: "14g", carbs: "4g", fat: "20g" },
  lassi: { name: "Lassi", calories: 150, protein: "2g", carbs: "16g", fat: "5.5g" },
  chicken: { name: "Grilled Chicken", calories: 220, protein: "35g", carbs: "0g", fat: "8g" },
  egg: { name: "Boiled Egg", calories: 70, protein: "6g", carbs: "0.5g", fat: "5g" },
  banana: { name: "Banana", calories: 105, protein: "1.3g", carbs: "27g", fat: "0.3g" },
  oats: { name: "Oats", calories: 150, protein: "5g", carbs: "27g", fat: "2.5g" },
  bread: { name: "Whole Wheat Bread", calories: 80, protein: "3g", carbs: "15g", fat: "1g" },
  pasta: { name: "Pasta", calories: 220, protein: "8g", carbs: "43g", fat: "1.3g" },
  meat: { name: "Red Meat", calories: 250, protein: "26g", carbs: "0g", fat: "15g" },
  steak: { name: "Beef Steak", calories: 270, protein: "28g", carbs: "0g", fat: "17g" },
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
      matchedItems.push(data);
    }
  }

  // Fallback if no keywords found
  if (matchedItems.length === 0) {
    matchedItems.push({ name: "Mixed Balanced Meal", calories: 350, protein: "25g", carbs: "40g", fat: "10g" });
  }

  // Summation helper
  const sumVal = (items: any[], key: 'protein' | 'carbs' | 'fat') => {
    const total = items.reduce((acc, item) => {
      const val = parseFloat(item[key].replace(/[^0-9.]/g, '')) || 0;
      return acc + val;
    }, 0);
    return `${total.toFixed(1).replace(/\.0$/, '')}g`;
  };

  const totalCalories = matchedItems.reduce((acc, item) => acc + item.calories, 0);
  const totalProtein = sumVal(matchedItems, 'protein');
  const totalCarbs = sumVal(matchedItems, 'carbs');
  const totalFat = sumVal(matchedItems, 'fat');

  let insight = "Great choice! This meal provides a diverse range of nutrients.";
  if (input.includes('rice') && input.includes('dal')) {
    insight = "A classic balanced combination. The rice and dal provide a complete amino acid profile.";
  } else if (input.includes('chicken') || input.includes('paneer')) {
    insight = "Excellent protein source. Great for muscle maintenance and satiety.";
  }

  return {
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
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
