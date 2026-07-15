import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiKeySession, validateAndStoreApiKey } from '../src/api-key-session.mjs';

test('keeps the Gemini key only in memory and clears it', () => {
  const session = createApiKeySession();
  assert.equal(session.hasKey(), false);
  session.setKey('  test-key  ');
  assert.equal(session.getKey(), 'test-key');
  session.clearKey();
  assert.equal(session.getKey(), null);
});

test('stores a key only after server validation succeeds', async () => {
  const session = createApiKeySession();
  let request;
  await validateAndStoreApiKey({
    apiKey: 'user-key', session,
    fetchImpl: async (url, init) => {
      request = { url, body: JSON.parse(init.body) };
      return Response.json({ valid: true });
    },
  });
  assert.deepEqual(request, {
    url: '/api/ai/validate-key', body: { apiKey: 'user-key' },
  });
  assert.equal(session.getKey(), 'user-key');
});

test('leaves the session empty when server validation fails', async () => {
  const session = createApiKeySession();
  await assert.rejects(validateAndStoreApiKey({
    apiKey: 'bad-key', session,
    fetchImpl: async () => Response.json({
      error: { message: '這組 API Key 無法使用。' },
    }, { status: 401 }),
  }), /這組 API Key 無法使用/);
  assert.equal(session.hasKey(), false);
});
