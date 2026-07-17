import test from 'node:test';
import assert from 'node:assert/strict';
import { nccuCourseToCandidate, searchNccuCourses } from '../src/nccu-course-adapter.mjs';

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

test('live NCCU expanded-minor note stays informational', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '010056001' });
  const candidate = nccuCourseToCandidate(
    rows.find((row) => row.courseCode === '010056001'),
  );

  assert.equal(candidate.schedule.label, '四34');
  assert.deepEqual(candidate.eligibilityRules, []);
  assert.ok(candidate.conditions.includes('日文系擴大輔系課程'));
});
