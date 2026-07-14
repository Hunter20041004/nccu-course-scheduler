import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRecommendedPlan, mergeImportedCourses, validateScreenshotFile } from '../src/ai-planner.mjs';

test('merges verified imports without duplicating existing course ids', () => {
  const hci = { id: 'hci', title: '人機互動' };
  const ai = { id: 'ai-123', title: '新課' };
  assert.deepEqual(mergeImportedCourses([hci], [hci, ai]), {
    courseStore: [hci, ai], duplicateIds: ['hci'],
  });
});

test('applies a recommendation while preserving every locked selected course', () => {
  const profile = { level: 'undergrad', year: 3, programs: [], prerequisites: [] };
  const catalog = [
    { id: 'locked', title: '鎖定課', available: true },
    { id: 'recommended', title: '推薦課', available: true },
  ];
  const result = applyRecommendedPlan(
    { courseIds: ['recommended'] }, catalog,
    [{ ...catalog[0], attendance: 'physical' }], ['locked'], profile,
  );
  assert.deepEqual(result.map(({ id }) => id), ['recommended', 'locked']);
});
