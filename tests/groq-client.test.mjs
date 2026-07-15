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
    maxCompletionTokens: 2_200,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'extract' }] }],
  });
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured.body.model, 'qwen/qwen3.6-27b');
  assert.deepEqual(captured.body.response_format, { type: 'json_object' });
  assert.equal(captured.body.max_completion_tokens, 2_200);
  assert.equal('reasoning_effort' in captured.body, false);
  assert.equal(captured.init.headers.authorization, 'Bearer test-only');
  assert.equal(content, '{"recognizedCourses":[]}');
});

test('maps Groq rate limits to a safe retryable error', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('secret upstream body', { status: 429 });
  };
  await assert.rejects(
    requestGroqJson({ apiKey: 'test-only', fetchImpl, messages: [] }),
    { status: 429, code: 'AI_RATE_LIMITED', message: 'AI 目前請求較多，請稍後再試。' },
  );
  assert.equal(calls, 1);
});

test('waits once for a short Groq token reset and retries the request', async () => {
  let calls = 0;
  const waits = [];
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return Response.json(
        { error: { code: 'rate_limit_exceeded' } },
        { status: 429, headers: { 'retry-after': '0.01' } },
      );
    }
    return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
  };

  const content = await requestGroqJson({
    apiKey: 'test-only', fetchImpl, messages: [],
    sleepImpl: async (milliseconds) => { waits.push(milliseconds); },
  });

  assert.equal(content, '{"ok":true}');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [110]);
});

test('retries one transient Groq JSON validation failure', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return Response.json({ error: { code: 'json_validate_failed' } }, { status: 400 });
    }
    return Response.json({ choices: [{ message: { content: '{"plans":[]}' } }] });
  };
  const content = await requestGroqJson({ apiKey: 'test-only', fetchImpl, messages: [] });
  assert.equal(calls, 2);
  assert.equal(content, '{"plans":[]}');
});

test('can report a JSON validation failure without resending a large request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ error: { code: 'json_validate_failed' } }, { status: 400 });
  };

  await assert.rejects(
    requestGroqJson({
      apiKey: 'test-only', fetchImpl, messages: [], retryJsonValidation: false,
    }),
    { status: 502, code: 'AI_OUTPUT_INVALID' },
  );
  assert.equal(calls, 1);
});

test('reports repeated Groq JSON generation failures accurately', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ error: { code: 'json_validate_failed' } }, { status: 400 });
  };

  await assert.rejects(
    requestGroqJson({ apiKey: 'test-only', fetchImpl, messages: [] }),
    { status: 502, code: 'AI_OUTPUT_INVALID', message: 'AI 辨識格式失敗，請再試一次。' },
  );
  assert.equal(calls, 2);
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
