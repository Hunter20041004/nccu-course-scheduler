import { importCoursesFromScreenshot, recommendCoursePlans } from './ai-service.mjs';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
  },
});

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

export function createWorker({
  html,
  catalog = [],
  importService = importCoursesFromScreenshot,
  recommendationService = recommendCoursePlans,
} = {}) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(html, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'private, no-store',
          },
        });
      }
      try {
        if (request.method === 'POST' && url.pathname === '/api/ai/import-courses') {
          const input = await readJson(request);
          return jsonResponse(await importService(input, {
            apiKey: env.GROQ_API_KEY,
            catalog,
          }));
        }
        if (request.method === 'POST' && url.pathname === '/api/ai/recommend-plans') {
          const input = await readJson(request);
          return jsonResponse(await recommendationService(input, {
            apiKey: env.GROQ_API_KEY,
          }));
        }
        return jsonResponse({ error: { code: 'NOT_FOUND', message: '找不到此路徑。' } }, 404);
      } catch (error) {
        const status = Number(error?.status) || 500;
        const safeStatus = status >= 400 && status <= 599 ? status : 500;
        return jsonResponse({ error: {
          code: error?.code || 'INTERNAL_ERROR',
          message: safeStatus === 500 ? '伺服器暫時無法處理，請稍後重試。' : error.message,
        } }, safeStatus);
      }
    },
  };
}
