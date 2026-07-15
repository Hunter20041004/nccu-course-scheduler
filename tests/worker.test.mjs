import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/worker.mjs';

test('removes the user key from service input', async () => {
  let captured;
  const worker = createWorker({
    html: '<h1>ok</h1>',
    importService: async (input, deps) => {
      captured = { input, deps };
      return { importedCourses: [], duplicates: [], pendingCourses: [], warnings: [] };
    },
  });
  await worker.fetch(new Request('http://local/api/ai/import-courses', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: 'user-key', imageDataUrl: 'data:image/png;base64,QQ==', term: '115-1' }),
  }), { GROQ_API_KEY: 'must-not-be-used' });
  assert.equal(captured.deps.apiKey, 'user-key');
  assert.equal('apiKey' in captured.input, false);
});

test('routes screenshot imports through the user Gemini key', async () => {
  const worker = createWorker({
    html: '<h1>ok</h1>', catalog: [],
    importService: async (_input, deps) => ({
      importedCourses: [], duplicates: [], pendingCourses: [],
      warnings: [deps.apiKey === 'user-secret' ? 'ok' : 'bad'],
    }),
  });
  const response = await worker.fetch(new Request('http://local/api/ai/import-courses', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: 'user-secret', imageDataUrl: 'data:image/png;base64,QQ==', term: '115-1' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    importedCourses: [], duplicates: [], pendingCourses: [], warnings: ['ok'],
  });
});

test('routes recommendation requests with the user Gemini key', async () => {
  const worker = createWorker({
    html: '<h1>ok</h1>', catalog: [],
    recommendationService: async (_input, deps) => ({
      summary: deps.apiKey === 'user-secret' ? 'ok' : 'bad', plans: [],
    }),
  });
  const response = await worker.fetch(new Request('http://local/api/ai/recommend-plans', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: 'user-secret' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { summary: 'ok', plans: [] });
});

test('validates a user Gemini key without persisting it', async () => {
  let received;
  const worker = createWorker({
    html: '<h1>ok</h1>',
    validateKey: async ({ apiKey }) => {
      received = apiKey;
      return { valid: true };
    },
  });
  const response = await worker.fetch(new Request('http://local/api/ai/validate-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: 'user-secret' }),
  }));
  assert.equal(received, 'user-secret');
  assert.deepEqual(await response.json(), { valid: true });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('rejects AI routes without a user key', async () => {
  const worker = createWorker({ html: '<h1>ok</h1>' });
  const response = await worker.fetch(new Request('http://local/api/ai/recommend-plans', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'GEMINI_KEY_REQUIRED', message: '請先設定自己的 Gemini API Key。' },
  });
});
