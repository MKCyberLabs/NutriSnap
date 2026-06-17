'use server';
/**
 * @fileOverview A GenAI flow for analyzing meals with an itemized breakdown.
 *
 * - mealNutritionalAnalysis - Handles analysis using Gemini 1.5 Flash.
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
      "A photo of a meal, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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

const mealPrompt = ai.definePrompt({
  name: 'mealNutritionalAnalysisPrompt',
  input: { schema: MealNutritionalAnalysisInputSchema },
  output: { schema: MealNutritionalAnalysisOutputSchema },
  prompt: `You are an expert nutritional analyst. 
Analyze the following meal information and/or image. 

{{#if mealDescription}}
Description: {{{mealDescription}}}
{{/if}}

{{#if mealPhotoDataUri}}
Photo: {{media url=mealPhotoDataUri}}
{{/if}}

You must calculate the macro-nutrients as accurately as possible based on standard portion sizes.
Break the meal down into individual food items in the 'foodItems' array.
The total macros (calories, protein, carbs, fat, sugar, fiber, saturatedFat) must equal the sum of the individual items.
Provide a concise, encouraging nutritional insight in 'healthInsight'.
Return ONLY the JSON object.`,
});

export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  const { output } = await mealPrompt(input);
  
  if (!output) {
    throw new Error('AI failed to generate nutritional analysis.');
  }

  return output;
}
