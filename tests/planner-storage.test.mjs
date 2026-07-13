import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlannerState, serializePlannerState } from '../src/planner-storage.mjs';

test('round-trips versioned planner state', () => {
  const state = {
    selectedIds: ['agentic-ai'],
    attendance: {},
    profile: { year: 3 },
    manualCourses: [],
  };
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});

test('returns the fallback for corrupt or incompatible storage', () => {
  const fallback = { selectedIds: ['creative-intro'] };
  assert.equal(parsePlannerState('{bad json', fallback), fallback);
  assert.equal(parsePlannerState('{"version":2}', fallback), fallback);
});
