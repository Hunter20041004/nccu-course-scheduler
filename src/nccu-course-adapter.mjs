import { NCCU_PERIODS } from './nccu-periods.mjs';
import { classifyOfficialNotes } from './nccu-course-notes.mjs';
import { trustedNccuUrl } from './nccu-url.mjs';
import { officialSyllabusState } from './syllabus-state.mjs';

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
  const hasExplicitRestriction = /(僅限|(^|[；。])限|(?<![無不])(?:須|需)|先修|不得)/.test(restriction);
  if (!restriction || !hasExplicitRestriction) return [];
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

const VERIFIED_SCHEDULE_CORRECTIONS = Object.freeze({
  '701889001': Object.freeze({
    correctionId: 'nccu-1151-701889001-one-time-exam',
    deliveryMode: 'asynchronous',
    meetings: Object.freeze([]),
    deliveryNote: '官方 115-1 課綱：第 1–10、12–16 週為遠距，第 11 週為上機考。',
    events: Object.freeze([Object.freeze({
      label: '第 11 週上機考',
      week: 11,
      day: 2,
      start: 970,
      end: 1140,
    })]),
  }),
  '070424001': Object.freeze({
    correctionId: 'nccu-1151-taica-070424001',
    deliveryMode: 'asynchronous-optional',
    meetings: Object.freeze([
      Object.freeze({ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }),
    ]),
    deliveryNote: '官方 115-1 課綱：可接受非同步授課；同步遠距為週三 09:10–12:10。',
  }),
  '070421001': Object.freeze({
    correctionId: 'nccu-1151-taica-070421001',
    deliveryMode: 'asynchronous-optional',
    meetings: Object.freeze([
      Object.freeze({ day: 1, start: 540, end: 720, label: '週一 09:00–12:00' }),
    ]),
    events: Object.freeze([
      Object.freeze({ label: '實體考試', date: '2026-12-14', day: 1, start: 540, end: 720 }),
    ]),
    deliveryNote: '官方 115-1 課綱：可接受非同步授課；同步遠距為週一 09:00–12:00。',
  }),
});

export function applyVerifiedScheduleCorrections(candidate) {
  const correction = VERIFIED_SCHEDULE_CORRECTIONS[String(candidate?.sectionCode || '')];
  const verified1151Source = candidate?.source === 'nccu-verified-import'
    && /\/teaschm\/1151\//.test(trustedNccuUrl(candidate.sourceUrl));
  if (!correction || !verified1151Source) return candidate;
  const meetings = correction.meetings.map((meeting) => ({ ...meeting }));
  const correctionEvents = correction.events || [];
  const correctedEventKeys = new Set(correctionEvents.map((event) => (
    `${event.label}|${event.date || ''}|${event.week || ''}`
  )));
  const events = (candidate.events || []).filter((event) => !correctedEventKeys.has(
    `${event.label}|${event.date || ''}|${event.week || ''}`,
  ));
  return {
    ...candidate,
    schedule: meetings[0] || null,
    meetings,
    asyncAllowed: true,
    deliveryMode: correction.deliveryMode,
    attendance: 'async',
    scheduleCorrectionId: correction.correctionId,
    deliveryNotes: [...new Set([...(candidate.deliveryNotes || []), correction.deliveryNote])],
    events: [...events, ...correctionEvents.map((event) => ({ ...event }))],
  };
}

export function nccuCourseToCandidate(course, { checkedAt = null } = {}) {
  const meetings = meetingsFromNccuText(course.scheduleText);
  const officialNotes = classifyOfficialNotes(course);
  return applyVerifiedScheduleCorrections({
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
    syllabus: officialSyllabusState({
      sourceUrl: course.syllabusUrl || course.sourceUrl,
      lookupStatus: 'success',
      checkedAt,
    }),
    conditions: [
      '由政大 115-1 公開課程資料匯入',
      ...(course.restrictionText ? [course.restrictionText] : []),
    ],
    ...officialNotes,
    eligibilityRules: officialNotes.eligibilityRules,
    sections: [`${course.courseCode}｜${course.scheduleText || '時間未定'}`],
  });
}

export function sanitizeOfficialEligibilityRules(course = {}) {
  const currentRules = course.eligibilityRules || [];
  const officialRules = currentRules.filter(
    (rule) => String(rule.conditionId || '').startsWith('official-restriction:') && rule.rationale,
  );
  const legacyRestrictionNotes = course.source === 'nccu-verified-import'
    ? (course.informationNotes || []).filter((note) => (
      String(note).includes('擋修')
      || /^僅供.+?修習/.test(String(note))
    ))
    : [];
  if (!officialRules.length && !legacyRestrictionNotes.length) return course;
  const customRules = currentRules.filter(
    (rule) => !String(rule.conditionId || '').startsWith('official-restriction:'),
  );
  const classified = [
    ...officialRules.map((rule) => rule.rationale),
    ...legacyRestrictionNotes,
  ].map((restrictionText) => classifyOfficialNotes({
    courseCode: course.sectionCode || course.id,
    restrictionText,
  }));
  const unique = (values) => [...new Set(values)];
  const seenRuleIds = new Set();
  const eligibilityRules = [
    ...customRules,
    ...classified.flatMap(({ eligibilityRules: rules }) => rules),
  ].filter((rule) => {
    if (seenRuleIds.has(rule.conditionId)) return false;
    seenRuleIds.add(rule.conditionId);
    return true;
  });
  return {
    ...course,
    eligibilityRules,
    scheduleNotes: unique([...(course.scheduleNotes || []), ...classified.flatMap(({ scheduleNotes }) => scheduleNotes)]),
    deliveryNotes: unique([...(course.deliveryNotes || []), ...classified.flatMap(({ deliveryNotes }) => deliveryNotes)]),
    examEvents: [
      ...(course.examEvents || []),
      ...classified.flatMap(({ examEvents }) => examEvents),
    ],
    programTags: unique([...(course.programTags || []), ...classified.flatMap(({ programTags }) => programTags)]),
    informationNotes: unique([...(course.informationNotes || []), ...classified.flatMap(({ informationNotes }) => informationNotes)]),
  };
}

export function trustedOfficialSyllabusUrl(course = {}) {
  return trustedNccuUrl(course.sourceUrl);
}

export function candidateIncludesCourseCode(courseStore, courseCode) {
  const normalized = String(courseCode || '').trim();
  return Boolean(normalized) && courseStore.some(
    (course) => String(course.sectionCode || '').trim() === normalized,
  );
}

export function buildNccuCourseUrl({ term, keyword }) {
  const semester = String(term).replace('-', '');
  const query = `:sem=${semester} ${String(keyword).trim()} `;
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
