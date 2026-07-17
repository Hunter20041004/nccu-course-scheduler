import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStartupCatalog,
  migratePlannerState,
  parsePlannerState,
  serializePlannerState,
} from '../src/planner-storage.mjs';

test('starts new visitors empty but rebuilds the legacy catalog for saved users', () => {
  const official = [{ id: 'hci', title: '人機互動' }];
  const manual = { id: 'manual-1', title: '社團', source: 'manual' };

  assert.deepEqual(createStartupCatalog(null, official), []);
  assert.deepEqual(
    createStartupCatalog({ addedCourses: [manual], deletedCourseIds: [] }, official),
    [official[0], manual],
  );
});

test('repairs informational official rules while restoring saved courses', () => {
  const saved = {
    addedCourses: [{
      id: 'ai-010056001',
      sectionCode: '010056001',
      conditions: ['日文系擴大輔系課程'],
      eligibilityRules: [{
        conditionId: 'official-restriction:010056001',
        enforcement: 'required',
        rationale: '日文系擴大輔系課程',
      }],
    }],
    deletedCourseIds: [],
  };

  const [restored] = createStartupCatalog(saved, []);
  assert.deepEqual(restored.eligibilityRules, []);
  assert.deepEqual(restored.conditions, ['日文系擴大輔系課程']);
});

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
      courseOptions: {
        'ai-practical-project': {
          sectionId: '070395001',
          advisorId: null,
          arrangementId: null,
        },
      },
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

test('uses storage version five for trusted course and eligibility data', () => {
  const state = {
    selectedIds: [],
    addedCourses: [{ id: 'ai-123' }],
    pendingCourses: [{ title: '待確認課' }],
  };
  assert.equal(JSON.parse(serializePlannerState(state)).version, 5);
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});

test('migrates legacy AI project variant choices into atomic section choices', () => {
  const state = {
    selectedIds: ['ai-practical-project'],
    lockedCourseIds: ['ai-practical-project'],
    courseOptions: {
      'ai-practical-project': {
        variantId: '783006001',
        advisorId: 'wei-flexible',
      },
    },
  };

  const migrated = parsePlannerState(JSON.stringify({ version: 4, state }), null);

  assert.deepEqual(migrated.courseOptions['ai-practical-project'], {
    sectionId: '783006001',
    advisorId: null,
    arrangementId: 'wei-flexible',
  });
  assert.deepEqual(migrated.selectedIds, ['ai-practical-project']);
  assert.deepEqual(migrated.lockedCourseIds, ['ai-practical-project']);
});

test('planner migration is idempotent', () => {
  const legacy = {
    selectedIds: ['ai-practical-project'],
    courseOptions: {
      'ai-practical-project': { variantId: '783006001', advisorId: 'wei-tuesday-34c' },
    },
  };

  const migrated = migratePlannerState(legacy);
  assert.deepEqual(migratePlannerState(migrated), migrated);
});

test('returns the fallback for corrupt or incompatible storage', () => {
  const fallback = { selectedIds: ['creative-intro'] };
  assert.equal(parsePlannerState('{bad json', fallback), fallback);
  assert.equal(parsePlannerState('{"version":1,"state":{}}', fallback), fallback);
});
