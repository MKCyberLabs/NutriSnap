import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import { NotFoodError } from '@/lib/errors';
import { extractLegacyJson, parsePythonAnalysis } from '@/lib/python-analysis-response';

const ResultSchema = z.object({ value: z.number() });

test('prefers the structured result field', () => {
  assert.deepEqual(
    parsePythonAnalysis({ status: 'success', result: { value: 7 } }, ResultSchema),
    { value: 7 }
  );
});

test('supports legacy CLI-prefixed response text', () => {
  assert.deepEqual(
    parsePythonAnalysis(
      { status: 'success', response: 'thinking\n{"value":7}\nfinished' },
      ResultSchema
    ),
    { value: 7 }
  );
});

test('extractor respects braces inside JSON strings', () => {
  assert.deepEqual(extractLegacyJson('prefix {"value":"a } brace"} suffix'), {
    value: 'a } brace',
  });
});

test('turns NOT_FOOD into the domain error', () => {
  assert.throws(
    () =>
      parsePythonAnalysis(
        { status: 'success', result: { error: 'NOT_FOOD', aiNote: 'A bicycle.' } },
        ResultSchema
      ),
    NotFoodError
  );
});

test('rejects an invalid structured result', () => {
  assert.throws(
    () => parsePythonAnalysis({ status: 'success', result: { value: 'seven' } }, ResultSchema),
    z.ZodError
  );
});
