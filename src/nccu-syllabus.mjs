import { trustedNccuUrl } from './nccu-url.mjs';

const HTML_ENTITIES = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' '],
]);

function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const numeric = code[1].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
    }
    return HTML_ENTITIES.get(code.toLowerCase()) ?? entity;
  });
}

export function extractSyllabusText(html, { maxChars = 24_000 } = {}) {
  const withoutExecutableContent = String(html || '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');
  const withLineBreaks = withoutExecutableContent
    .replace(/<(br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6]|table|ul|ol)>/gi, '\n');
  return decodeHtmlEntities(withLineBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, maxChars)
    .trim();
}

export class NccuSyllabusError extends Error {
  constructor(message, status = 502, code = 'NCCU_SYLLABUS_UNAVAILABLE') {
    super(message);
    this.name = 'NccuSyllabusError';
    this.status = status;
    this.code = code;
  }
}

export async function fetchOfficialSyllabus({
  url,
  fetchImpl = fetch,
  maxBytes = 1_500_000,
  maxChars = 24_000,
  timeoutMs = 15_000,
}) {
  const trustedUrl = trustedNccuUrl(url);
  if (!trustedUrl) {
    throw new NccuSyllabusError('只允許讀取政大官方課綱。', 400, 'UNTRUSTED_SYLLABUS_URL');
  }
  let response;
  try {
    response = await fetchImpl(trustedUrl, {
      headers: { accept: 'text/html' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new NccuSyllabusError('政大官方課綱暫時無法讀取，請稍後再試。');
  }
  if (!response.ok) throw new NccuSyllabusError('政大官方課綱暫時無法讀取，請稍後再試。');
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new NccuSyllabusError('課綱內容過大，暫時無法進行比較。', 413, 'SYLLABUS_TOO_LARGE');
  }
  const html = await response.text();
  if (html.length > maxBytes) {
    throw new NccuSyllabusError('課綱內容過大，暫時無法進行比較。', 413, 'SYLLABUS_TOO_LARGE');
  }
  const text = extractSyllabusText(html, { maxChars });
  if (!text) throw new NccuSyllabusError('這份官方課綱目前沒有可比較的文字內容。', 422, 'EMPTY_SYLLABUS');
  return { url: trustedUrl, text };
}
