import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { prisma } from '@/lib/prisma';

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY })],
  model: 'googleai/gemini-2.5-flash',
});

export const askNutritionFlow = ai.defineFlow(
  {
    name: 'askNutritionFlow',
    inputSchema: z.object({
      userQuestion: z.string(),
      userId: z.string(),
      telegramId: z.string(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    // Safely fetch user data and goals
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        weight: true,
        dailyCaloriesGoal: true,
        dailyProteinGoal: true,
        dailyCarbsGoal: true,
        dailyFatGoal: true,
      }
    });

    // Safely fetch last 30 days of meal logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
        totalSugar: true,
        createdAt: true,
      }
    });

    const userDataJson = JSON.stringify({ user, recentMeals: mealLogs });
    const prompt = `You are the NutriSnap AI assistant. Analyze the user's provided health data and answer their question.
Be concise, conversational, and helpful.

Important Guidelines:
1. Scope: You must ONLY answer questions related to nutrition, fitness, health, and diet. If the user asks a completely off-topic question (e.g., about coding, history, pop culture), politely decline and gently steer the conversation back to nutrition and health.
2. General Questions vs Data Questions: 
   - If the user asks for general suggestions, advice, or recipes, provide a flexible, conversational, and helpful response based on your internal knowledge.
   - ONLY if the user specifically asks about their own data (e.g., "where are my nutrients lacking", "how am I doing", "what should I eat to meet my goals"), follow this exact structure for lacking nutrients:
     1. State their 30-day average.
     2. State their target goal.
     3. Explicitly state the issue (e.g., "You have a protein issue").
     4. Suggest 1-2 practical whole foods (like eggs, soya chunks, lentils, or chicken) with exact serving amounts to close the remaining gap.
     5. Provide a brief Sugar Section: explicitly state their average daily sugar intake and offer a quick tip to manage or improve it.

User Data (JSON):
${userDataJson}

User Question: ${input.userQuestion}
`;

    const response = await ai.generate({
      prompt: prompt,
    });

    return response.text;
  }
);
