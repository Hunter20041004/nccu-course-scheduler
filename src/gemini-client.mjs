export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_SCREENSHOT_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_RECOMMENDATION_MODEL = 'gemini-3.5-flash';

export class GeminiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
  }
}

function convertPart(part) {
  if (part?.type === 'text') return { text: String(part.text ?? '') };
  if (part?.type === 'image_url') {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(part.image_url?.url || '');
    if (!match) throw new GeminiError('圖片格式不受支援。', 400, 'INVALID_IMAGE');
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }
  throw new GeminiError('AI 請求包含不支援的內容。', 400, 'INVALID_AI_CONTENT');
}

function mapGeminiStatus(status) {
  if (status === 400 || status === 401) return new GeminiError(
    '這組 API Key 無法使用，請回到 Google AI Studio 確認。', 401, 'GEMINI_KEY_INVALID');
  if (status === 403) return new GeminiError(
    '此 Google 帳號可能受到學校或公司政策限制，建議改用個人帳號。', 403, 'GEMINI_ACCOUNT_RESTRICTED');
  if (status === 429) return new GeminiError(
    '今天的免費額度已用完，請稍後或明天再試。', 429, 'GEMINI_FREE_QUOTA_EXHAUSTED');
  return new GeminiError('Gemini 暫時無法回應，請稍後再試。', 502, 'AI_UPSTREAM_ERROR');
}

export async function validateGeminiKey({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  if (!String(apiKey ?? '').trim()) {
    throw new GeminiError('請先設定自己的 Gemini API Key。', 400, 'GEMINI_KEY_REQUIRED');
  }
  let response;
  try {
    response = await fetchImpl(`${GEMINI_API_BASE}/${GEMINI_SCREENSHOT_MODEL}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new GeminiError('連線逾時，請確認網路後再試。', 504, 'AI_TIMEOUT');
    }
    throw new GeminiError('Gemini 暫時無法回應，請稍後再試。', 502, 'AI_UPSTREAM_ERROR');
  }
  if (!response.ok) throw mapGeminiStatus(response.status);
  return { valid: true };
}

function convertMessages(messages) {
  const systemText = messages
    .filter(({ role }) => role === 'system')
    .map(({ content }) => String(content ?? ''))
    .join('\n\n');
  const contents = messages
    .filter(({ role }) => role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: typeof message.content === 'string'
        ? [{ text: message.content }]
        : message.content.map(convertPart),
    }));
  return { systemText, contents };
}

export async function requestGeminiJson({
  apiKey,
  model,
  messages,
  maxCompletionTokens,
  fetchImpl = fetch,
  timeoutMs = 45_000,
}) {
  if (!apiKey) throw new TypeError('請先設定自己的 Gemini API Key。');
  const { systemText, contents } = convertMessages(messages);
  let response;
  try {
    response = await fetchImpl(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          ...(maxCompletionTokens ? { maxOutputTokens: maxCompletionTokens } : {}),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new GeminiError('連線逾時，請確認網路後再試。', 504, 'AI_TIMEOUT');
    }
    throw new GeminiError('Gemini 暫時無法回應，請稍後再試。', 502, 'AI_UPSTREAM_ERROR');
  }
  if (!response.ok) throw mapGeminiStatus(response.status);
  const payload = await response.json();
  const content = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part) => typeof part === 'string')
    .join('');
  if (!content) throw new GeminiError('Gemini 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
  return content;
}
