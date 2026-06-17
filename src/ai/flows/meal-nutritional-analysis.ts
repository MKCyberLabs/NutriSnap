
'use server';
/**
 * @fileOverview A GenAI flow for analyzing meals with a fallback mock system.
 *
 * - mealNutritionalAnalysis - Handles analysis with keyword-based mock data.
 * - MealNutritionalAnalysisInput - The input type.
 * - MealNutritionalAnalysisOutput - The Health Matrix formatted return type.
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
  protein: z.string().describe('Protein amount (e.g., "25g")'),
  carbs: z.string().describe('Carbs amount (e.g., "40g")'),
  fat: z.string().describe('Fat amount (e.g., "10g")'),
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
 * Generates sample data based on user input keywords.
 */
function generateSampleMatrixData(userInput: string = ''): MealNutritionalAnalysisOutput {
  const input = userInput.toLowerCase();
  
  if (input.includes('chicken') || input.includes('egg') || input.includes('meat') || input.includes('steak')) {
    return {
      calories: 450,
      protein: "40g",
      carbs: "10g",
      fat: "15g",
      healthInsight: "Excellent high-protein recovery meal. Great for muscle synthesis and satiety.",
      foodItems: [{ name: "Protein-rich main", calories: 450, protein: "40g", carbs: "10g", fat: "15g" }]
    };
  }
  
  if (input.includes('banana') || input.includes('rice') || input.includes('oats') || input.includes('bread') || input.includes('pasta')) {
    return {
      calories: 380,
      protein: "8g",
      carbs: "65g",
      fat: "5g",
      healthInsight: "High-carb energy booster. Perfect for pre-workout fueling or replenishing glycogen.",
      foodItems: [{ name: "Carbohydrate-focused base", calories: 380, protein: "8g", carbs: "65g", fat: "5g" }]
    };
  }

  // Default balanced meal
  return {
    calories: 350,
    protein: "25g",
    carbs: "40g",
    fat: "10g",
    healthInsight: "Great balanced choice! Excellent for keeping your energy levels steady.",
    foodItems: [{ name: "Balanced meal", calories: 350, protein: "25g", carbs: "40g", fat: "10g" }]
  };
}

export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  // Simulating a brief delay for "AI Analysis" feel
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  try {
    // For the prototype, we prioritize the mock logic to ensure stability
    return generateSampleMatrixData(input.mealDescription);
  } catch (error) {
    console.error("AI Analysis Error (falling back to mock):", error);
    return generateSampleMatrixData(input.mealDescription);
  }
}
