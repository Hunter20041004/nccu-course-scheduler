export class NccuLookupError extends Error {
  constructor(message = '政大課程資料暫時無法查詢。') {
    super(message);
    this.name = 'NccuLookupError';
  }
}

export function buildNccuCourseUrl({ term, keyword }) {
  const semester = String(term).replace('-', '');
  const query = `:sem=${semester} :curn=${String(keyword).trim()} `;
  return new URL(`/course/zh-TW/${encodeURIComponent(query)}/`, 'https://es.nccu.edu.tw');
}

export function normalizeNccuRows(rows, term) {
  if (!Array.isArray(rows)) throw new NccuLookupError();
  const [year, semester] = String(term).split('-');
  return rows
    .filter((row) => row?.y === year && row?.s === semester)
    .map((row) => ({
      courseCode: String(row.subNum || '').trim(),
      title: String(row.subNam || '').trim(),
      teacher: String(row.teaNam || '').trim(),
      credits: Number(row.subPoint),
      scheduleText: String(row.subTime || '').trim(),
      available: true,
      sourceUrl: String(row.teaSchmUrl || '').trim(),
      restrictionText: String(row.note || '')
        .replace(/^＠備註\s*[:：]?\s*/, '')
        .trim()
        .replace(/^無$/, ''),
    }))
    .filter((course) => course.courseCode && course.title && Number.isFinite(course.credits));
}

function isLegacyRenegotiationError(error) {
  return error?.cause?.code === 'ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED';
}

async function requestNccuWithNodeHttps(url) {
  const [{ get }, { constants }] = await Promise.all([
    import('node:https'),
    import('node:crypto'),
  ]);
  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers: { accept: 'application/json' },
      secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) {
          reject(new Error('NCCU response not ok'));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(15_000, () => request.destroy(new Error('NCCU request timed out')));
    request.on('error', reject);
  });
}

export async function searchNccuCourses({ term, keyword, fetchImpl = fetch }) {
  try {
    const url = buildNccuCourseUrl({ term, keyword });
    let rows;
    try {
      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('NCCU response not ok');
      rows = await response.json();
    } catch (error) {
      if (!isLegacyRenegotiationError(error) || typeof process === 'undefined') throw error;
      rows = await requestNccuWithNodeHttps(url);
    }
    return normalizeNccuRows(rows, term);
  } catch (error) {
    if (error instanceof NccuLookupError) throw error;
    throw new NccuLookupError();
  }
}
