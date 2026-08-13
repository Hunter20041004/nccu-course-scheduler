import {
  compareCourseSyllabi,
  importCoursesFromScreenshot,
  prepareCourseComparison,
  recommendCoursePlans,
} from './ai-service.mjs';
import { validateGeminiKey } from './gemini-client.mjs';

const BROWSER_SECURITY_HEADERS = {
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const contentSecurityPolicy = (nonce) => [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'nonce-${nonce}'`,
  "script-src-attr 'none'",
  `style-src 'nonce-${nonce}'`,
  `style-src-elem 'nonce-${nonce}'`,
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://es.nccu.edu.tw",
  'upgrade-insecure-requests',
].join('; ');

const jsonResponse = (body, status = 200, requestId = '') => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...BROWSER_SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    ...(requestId ? { 'x-request-id': requestId } : {}),
  },
});

function redactExactSecret(value, secret) {
  if (!secret) return value;
  if (typeof value === 'string') return value.replaceAll(secret, '[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => redactExactSecret(item, secret));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .map(([key, nested]) => [
      redactExactSecret(key, secret),
      redactExactSecret(nested, secret),
    ]));
}

async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    const error = new Error('請使用 JSON 格式送出。');
    error.status = 415;
    error.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw error;
  }
  try {
    return await request.json();
  } catch {
    const error = new Error('JSON 內容無法解析。');
    error.status = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function takeUserApiKey(input) {
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!apiKey) {
    const error = new Error('請先設定自己的 Gemini API Key。');
    error.status = 400;
    error.code = 'GEMINI_KEY_REQUIRED';
    throw error;
  }
  const serviceInput = { ...input };
  delete serviceInput.apiKey;
  return { apiKey, serviceInput };
}

export function createWorker({
  html,
  catalog = [],
  importService = importCoursesFromScreenshot,
  recommendationService = recommendCoursePlans,
  comparisonService = compareCourseSyllabi,
  comparisonPromptService = prepareCourseComparison,
  validateKey = validateGeminiKey,
  createRequestId = () => crypto.randomUUID(),
  createNonce = () => crypto.randomUUID().replaceAll('-', ''),
} = {}) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      const requestId = createRequestId();
      let submittedApiKey = '';
      const respond = (body, status = 200) => jsonResponse(
        redactExactSecret(body, submittedApiKey), status, requestId,
      );
      const takeSubmittedApiKey = async () => {
        const result = takeUserApiKey(await readJson(request));
        submittedApiKey = result.apiKey;
        return result;
      };
      if (request.method === 'GET' && url.pathname === '/') {
        const nonce = createNonce();
        return new Response(html.replaceAll('__CSP_NONCE__', nonce), {
          headers: {
            ...BROWSER_SECURITY_HEADERS,
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'private, no-store',
            'content-security-policy': contentSecurityPolicy(nonce),
          },
        });
      }
      try {
        if (request.method === 'POST' && url.pathname === '/api/ai/validate-key') {
          const { apiKey } = await takeSubmittedApiKey();
          return respond(await validateKey({ apiKey }));
        }
        if (request.method === 'POST' && url.pathname === '/api/ai/import-courses') {
          const { apiKey, serviceInput } = await takeSubmittedApiKey();
          return respond(await importService(serviceInput, {
            apiKey,
            catalog,
          }));
        }
        if (request.method === 'POST' && url.pathname === '/api/ai/recommend-plans') {
          const { apiKey, serviceInput } = await takeSubmittedApiKey();
          return respond(await recommendationService(serviceInput, {
            apiKey,
          }));
        }
        if (request.method === 'POST' && url.pathname === '/api/ai/compare-courses') {
          const { apiKey, serviceInput } = await takeSubmittedApiKey();
          return respond(await comparisonService(serviceInput, { apiKey }));
        }
        if (request.method === 'POST' && url.pathname === '/api/course-comparison/prompt') {
          const prepared = await comparisonPromptService(await readJson(request));
          return respond({
            prompt: prepared.prompt,
            sources: prepared.sources,
            profileMode: prepared.profileMode,
            conflicts: prepared.conflicts,
          });
        }
        return respond({ error: { code: 'NOT_FOUND', message: '找不到此路徑。' } }, 404);
      } catch (error) {
        const status = Number(error?.status) || 500;
        const safeStatus = status >= 400 && status <= 599 ? status : 500;
        const retryable = [408, 429, 502, 503, 504].includes(safeStatus)
          || ['AI_RATE_LIMITED', 'AI_TIMEOUT', 'AI_UPSTREAM_ERROR'].includes(error?.code);
        return respond({ error: {
          code: error?.code || 'INTERNAL_ERROR',
          message: safeStatus === 500 ? '伺服器暫時無法處理，請稍後重試。' : error.message,
          retryable,
          requestId,
        } }, safeStatus);
      }
    },
  };
}
