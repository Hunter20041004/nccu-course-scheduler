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
