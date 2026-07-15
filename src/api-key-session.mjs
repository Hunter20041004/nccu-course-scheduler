export function createApiKeySession() {
  let key = null;
  return {
    setKey(value) {
      const normalized = String(value ?? '').trim();
      if (!normalized) throw new TypeError('請輸入 Gemini API Key。');
      key = normalized;
    },
    getKey: () => key,
    hasKey: () => Boolean(key),
    clearKey: () => { key = null; },
  };
}

export async function validateAndStoreApiKey({ apiKey, session, fetchImpl = fetch }) {
  const normalized = String(apiKey ?? '').trim();
  if (!normalized) throw new TypeError('請輸入 Gemini API Key。');
  const response = await fetchImpl('/api/ai/validate-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: normalized }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || '無法驗證 API Key。');
  session.setKey(normalized);
  return payload;
}
