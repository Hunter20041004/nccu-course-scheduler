import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNccuCourseUrl,
  candidateIncludesCourseCode,
  eligibilityRuleFromOfficialRestriction,
  nccuCourseToCandidate,
  sanitizeOfficialEligibilityRules,
  searchNccuCourses,
} from '../src/nccu-course-adapter.mjs';

test('builds the NCCU 115-1 keyword endpoint', () => {
  const url = buildNccuCourseUrl({ term: '115-1', keyword: '人機互動' });
  assert.equal(
    decodeURIComponent(url.pathname),
    '/course/zh-TW/:sem=1151 人機互動 /',
  );
});

test('normalizes the public NCCU course response', async () => {
  const fetchImpl = async () => Response.json([{ y: '115', s: '1', subNum: '703055001',
    subNam: '人機互動', teaNam: '廖文宏', subPoint: '3.0', subTime: '四234',
    teaSchmUrl: 'https://newdoc.nccu.edu.tw/example.html', note: '＠備註:僅限資訊系及雙主修學生修讀。',
    lmtKind: '限本系學生', gdeTpeMsg: '' }]);
  assert.deepEqual(await searchNccuCourses({ term: '115-1', keyword: '703055001', fetchImpl }), [{
    courseCode: '703055001', title: '人機互動', teacher: '廖文宏', credits: 3,
    scheduleText: '四234', available: true,
    sourceUrl: 'https://newdoc.nccu.edu.tw/example.html',
    restrictionText: '僅限資訊系及雙主修學生修讀。；限本系學生',
  }]);
});

test('converts official periods and restrictions into a schedulable conditional candidate', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: '509041001',
    title: '德國文學概論',
    teacher: '蔡莫妮',
    credits: 2,
    scheduleText: '四78',
    restrictionText: '僅限歐文系及雙主修學生修讀。',
    available: true,
    sourceUrl: 'https://newdoc.nccu.edu.tw/example.html',
  });

  assert.equal(candidate.sectionCode, '509041001');
  assert.deepEqual(
    candidate.meetings.map(({ day, label }) => ({ day, label })),
    [{ day: 4, label: '四78' }],
  );
  assert.equal(candidate.eligibilityRules[0].conditionId, 'official-restriction:509041001');
});

test('detects an existing NCCU section code regardless of import source', () => {
  assert.equal(candidateIncludesCourseCode([
    { id: 'hci', sectionCode: '703055001', source: 'built-in' },
  ], '703055001'), true);
  assert.equal(candidateIncludesCourseCode([], '703055001'), false);
});

test('keeps expanded-minor course notes informational', () => {
  assert.deepEqual(eligibilityRuleFromOfficialRestriction({
    courseCode: '010056001',
    restrictionText: '日文系擴大輔系課程',
  }), []);
});

test('removes only informational official eligibility rules', () => {
  const customRule = {
    conditionId: 'custom:portfolio',
    enforcement: 'required',
    rationale: '自訂條件',
  };
  const course = sanitizeOfficialEligibilityRules({
    id: 'ai-010056001',
    sectionCode: '010056001',
    eligibilityRules: [{
      conditionId: 'official-restriction:010056001',
      enforcement: 'required',
      rationale: '日文系擴大輔系課程',
    }, customRule],
  });

  assert.deepEqual(course.eligibilityRules, [customRule]);
});
