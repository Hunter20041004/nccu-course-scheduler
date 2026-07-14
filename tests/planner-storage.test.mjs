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

test('uses storage version three for imported and pending courses', () => {
  const state = {
    selectedIds: [],
    addedCourses: [{ id: 'ai-123' }],
    pendingCourses: [{ title: '待確認課' }],
  };
  assert.equal(JSON.parse(serializePlannerState(state)).version, 3);
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});

test('returns the fallback for corrupt or incompatible storage', () => {
  const fallback = { selectedIds: ['creative-intro'] };
  assert.equal(parsePlannerState('{bad json', fallback), fallback);
  assert.equal(parsePlannerState('{"version":1,"state":{}}', fallback), fallback);
});
