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
import fs from 'fs';
import path from 'path';

const MealNutritionalAnalysisInputSchema = z.object({
  mealDescription: z
    .string()
    .optional()
    .describe('A text description of the meal.'),
  imagePath: z
    .string()
    .optional()
    .describe('The path to the meal photo stored in the public/uploads volume.'),
  mealPhotoDataUri: z
    .string()
    .optional()
    .describe(
      "A photo of a meal, as a data URI. This is populated internally if imagePath is provided."
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
  const finalInput = { ...input };

  // If a local image path is provided, read it from disk to avoid sending Base64 over network
  if (input.imagePath && !input.mealPhotoDataUri) {
    try {
      // Resolve path relative to public directory
      const cleanPath = input.imagePath.startsWith('/') ? input.imagePath.substring(1) : input.imagePath;
      const fullFilePath = path.join(process.cwd(), 'public', cleanPath);
      
      if (fs.existsSync(fullFilePath)) {
        const imageBuffer = fs.readFileSync(fullFilePath);
        const ext = path.extname(fullFilePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        finalInput.mealPhotoDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      }
    } catch (error) {
      console.error("Health Matrix: Failed to read local image:", error);
    }
  }

  const { output } = await mealPrompt(finalInput);
  
  if (!output) {
    throw new Error('AI failed to generate nutritional analysis.');
  }

  return output;
}