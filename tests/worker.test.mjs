import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/worker.mjs';

test('routes screenshot imports through the server-side Groq secret', async () => {
  const worker = createWorker({
    html: '<h1>ok</h1>', catalog: [],
    importService: async (_input, deps) => ({
      importedCourses: [], duplicates: [], pendingCourses: [],
      warnings: [deps.apiKey === 'server-secret' ? 'ok' : 'bad'],
    }),
  });
  const response = await worker.fetch(new Request('http://local/api/ai/import-courses', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: 'data:image/png;base64,QQ==', term: '115-1' }),
  }), { GROQ_API_KEY: 'server-secret' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    importedCourses: [], duplicates: [], pendingCourses: [], warnings: ['ok'],
  });
});
