import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlannerState, serializePlannerState } from '../src/planner-storage.mjs';

test('migrates a complete version-three state to generalized condition ids without data loss', () => {
  const state = {
    selectedIds: ['agentic-ai'],
    attendance: { 'agentic-ai': 'physical' },
    courseOptions: { 'ai-practical-project': { variantId: '070395001' } },
    lockedCourseIds: ['agentic-ai'],
    internshipSettings: { targetDays: 2.5, start: '09:00', end: '18:00', mode: 'auto' },
    profile: {
      level: 'undergrad',
      year: 3,
      programs: ['innovation'],
      prerequisites: ['statistics'],
    },
    addedCourses: [{ id: 'manual-1', title: '社團' }],
    pendingCourses: [{ title: '待確認課' }],
    deletedCourseIds: ['removed-course'],
  };

  assert.deepEqual(
    parsePlannerState(JSON.stringify({ version: 3, state }), null),
    {
      ...state,
      profile: {
        ...state.profile,
        conditionIds: ['program:innovation', 'prerequisite:statistics'],
      },
    },
  );
});

test('round-trips versioned planner state', () => {
  const state = {
    selectedIds: ['agentic-ai'],
    attendance: {},
    profile: { year: 3 },
    manualCourses: [],
  };
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});

test('uses storage version four for imported and pending courses', () => {
  const state = {
    selectedIds: [],
    addedCourses: [{ id: 'ai-123' }],
    pendingCourses: [{ title: '待確認課' }],
  };
  assert.equal(JSON.parse(serializePlannerState(state)).version, 4);
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});

test('returns the fallback for corrupt or incompatible storage', () => {
  const fallback = { selectedIds: ['creative-intro'] };
  assert.equal(parsePlannerState('{bad json', fallback), fallback);
  assert.equal(parsePlannerState('{"version":1,"state":{}}', fallback), fallback);
});
