'use server';
/**
 * @fileOverview A mock GenAI flow for analyzing meals with an itemized breakdown.
 * Strictly adheres to the NutriSnap Health Matrix API Specification.
 * Returns mock data for rapid prototyping.
 */

import { z } from 'zod';

const MealNutritionalAnalysisInputSchema = z.object({
  mealDescription: z
    .string()
    .optional()
    .describe('A text description of the meal.'),
  imagePath: z
    .string()
    .optional()
    .describe('The path to the meal photo stored in the public/uploads volume.'),
  mealTime: z
    .string()
    .optional()
    .describe('The time the meal was consumed (HH:mm format).'),
});
export type MealNutritionalAnalysisInput = z.infer<
  typeof MealNutritionalAnalysisInputSchema
>;

const MealNutritionalAnalysisOutputSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  saturatedFat: z.number(),
  sugar: z.number(),
  healthInsight: z.string(),
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
  }))
});
export type MealNutritionalAnalysisOutput = z.infer<
  typeof MealNutritionalAnalysisOutputSchema
>;

/**
 * Mock Meal Analysis
 * Returns a high-fidelity nutritional breakdown for testing.
 */
export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  // Simulate network/processing latency
  await new Promise(resolve => setTimeout(resolve, 1200));

  const mealName = input.mealDescription || "Custom Meal Selection";

  // Mock response mapping to the Health Matrix Specification
  return {
    calories: 450,
    protein: 30.0,
    carbs: 50.0,
    fat: 15.0,
    sugar: 10.0,
    fiber: 5.0,
    saturatedFat: 4.0,
    healthInsight: "Analysis based on Health Matrix prototype data. This meal provides a diverse range of nutrients and maintains a balanced macro profile.",
    foodItems: [
      {
        name: mealName,
        grams: 300,
        calories: 450,
        protein: 30.0,
        carbs: 50.0,
        fat: 15.0,
        fiber: 5.0,
        saturatedFat: 4.0,
        sugar: 10.0
      }
    ]
  };
}
