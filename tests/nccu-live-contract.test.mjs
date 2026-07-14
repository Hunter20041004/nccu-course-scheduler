import test from 'node:test';
import assert from 'node:assert/strict';
import { searchNccuCourses } from '../src/nccu-course-adapter.mjs';

test('live NCCU endpoint exposes the fields used by the adapter', { timeout: 20_000 }, async () => {
  const rows = await searchNccuCourses({ term: '115-1', keyword: '遊戲引擎應用開發' });
  assert.ok(rows.some((row) => row.courseCode === '781063001' && row.title === '遊戲引擎應用開發'));
  assert.ok(rows.every((row) => /^\w{9}$/.test(row.courseCode)));
  assert.ok(rows.every((row) => row.title && Number.isFinite(row.credits)));
});
