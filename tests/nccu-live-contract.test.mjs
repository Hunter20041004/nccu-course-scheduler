import test from 'node:test';
import assert from 'node:assert/strict';
import { nccuCourseToCandidate, searchNccuCourses } from '../src/nccu-course-adapter.mjs';
import { fetchOfficialSyllabus } from '../src/nccu-syllabus.mjs';
import { createWorker } from '../src/worker.mjs';

test('live NCCU 115-1 TAICA search exposes the complete official course set', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: 'TAICA' });
  const courseCodes = rows.map(({ courseCode }) => courseCode).sort();

  assert.deepEqual(courseCodes, [
    '070421001',
    '070422001',
    '070423001',
    '070424001',
    '070425001',
    '070426001',
    '070427001',
    '070450001',
    '070455001',
  ]);
  assert.ok(courseCodes.includes('070424001'));
});

test('live TAICA fintech syllabus explicitly permits asynchronous attendance', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '070424001' });
  const course = rows.find((row) => row.courseCode === '070424001');
  const syllabus = await fetchOfficialSyllabus({ url: course.sourceUrl });

  assert.match(syllabus.text, /可接受非同步授課/);
  assert.match(syllabus.text, /星期三\s*9:10~12:10/);
});

test('live TAICA physical AI syllabus remains synchronous-only', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '070450001' });
  const course = rows.find((row) => row.courseCode === '070450001');
  const syllabus = await fetchOfficialSyllabus({ url: course.sourceUrl });

  assert.match(syllabus.text, /同步遠距/);
  assert.doesNotMatch(syllabus.text, /可接受非同步授課/);
});

test('live NCCU endpoint exposes the fields used by the adapter', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '遊戲引擎應用開發' });
  assert.ok(rows.some((row) => row.courseCode === '781063001' && row.title === '遊戲引擎應用開發'));
  assert.ok(rows.every((row) => /^\w{9}$/.test(row.courseCode)));
  assert.ok(rows.every((row) => row.title && Number.isFinite(row.credits)));
});

test('live NCCU 115-1 search returns a course that can become a scheduler candidate', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '703055001' });
  const candidate = nccuCourseToCandidate(
    rows.find((row) => row.courseCode === '703055001'),
  );

  assert.equal(candidate.sectionCode, '703055001');
  assert.ok(candidate.meetings.length > 0);
});

test('live NCCU HCI course exposes a trusted syllabus link', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '703055001' });
  const candidate = nccuCourseToCandidate(
    rows.find((row) => row.courseCode === '703055001'),
    { checkedAt: new Date().toISOString() },
  );

  assert.equal(candidate.syllabus.status, 'available');
  assert.match(candidate.syllabus.url, /^https:\/\/newdoc\.nccu\.edu\.tw\//);
});

test('live NCCU HCI syllabus exposes readable official course content', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '703055001' });
  const course = rows.find((row) => row.courseCode === '703055001');
  const syllabus = await fetchOfficialSyllabus({ url: course.sourceUrl });

  assert.match(syllabus.text, /人機互動/);
  assert.match(syllabus.text, /課程簡介/);
});

test('live NCCU expanded-minor note stays informational', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '010056001' });
  const candidate = nccuCourseToCandidate(
    rows.find((row) => row.courseCode === '010056001'),
  );

  assert.equal(candidate.schedule.label, '四34');
  assert.deepEqual(candidate.eligibilityRules, []);
  assert.ok(candidate.conditions.includes('日文系擴大輔系課程'));
});

test('live NCCU exclusive audience note becomes one required condition', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '088F54011' });
  const candidate = nccuCourseToCandidate(
    rows.find((row) => row.courseCode === '088F54011'),
  );

  assert.deepEqual(candidate.eligibilityRules, [{
    conditionId: 'official-restriction:088F54011',
    conditionLabel: '我是外籍交換生或外籍學位生',
    conditionDescription: '政大官方限制：僅供外籍交換生與外籍學位生修習',
    enforcement: 'required',
    rationale: '僅供外籍交換生與外籍學位生修習',
    source: 'nccu-official',
    confidence: 'high',
  }]);
  assert.ok(candidate.informationNotes.includes('外籍學位生修此課學分不予以採計'));
});

test('live comparison prompt route reads two official NCCU syllabi end to end', { timeout: 30_000 }, async () => {
  const [hciRows, aiRows] = await Promise.all([
    searchNccuCourses({ term: '115-1', keyword: '703055001' }),
    searchNccuCourses({ term: '115-1', keyword: '070423001' }),
  ]);
  const hci = hciRows.find((row) => row.courseCode === '703055001');
  const ai = aiRows.find((row) => row.courseCode === '070423001');
  const worker = createWorker({ html: '<h1>contract</h1>' });
  const response = await worker.fetch(new Request('http://local/api/course-comparison/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      semesterGoals: '了解 AI 產品與使用者研究',
      courses: [
        { id: hci.courseCode, title: hci.title, teacher: hci.teacher, credits: hci.credits, syllabusUrl: hci.sourceUrl },
        { id: ai.courseCode, title: ai.title, teacher: ai.teacher, credits: ai.credits, syllabusUrl: ai.sourceUrl },
      ],
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.profileMode, 'personalized');
  assert.equal(payload.sources.filter(({ status }) => status === 'available').length, 2);
  assert.match(payload.prompt, /人機互動/);
  assert.match(payload.prompt, /人工智慧導論/);
  assert.match(payload.prompt, /學期目標：了解 AI 產品與使用者研究/);
});
