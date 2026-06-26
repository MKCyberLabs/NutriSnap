import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { prisma } from '@/lib/prisma';

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY })],
  model: 'googleai/gemini-2.5-flash',
});

export const queryDatabase = ai.defineTool(
  {
    name: 'queryDatabase',
    description: 'Executes a read-only SELECT SQL query against the PostgreSQL database to retrieve user nutrition data.',
    inputSchema: z.object({
      sqlQuery: z.string().describe('A raw PostgreSQL SELECT query.'),
    }),
    outputSchema: z.any(),
  },
  async ({ sqlQuery }) => {
    const trimmedQuery = sqlQuery.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
      throw new Error("Security Error: Only SELECT queries are permitted.");
    }
    try {
      const result = await prisma.$queryRawUnsafe(sqlQuery);
      return result;
    } catch (error: any) {
      return { error: error.message };
    }
  }
);

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
    const dbSchema = `
Table "User":
  id (String, PK)
  telegramId (String, Unique)
  weight (Float)
  dailyCaloriesGoal (Int)
  dailyProteinGoal (Int)
  dailyCarbsGoal (Int)
  dailyFatGoal (Int)

Table "MealLog":
  id (String, PK)
  userId (String, FK to User.id)
  totalCalories (Float)
  totalProtein (Float)
  totalCarbs (Float)
  totalFat (Float)
  totalSugar (Float)
  createdAt (DateTime)

Table "FoodItem":
  id (String, PK)
  mealLogId (String, FK to MealLog.id)
  name (String)
  calories (Float)
  protein (Float)
  carbs (Float)
  fat (Float)
  sugar (Float)
`;

    const prompt = `You are the NutriSnap AI assistant. Analyze the user's provided health data and answer their question directly.
Be concise, conversational, and helpful.

Your goal is to answer the user's question using their data. If you need data from the database to answer the question, use the \`queryDatabase\` tool. You can use it multiple times if necessary.

Important Context: The user asking the question has the userId: '${input.userId}' and telegramId: '${input.telegramId}'. ALWAYS filter your SQL queries by this userId (e.g., \`WHERE "userId" = '${input.userId}'\`). Do not look up data for other users.
When writing SQL, remember to quote table names if they are case sensitive in Postgres (e.g., SELECT * FROM "MealLog" WHERE "userId" = ...). Use proper postgres syntax.

Database Schema:
${dbSchema}

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
      tools: [queryDatabase],
    });

    return response.text;
  }
);
