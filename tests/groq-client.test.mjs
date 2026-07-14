import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGroqJson } from '../src/groq-client.mjs';

test('posts a structured request to the fixed Groq model', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return Response.json({ choices: [{ message: { content: '{"recognizedCourses":[]}' } }] });
  };
  const content = await requestGroqJson({
    apiKey: 'test-only', fetchImpl, timeoutMs: 100,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'extract' }] }],
  });
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured.body.model, 'qwen/qwen3.6-27b');
  assert.deepEqual(captured.body.response_format, { type: 'json_object' });
  assert.equal(captured.init.headers.authorization, 'Bearer test-only');
  assert.equal(content, '{"recognizedCourses":[]}');
});

test('maps Groq rate limits to a safe retryable error', async () => {
  const fetchImpl = async () => new Response('secret upstream body', { status: 429 });
  await assert.rejects(
    requestGroqJson({ apiKey: 'test-only', fetchImpl, messages: [] }),
    { status: 429, code: 'AI_RATE_LIMITED', message: 'AI 目前請求較多，請稍後再試。' },
  );
});

test('maps aborted Groq requests to a timeout', async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    requestGroqJson({ apiKey: 'test-only', fetchImpl, timeoutMs: 1, messages: [] }),
    { status: 504, code: 'AI_TIMEOUT' },
  );
});
