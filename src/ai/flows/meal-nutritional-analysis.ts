'use server';
/**
 * @fileOverview A mock GenAI flow for analyzing meals with an itemized breakdown.
 * Strictly adheres to the NutriSnap Health Matrix API Specification.
 * Returns mock data for rapid prototyping.
 */

import { z } from 'zod';
import { NotFoodError } from '@/lib/errors';

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
  const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000/health-matrix';
  
  const response = await fetch(pythonApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mealDescription: input.mealDescription,
      imagePath: input.imagePath,
      mealTime: input.mealTime,
    }),
  });

  if (!response.ok) {
    throw new Error(`Python API failed with status ${response.status}`);
  }

  const data = await response.json();
  
  if (data.status !== 'success') {
    throw new Error(`Python API returned an error: ${data.message || 'Unknown error'}`);
  }

  // The Python backend uses the 'agy' CLI, which might output thought process before the JSON.
  // We need to extract the JSON block from data.response
  const jsonMatch = data.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from Python AI response.');
  }

  const parsedData = JSON.parse(jsonMatch[0]);

  if (parsedData.error === "NOT_FOOD") {
    throw new NotFoodError(parsedData.aiNote || "This image does not contain identifiable food.");
  }

  return parsedData as MealNutritionalAnalysisOutput;
}

const TelegramMealAnalysisInputSchema = z.object({
  mealDescription: z.string().optional(),
  imagePath: z.string().optional(),
  telegramTimestamp: z.number().describe('Unix timestamp in ms of the Telegram message'),
});
export type TelegramMealAnalysisInput = z.infer<typeof TelegramMealAnalysisInputSchema>;

const TelegramMealAnalysisOutputSchema = MealNutritionalAnalysisOutputSchema.extend({
  calculatedTime: z.string(),
  calculatedCategory: z.string(),
});
export type TelegramMealAnalysisOutput = z.infer<typeof TelegramMealAnalysisOutputSchema>;

export async function telegramMealNutritionalAnalysis(
  input: TelegramMealAnalysisInput
): Promise<TelegramMealAnalysisOutput> {
  const pythonApiUrl = (process.env.PYTHON_API_URL || 'http://localhost:5000/health-matrix').replace('/health-matrix', '/health-matrix-telegram');
  
  const response = await fetch(pythonApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mealDescription: input.mealDescription,
      imagePath: input.imagePath,
      telegramTimestamp: input.telegramTimestamp,
    }),
  });

  if (!response.ok) {
    throw new Error(`Python API failed with status ${response.status}`);
  }

  const data = await response.json();
  
  if (data.status !== 'success') {
    throw new Error(`Python API returned an error: ${data.message || 'Unknown error'}`);
  }

  const jsonMatch = data.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from Python AI response.');
  }

  const parsedData = JSON.parse(jsonMatch[0]);

  if (parsedData.error === "NOT_FOOD") {
    throw new NotFoodError(parsedData.aiNote || "This image does not contain identifiable food.");
  }

  return parsedData as TelegramMealAnalysisOutput;
}
