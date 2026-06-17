import { NextRequest, NextResponse } from 'next/server';
import { mealNutritionalAnalysis } from '@/ai/flows/meal-nutritional-analysis';

/**
 * Health Matrix API Route
 * Strictly adheres to the NutriSnap Health Matrix API Specification.
 * Handles meal analysis by coordinating Genkit flows and local file reads.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mealDescription, imagePath, mealTime } = body;

    if (!mealDescription && !imagePath) {
      return NextResponse.json(
        { error: 'Payload Validation Failed: Either mealDescription or imagePath is required.' },
        { status: 400 }
      );
    }

    // Call the internal Health Matrix analysis flow
    // This flow handles disk IO for local images if imagePath is provided
    const result = await mealNutritionalAnalysis({
      mealDescription,
      imagePath,
      mealTime,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    // Log the specific error to the server console for debugging
    console.error('Health Matrix API Logic Failure:', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { 
        error: 'Health Matrix Analysis Failed', 
        details: error.message || 'An unexpected error occurred during AI processing.' 
      },
      { status: 500 }
    );
  }
}
