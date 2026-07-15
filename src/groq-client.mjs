export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'qwen/qwen3.6-27b';

export class GroqError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GroqError';
    this.status = status;
    this.code = code;
  }
}

function mapGroqStatus(status) {
  if (status === 429) return new GroqError('AI 目前請求較多，請稍後再試。', 429, 'AI_RATE_LIMITED');
  if (status === 401 || status === 403) return new GroqError('AI 服務尚未正確設定。', 503, 'AI_NOT_CONFIGURED');
  return new GroqError('AI 服務暫時無法使用。', 502, 'AI_UPSTREAM_ERROR');
}

export async function requestGroqJson({
  apiKey,
  messages,
  reasoningEffort,
  maxCompletionTokens,
  fetchImpl = fetch,
  timeoutMs = 45_000,
  sleepImpl = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  if (!apiKey) throw new GroqError('AI 服務尚未設定。', 503, 'AI_NOT_CONFIGURED');
  const requestBody = JSON.stringify({
    model: GROQ_MODEL,
    messages,
    response_format: { type: 'json_object' },
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    ...(maxCompletionTokens ? { max_completion_tokens: maxCompletionTokens } : {}),
  });
  let response;
  let retriedJsonValidation = false;
  let retriedRateLimit = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetchImpl(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: requestBody,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new GroqError('AI 回應逾時，請重試。', 504, 'AI_TIMEOUT');
      }
      throw new GroqError('AI 服務暫時無法使用。', 502, 'AI_UPSTREAM_ERROR');
    }
    if (response.ok) break;
    const errorPayload = await response.json().catch(() => null);
    if (response.status === 400 && errorPayload?.error?.code === 'json_validate_failed') {
      if (!retriedJsonValidation) {
        retriedJsonValidation = true;
        continue;
      }
      throw new GroqError('AI 辨識格式失敗，請再試一次。', 502, 'AI_OUTPUT_INVALID');
    }
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
    if (
      response.status === 429
      && !retriedRateLimit
      && Number.isFinite(retryAfterSeconds)
      && retryAfterSeconds >= 0
      && retryAfterSeconds <= 15
    ) {
      retriedRateLimit = true;
      await sleepImpl((retryAfterSeconds * 1_000) + 100);
      continue;
    }
    throw mapGroqStatus(response.status);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new GroqError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
  }
  return content;
}
