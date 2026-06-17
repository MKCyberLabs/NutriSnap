'use server';
/**
 * @fileOverview A GenAI flow for analyzing meal descriptions or photos to provide nutritional breakdowns.
 *
 * - mealNutritionalAnalysis - A function that handles the meal analysis process.
 * - MealNutritionalAnalysisInput - The input type for the mealNutritionalAnalysis function.
 * - MealNutritionalAnalysisOutput - The return type for the mealNutritionalAnalysis function.
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
});
export type MealNutritionalAnalysisInput = z.infer<
  typeof MealNutritionalAnalysisInputSchema
>;

const MealNutritionalAnalysisOutputSchema = z.object({
  foodItems: z.array(
    z.object({
      name: z.string().describe('The name of the food item.'),
      calories: z.number().describe('Estimated calories in kcal.'),
      protein: z.number().describe('Estimated protein in grams.'),
      carbs: z.number().describe('Estimated carbohydrates in grams.'),
      fat: z.number().describe('Estimated fat in grams.'),
    })
  ),
  totalNutrients: z.object({
    calories: z.number().describe('Total estimated calories in kcal.'),
    protein: z.number().describe('Total estimated protein in grams.'),
    carbs: z.number().describe('Total estimated carbohydrates in grams.'),
    fat: z.number().describe('Total estimated fat in grams.'),
  }),
});
export type MealNutritionalAnalysisOutput = z.infer<
  typeof MealNutritionalAnalysisOutputSchema
>;

export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  return mealNutritionalAnalysisFlow(input);
}

const mealNutritionalAnalysisPrompt = ai.definePrompt({
  name: 'mealNutritionalAnalysisPrompt',
  input: { schema: MealNutritionalAnalysisInputSchema },
  output: { schema: MealNutritionalAnalysisOutputSchema },
  prompt: `You are an expert nutritionist and food analyzer. Your task is to identify food items from a given description or photo, and provide an estimated nutritional breakdown for each item and a total summary.

Instructions:
1. Accurately identify all distinct food items present.
2. For each identified food item, estimate its calories (kcal), protein (g), carbohydrates (g), and fat (g).
3. Calculate the total calories, protein, carbohydrates, and fat for the entire meal.
4. If both a description and a photo are provided, prioritize information from the photo for identification.
5. If no food items can be identified, return empty arrays and zero totals.

Meal details:
{{#if mealDescription}}
Description: {{{mealDescription}}}
{{/if}}
{{#if mealPhotoDataUri}}
Photo: {{media url=mealPhotoDataUri}}
{{/if}}

Provide the output in the specified JSON format.`,
});

const mealNutritionalAnalysisFlow = ai.defineFlow(
  {
    name: 'mealNutritionalAnalysisFlow',
    inputSchema: MealNutritionalAnalysisInputSchema,
    outputSchema: MealNutritionalAnalysisOutputSchema,
  },
  async (input) => {
    if (!input.mealDescription && !input.mealPhotoDataUri) {
      throw new Error(
        'At least one of mealDescription or mealPhotoDataUri must be provided.'
      );
    }

    const { output } = await mealNutritionalAnalysisPrompt(input);
    return output!;
  }
);
