import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCourseSyllabi } from '../src/ai-service.mjs';

const hasSecret = Boolean(process.env.GEMINI_API_KEY);

test('live Gemini compares two real NCCU syllabi with a valid schema', {
  skip: !hasSecret,
  timeout: 120_000,
}, async () => {
  const result = await compareCourseSyllabi({
    courses: [
      {
        id: '070394021',
        sectionCode: '070394021',
        title: '人工智慧方法與工具',
      },
      {
        id: '783004001',
        sectionCode: '783004001',
        title: '人工智慧程式設計',
      },
    ],
  }, {
    apiKey: process.env.GEMINI_API_KEY,
  });

  assert.ok(result.summary);
  assert.deepEqual(
    result.courses.map(({ id }) => id).sort(),
    ['070394021', '783004001'],
  );
});
