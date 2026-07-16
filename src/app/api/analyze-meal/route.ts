import { NextRequest, NextResponse } from 'next/server';
import { mealNutritionalAnalysis } from '@/ai/flows/meal-nutritional-analysis';
import { NotFoodError } from '@/lib/errors';
import healthMatrixMock from '@/mocks/health-matrix.json';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Health Matrix API Route
 * Strictly adheres to the NutriSnap Health Matrix API Specification.
 * Handles meal analysis by coordinating Genkit flows and local file reads.
 */
export async function POST(req: NextRequest) {
  try {
    // 🛡️ Sentinel: Enforce Authentication for AI endpoints
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('nutrisnap_session_id')?.value;

    if (!sessionId) {
      console.warn('Unauthorized analysis attempt');
      return NextResponse.json({ error: 'Unauthorized: Missing session token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!user) {
      console.warn('Invalid session analysis attempt');
      return NextResponse.json({ error: 'Unauthorized: Invalid session token' }, { status: 401 });
    }

    const body = await req.json();
    const { mealDescription, imagePath, mealTime } = body;

    if (!mealDescription && !imagePath) {
      return NextResponse.json(
        { error: 'Payload Validation Failed: Either mealDescription or imagePath is required.' },
        { status: 400 }
      );
    }

    // 🔄 Mock Interception Point
    if (process.env.USE_MOCK_HEALTH_API === 'true') {
      console.log('🔄 [Mock Mode] Intercepting Health Matrix API call and returning static mock data.');
      return NextResponse.json(healthMatrixMock);
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
    if (error.name === 'NotFoodError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log the specific error to the server console for debugging
    console.error('Health Matrix API Logic Failure:', error);

    // Prevent information leakage by removing details from error response
    return NextResponse.json({ error: 'Health Matrix Analysis Failed' }, { status: 500 });
  }
}
