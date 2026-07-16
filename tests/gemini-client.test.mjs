import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEMINI_RECOMMENDATION_MODEL,
  GEMINI_SCREENSHOT_MODEL,
  requestGeminiJson,
  validateGeminiKey,
} from '../src/gemini-client.mjs';

test('posts JSON generation to the selected Gemini model', async () => {
  let captured;
  const content = await requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_RECOMMENDATION_MODEL,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: 'Return {"ok":true}.' },
    ],
    maxCompletionTokens: 2200,
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    },
  });
  assert.match(captured.url, /models\/gemini-3\.5-flash:generateContent$/);
  assert.equal(captured.init.headers['x-goog-api-key'], 'test-key');
  assert.equal(captured.body.systemInstruction.parts[0].text, 'Return JSON only.');
  assert.equal(captured.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(captured.body.generationConfig.maxOutputTokens, 2200);
  assert.equal(content, '{"ok":true}');
});

test('converts screenshot data URLs into inlineData', async () => {
  let body;
  await requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_SCREENSHOT_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'text', text: '辨識圖片' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,U01BTEw=' } },
    ] }],
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
    },
  });
  assert.deepEqual(body.contents[0].parts, [
    { text: '辨識圖片' },
    { inlineData: { mimeType: 'image/png', data: 'U01BTEw=' } },
  ]);
});

test('maps free-tier exhaustion without upstream contents', async () => {
  await assert.rejects(requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_RECOMMENDATION_MODEL, messages: [],
    fetchImpl: async () => new Response('secret upstream body', { status: 429 }),
  }), {
    status: 429,
    code: 'GEMINI_FREE_QUOTA_EXHAUSTED',
    message: '今天的免費額度已用完，請稍後或明天再試。',
  });
});

test('validates a key with model metadata', async () => {
  let captured;
  const result = await validateGeminiKey({
    apiKey: 'test-key',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return Response.json({ name: 'models/gemini-3.1-flash-lite' });
    },
  });
  assert.match(captured.url, /models\/gemini-3\.1-flash-lite$/);
  assert.equal(captured.init.headers['x-goog-api-key'], 'test-key');
  assert.deepEqual(result, { valid: true });
});

test('maps invalid and restricted Gemini keys to distinct safe errors', async () => {
  await assert.rejects(validateGeminiKey({
    apiKey: 'bad-key', fetchImpl: async () => new Response('private', { status: 401 }),
  }), { status: 401, code: 'GEMINI_KEY_INVALID' });
  await assert.rejects(validateGeminiKey({
    apiKey: 'restricted-key', fetchImpl: async () => new Response('private', { status: 403 }),
  }), { status: 403, code: 'GEMINI_ACCOUNT_RESTRICTED' });
});

test('maps aborted Gemini requests to a safe timeout', async () => {
  const fetchImpl = async (_url, { signal }) => {
    assert.equal(signal instanceof AbortSignal, true);
    const error = new Error('The operation timed out.');
    error.name = 'TimeoutError';
    throw error;
  };
  await assert.rejects(requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_RECOMMENDATION_MODEL,
    messages: [], fetchImpl, timeoutMs: 1,
  }), { status: 504, code: 'AI_TIMEOUT' });
});

test('rejects a Gemini response without candidate text', async () => {
  await assert.rejects(requestGeminiJson({
    apiKey: 'test-key', model: GEMINI_RECOMMENDATION_MODEL, messages: [],
    fetchImpl: async () => Response.json({ candidates: [] }),
  }), {
    status: 502, code: 'INVALID_AI_RESPONSE', message: 'Gemini 回覆格式不正確。',
  });
});
