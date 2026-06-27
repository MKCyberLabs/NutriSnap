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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [user, mealLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          weight: true,
          dailyCaloriesGoal: true,
          dailyProteinGoal: true,
          dailyCarbsGoal: true,
          dailyFatGoal: true,
        }
      }),
      prisma.mealLog.findMany({
        where: {
          userId: input.userId,
          createdAt: { gte: thirtyDaysAgo }
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const prompt = `You are the NutriSnap AI assistant. Analyze the user's provided health data and answer their question directly.
Be concise, conversational, and helpful.

Your goal is to answer the user's question using their data. You have been provided with the user's nutrition data, including their goals and meal logs from the last 30 days.

User Goals and Data:
${JSON.stringify(user, null, 2)}

User's Meal Logs (Last 30 Days):
${JSON.stringify(mealLogs, null, 2)}

If they are lacking a nutrient, follow this exact structure:
1. State their 30-day average.
2. State their target goal.
3. Explicitly state the issue (e.g., "You have a protein issue").
4. Suggest 1-2 practical whole foods (like eggs, soya chunks, lentils, or chicken) with exact serving amounts to close the remaining gap.
5. Provide a brief Sugar Section: explicitly state their average daily sugar intake and offer a quick tip to manage or improve it.

User Question: ${input.userQuestion}
`;

    const response = await ai.generate({
      prompt: prompt,
    });

    return response.text;
  }
);
