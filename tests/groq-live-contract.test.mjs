import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestGroqJson } from '../src/groq-client.mjs';

const hasSecret = Boolean(process.env.GROQ_API_KEY);

test('live Groq model returns JSON object content', { skip: !hasSecret, timeout: 60_000 }, async () => {
  const content = await requestGroqJson({
    apiKey: process.env.GROQ_API_KEY,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: 'Return {"ok":true}.' },
    ],
  });
  assert.equal(JSON.parse(content).ok, true);
});

test('live Groq model accepts one base64 image', { skip: !hasSecret, timeout: 60_000 }, async () => {
  const base64 = (await readFile(new URL('./fixtures/one-pixel-png.base64', import.meta.url), 'utf8')).trim();
  const content = await requestGroqJson({
    apiKey: process.env.GROQ_API_KEY,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: [
        { type: 'text', text: 'Return {"seen":true}.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
      ] },
    ],
  });
  assert.equal(JSON.parse(content).seen, true);
});
