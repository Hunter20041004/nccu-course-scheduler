import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNccuCourseUrl,
  candidateIncludesCourseCode,
  eligibilityRuleFromOfficialRestriction,
  nccuCourseToCandidate,
  sanitizeOfficialEligibilityRules,
  searchNccuCourses,
  trustedOfficialSyllabusUrl,
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
  }, { checkedAt: '2026-07-17T18:00:00.000Z' });

  assert.equal(candidate.sectionCode, '509041001');
  assert.deepEqual(
    candidate.meetings.map(({ day, label }) => ({ day, label })),
    [{ day: 4, label: '四78' }],
  );
  assert.equal(candidate.eligibilityRules[0].conditionId, 'official-restriction:509041001');
  assert.equal(candidate.eligibilityRules[0].conditionLabel, '我是歐文系或雙主修學生');
  assert.equal(candidate.eligibilityRules[0].source, 'nccu-official');
  assert.deepEqual(candidate.syllabus, {
    status: 'available',
    url: 'https://newdoc.nccu.edu.tw/example.html',
    checkedAt: '2026-07-17T18:00:00.000Z',
  });
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

test('maps official notes into typed candidate metadata', () => {
  const candidate = nccuCourseToCandidate({
    courseCode: '703055001',
    title: '人機互動',
    teacher: '廖文宏',
    credits: 3,
    scheduleText: '四234',
    restrictionText: '英語授課；傳播類課程',
  });

  assert.deepEqual(candidate.eligibilityRules, []);
  assert.deepEqual(candidate.deliveryNotes, ['英語授課']);
  assert.deepEqual(candidate.programTags, ['傳播類課程']);
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

test('removes a legacy giant TAICA checkbox while preserving typed notes', () => {
  const rationale = '【臺灣大專院校人工智慧學程聯盟課程】1.TAICA主導課程。2.遠距上課每週四13:10-16:00，使用NTUCOOL平台。3.12/26共同展示交流期末成果。4.選課前務必詳閱教學大綱，需於本校選課、不可跨校選課。';
  const course = sanitizeOfficialEligibilityRules({
    id: 'ai-070426001',
    sectionCode: '070426001',
    eligibilityRules: [{
      conditionId: 'official-restriction:070426001',
      enforcement: 'required',
      rationale,
    }],
  });

  assert.deepEqual(course.eligibilityRules, []);
  assert.ok(course.deliveryNotes.some((note) => note.includes('NTUCOOL')));
  assert.deepEqual(course.examEvents, [{ date: '12/26', label: '共同展示交流期末成果' }]);
});

test('allows only secure NCCU syllabus links', () => {
  assert.equal(trustedOfficialSyllabusUrl({
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=010056&gop=00&s=1.html',
  }), 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=010056&gop=00&s=1.html');
  assert.equal(trustedOfficialSyllabusUrl({ sourceUrl: 'javascript:alert(1)' }), '');
  assert.equal(trustedOfficialSyllabusUrl({ sourceUrl: 'https://example.com/syllabus' }), '');
});
