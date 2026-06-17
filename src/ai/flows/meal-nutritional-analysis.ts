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
    fiber: z.number().optional(),
    saturatedFat: z.number().optional(),
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
  config: {
    // Relax safety filters to prevent blocking food image analysis
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are an expert nutritional analyst specializing in visual and textual food analysis. 

Analyze the provided meal information. Calculate the macro-nutrients as accurately as possible based on standard portion sizes.

{{#if mealDescription}}
User Description: {{{mealDescription}}}
{{/if}}

{{#if mealPhotoDataUri}}
Visual Evidence: {{media url=mealPhotoDataUri}}
{{/if}}

Requirements:
1. Break the meal down into individual food items in the 'foodItems' array.
2. The root level macros (calories, protein, carbs, fat, sugar, fiber, saturatedFat) must be the EXACT sum of the individual items.
3. Provide a concise, professional, and encouraging nutritional insight.
4. Output your analysis ONLY as a raw, valid JSON object.`,
});

export async function mealNutritionalAnalysis(
  input: MealNutritionalAnalysisInput
): Promise<MealNutritionalAnalysisOutput> {
  const finalInput = { ...input };

  // If a local image path is provided, read it from disk
  if (input.imagePath && !input.mealPhotoDataUri) {
    try {
      const cleanPath = input.imagePath.startsWith('/') ? input.imagePath.substring(1) : input.imagePath;
      const fullFilePath = path.join(process.cwd(), 'public', cleanPath);
      
      if (fs.existsSync(fullFilePath)) {
        const imageBuffer = fs.readFileSync(fullFilePath);
        const ext = path.extname(fullFilePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        finalInput.mealPhotoDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      } else {
        console.warn(`Health Matrix: Local image not found at ${fullFilePath}`);
      }
    } catch (error: any) {
      console.error("Health Matrix: Failed to read local image:", error.message);
    }
  }

  try {
    const { output } = await mealPrompt(finalInput);
    
    if (!output) {
      throw new Error('AI analysis produced an empty response.');
    }

    return output;
  } catch (error: any) {
    console.error("Health Matrix: AI Prompt Failure:", error.message);
    throw new Error(`AI Analysis Error: ${error.message}`);
  }
}
