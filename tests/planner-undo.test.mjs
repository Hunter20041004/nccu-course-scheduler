import test from 'node:test';
import assert from 'node:assert/strict';

import { createPlannerUndo } from '../src/planner-undo.mjs';

test('restores one recent safe planner snapshot and expires it after fifteen seconds', () => {
  let now = 1_000;
  const undo = createPlannerUndo({ now: () => now, ttlMs: 15_000 });
  const state = {
    selectedIds: ['course-a'],
    lockedCourseIds: ['course-a'],
    apiKey: 'must-not-survive',
    profileText: 'private AI prompt',
  };

  undo.capture(state, '已清空目前課表');
  assert.deepEqual(undo.peek(), {
    available: true,
    label: '已清空目前課表',
    remainingMs: 15_000,
  });
  assert.deepEqual(undo.restore(), {
    selectedIds: ['course-a'],
    lockedCourseIds: ['course-a'],
  });
  assert.equal(undo.restore(), null);

  undo.capture(state, '已刪除課程');
  now += 15_001;
  assert.deepEqual(undo.peek(), { available: false });
  assert.equal(undo.restore(), null);
});
