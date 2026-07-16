import { NCCU_PERIODS } from './nccu-periods.mjs';

export class NccuLookupError extends Error {
  constructor(message = '政大課程資料暫時無法查詢。') {
    super(message);
    this.name = 'NccuLookupError';
  }
}

export function meetingsFromNccuText(scheduleText) {
  const dayNumbers = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7 };
  const meetings = [];
  for (const match of String(scheduleText || '').matchAll(/([一二三四五六日])([ABCD12345678EFGH]+)/g)) {
    const slots = [...match[2]]
      .map((code) => NCCU_PERIODS.find((period) => period.code === code))
      .filter(Boolean);
    if (!slots.length) continue;
    meetings.push({
      day: dayNumbers[match[1]],
      start: Math.min(...slots.map((slot) => slot.start)),
      end: Math.max(...slots.map((slot) => slot.end)),
      label: `${match[1]}${match[2]}`,
    });
  }
  return meetings;
}

export function eligibilityRuleFromOfficialRestriction(course) {
  const restriction = String(course.restrictionText || '').trim();
  if (!restriction || !/(僅限|(^|[；。])限|須|需|先修|雙主修|輔系|不得|優先)/.test(restriction)) return [];
  const audience = restriction.match(/^僅限(.+?)學生修讀[。.]?$/)?.[1];
  const prerequisiteLanguage = restriction.match(/先修習[^。；]{0,30}(日文|英文|德文|法文)/)?.[1];
  const conditionLabel = prerequisiteLanguage && restriction.includes('或')
    ? `我符合本課程任一項${prerequisiteLanguage}先修資格`
    : audience
      ? `我是${audience.replace('及雙主修', '或雙主修')}學生`
      : `我符合：${restriction.replace(/[。.]$/, '')}`;
  return [{
    conditionId: `official-restriction:${course.courseCode}`,
    conditionLabel,
    conditionDescription: `政大官方備註：${restriction}`,
    enforcement: 'required',
    rationale: restriction,
  }];
}

export function nccuCourseToCandidate(course) {
  const meetings = meetingsFromNccuText(course.scheduleText);
  const eligibilityRules = eligibilityRuleFromOfficialRestriction(course);
  return {
    id: `ai-${course.courseCode}`,
    title: course.title,
    credits: course.credits,
    sectionCode: course.courseCode,
    teacher: course.teacher,
    available: true,
    required: false,
    schedule: meetings[0] || null,
    meetings,
    asyncAllowed: false,
    source: 'nccu-verified-import',
    sourceUrl: course.sourceUrl || '',
    conditions: [
      '由政大 115-1 公開課程資料匯入',
      ...(course.restrictionText ? [course.restrictionText] : []),
    ],
    eligibilityRules,
    sections: [`${course.courseCode}｜${course.scheduleText || '時間未定'}`],
  };
}

export function candidateIncludesCourseCode(courseStore, courseCode) {
  const normalized = String(courseCode || '').trim();
  return Boolean(normalized) && courseStore.some(
    (course) => String(course.sectionCode || '').trim() === normalized,
  );
}

export function buildNccuCourseUrl({ term, keyword }) {
  const semester = String(term).replace('-', '');
  const query = `:sem=${semester} :curn=${String(keyword).trim()} `;
  return new URL(`/course/zh-TW/${encodeURIComponent(query)}/`, 'https://es.nccu.edu.tw');
}

function normalizeRestriction(value) {
  const normalized = String(value || '')
    .replace(/^＠備註\s*[:：]?\s*/, '')
    .trim();
  return ['無', '無資料'].includes(normalized) ? '' : normalized;
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
      restrictionText: [...new Set([
        normalizeRestriction(row.note),
        normalizeRestriction(row.lmtKind),
        normalizeRestriction(row.gdeTpeMsg),
      ].filter(Boolean))].join('；'),
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
