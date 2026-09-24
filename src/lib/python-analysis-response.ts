import { z } from 'zod';
import { NotFoodError } from '@/lib/errors';

const NotFoodResponseSchema = z.object({
  error: z.literal('NOT_FOOD'),
  aiNote: z.string().optional(),
});

export function extractLegacyJson(rawResponse: unknown): unknown {
  if (typeof rawResponse !== 'string' || !rawResponse.trim()) {
    throw new Error('Python API response did not contain an analysis result.');
  }

  try {
    return JSON.parse(rawResponse);
  } catch {
    // Older Python service versions may include CLI output before the JSON object.
  }

  for (let start = rawResponse.indexOf('{'); start >= 0; start = rawResponse.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < rawResponse.length; index += 1) {
      const character = rawResponse[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(rawResponse.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error('Failed to extract JSON from Python AI response.');
}

export function parsePythonAnalysis<T>(data: unknown, schema: z.ZodType<T>): T {
  if (!data || typeof data !== 'object') {
    throw new Error('Python API returned an invalid response envelope.');
  }

  const envelope = data as {
    status?: string;
    message?: string;
    result?: unknown;
    response?: unknown;
  };
  if (envelope.status !== 'success') {
    throw new Error(`Python API returned an error: ${envelope.message || 'Unknown error'}`);
  }

  const candidate = envelope.result ?? extractLegacyJson(envelope.response);
  const notFood = NotFoodResponseSchema.safeParse(candidate);
  if (notFood.success) {
    throw new NotFoodError(
      notFood.data.aiNote || 'This image does not contain identifiable food.'
    );
  }

  return schema.parse(candidate);
}
