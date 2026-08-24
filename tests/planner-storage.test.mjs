import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStartupCatalog,
  migratePlannerState,
  parsePlannerState,
  persistedCourseAdditions,
  serializePlannerState,
} from '../src/planner-storage.mjs';
import { buildConditionDefinitions } from '../src/eligibility-conditions.mjs';
import { evaluateEligibility } from '../src/planner-core.mjs';

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

test('restores a previously saved blocked prerequisite as a reviewable condition', () => {
  const saved = {
    addedCourses: [{
      id: 'ai-303033011',
      title: '高級會計學（一）',
      sectionCode: '303033011',
      source: 'nccu-verified-import',
      conditions: ['由政大 115-1 公開課程資料匯入', '擋修中會(二)。'],
      eligibilityRules: [],
      informationNotes: ['擋修中會(二)'],
    }],
    deletedCourseIds: [],
  };

  const [restored] = createStartupCatalog(saved, []);
  const [condition] = buildConditionDefinitions([restored]);

  assert.equal(evaluateEligibility(restored, {
    conditionIds: [],
    rejectedConditionIds: [],
  }).status, 'review');
  assert.equal(condition.id, 'prerequisite-course:中會(二)');
  assert.equal(condition.label, '我修過中會(二)');
});

test('restores a previously saved exclusive audience restriction as a reviewable condition', () => {
  const saved = {
    addedCourses: [{
      id: 'ai-088E54011',
      title: '精進華語：中級一',
      sectionCode: '088E54011',
      source: 'nccu-verified-import',
      eligibilityRules: [],
      informationNotes: [
        '僅供外籍交換生與外籍學位生修習，外籍學位生修此課學分不予以採計',
        '第一堂課務必出席，否則將予以退選',
      ],
    }],
    deletedCourseIds: [],
  };

  const [restored] = createStartupCatalog(saved, []);
  const [condition] = buildConditionDefinitions([restored]);

  assert.equal(evaluateEligibility(restored, {
    conditionIds: [],
    rejectedConditionIds: [],
  }).status, 'review');
  assert.equal(condition.id, 'official-restriction:088E54011');
  assert.equal(condition.label, '我是外籍交換生或外籍學位生');
});

test('persists and restores a refreshed official seed course as one authoritative candidate', () => {
  const seed = {
    id: 'hci',
    title: '人機互動',
    sectionCode: '703055001',
    source: 'catalog',
  };
  const refreshed = {
    ...seed,
    source: 'nccu-verified-import',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/hci.html',
    syllabus: {
      status: 'available',
      url: 'https://newdoc.nccu.edu.tw/teaschm/1151/hci.html',
      checkedAt: '2026-07-17T12:00:00.000Z',
    },
  };

  const savedAdditions = persistedCourseAdditions([refreshed], [seed]);
  const restored = createStartupCatalog({
    addedCourses: savedAdditions,
    deletedCourseIds: [],
  }, [seed]);

  assert.deepEqual(savedAdditions, [refreshed]);
  assert.deepEqual(restored, [refreshed]);
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

test('uses storage version six for explicit syllabus state', () => {
  const state = {
    selectedIds: [],
    addedCourses: [{ id: 'ai-123' }],
    pendingCourses: [{ title: '待確認課' }],
  };
  assert.equal(JSON.parse(serializePlannerState(state)).version, 6);
  assert.deepEqual(parsePlannerState(serializePlannerState(state), null), state);
});

test('migrates a legacy official course without source evidence to unverified', () => {
  const stored = JSON.stringify({
    version: 5,
    state: {
      selectedIds: ['ai-703055001'],
      lockedCourseIds: ['ai-703055001'],
      attendance: { 'ai-703055001': 'async' },
      addedCourses: [{
        id: 'ai-703055001',
        sectionCode: '703055001',
        source: 'nccu-verified-import',
        sourceUrl: '',
      }],
    },
  });

  const migrated = parsePlannerState(stored, null);

  assert.equal(migrated.addedCourses[0].syllabus.status, 'unverified');
  assert.deepEqual(migrated.selectedIds, ['ai-703055001']);
  assert.deepEqual(migrated.lockedCourseIds, ['ai-703055001']);
  assert.equal(migrated.attendance['ai-703055001'], 'async');
});

test('migrates the saved remote course from a recurring slot to its one-time exam', () => {
  const stored = JSON.stringify({
    version: 6,
    state: {
      selectedIds: ['ai-701889001'],
      lockedCourseIds: ['ai-701889001'],
      attendance: { 'ai-701889001': 'physical' },
      addedCourses: [{
        id: 'ai-701889001',
        sectionCode: '701889001',
        title: '生成式 AI：文字與圖像生成的原理與實務',
        source: 'nccu-verified-import',
        sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
        userNote: '優先修',
        schedule: { day: 2, start: 970, end: 1140, label: '二78E' },
        meetings: [{ day: 2, start: 970, end: 1140, label: '二78E' }],
        asyncAllowed: false,
      }],
    },
  });

  const migrated = parsePlannerState(stored, null);
  const [course] = migrated.addedCourses;

  assert.equal(course.id, 'ai-701889001');
  assert.equal(course.userNote, '優先修');
  assert.equal(course.schedule, null);
  assert.deepEqual(course.meetings, []);
  assert.equal(course.attendance, 'async');
  assert.deepEqual(course.events, [{
    label: '第 11 週上機考',
    week: 11,
    day: 2,
    start: 970,
    end: 1140,
  }]);
  assert.equal(migrated.attendance['ai-701889001'], 'async');
  assert.deepEqual(migrated.selectedIds, ['ai-701889001']);
  assert.deepEqual(migrated.lockedCourseIds, ['ai-701889001']);
});

test('migrates legacy TAICA fintech to its verified asynchronous default', () => {
  const stored = JSON.stringify({
    version: 6,
    state: {
      selectedIds: ['ai-070424001'],
      attendance: { 'ai-070424001': 'physical' },
      addedCourses: [{
        id: 'ai-070424001', sectionCode: '070424001', title: '金融科技導論',
        source: 'nccu-verified-import',
        sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=070424&gop=00&s=1.html',
        schedule: null, meetings: [], asyncAllowed: false,
      }],
    },
  });

  const migrated = parsePlannerState(stored, null);
  const [course] = migrated.addedCourses;

  assert.equal(course.scheduleCorrectionId, 'nccu-1151-taica-070424001');
  assert.equal(course.attendance, 'async');
  assert.deepEqual(course.meetings, [{ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }]);
  assert.equal(migrated.attendance['ai-070424001'], 'async');
});

test('keeps a saved TAICA sync override and migration idempotent after correction', () => {
  const state = {
    selectedIds: ['ai-070424001'],
    attendance: { 'ai-070424001': 'sync' },
    addedCourses: [{
      id: 'ai-070424001', sectionCode: '070424001', title: '金融科技導論',
      source: 'nccu-verified-import',
      sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/schmPrv.jsp-yy=115&smt=1&num=070424&gop=00&s=1.html',
      attendance: 'sync', asyncAllowed: true,
      scheduleCorrectionId: 'nccu-1151-taica-070424001',
      schedule: { day: 3, start: 550, end: 730, label: '週三 09:10–12:10' },
      meetings: [{ day: 3, start: 550, end: 730, label: '週三 09:10–12:10' }],
    }],
  };

  const migrated = migratePlannerState(state);

  assert.equal(migrated.attendance['ai-070424001'], 'sync');
  assert.deepEqual(migrated.addedCourses[0].events, [{
    label: '實體期末考，時間待確認',
    date: '2026-12-23',
  }]);
  assert.deepEqual(migratePlannerState(migrated), migrated);
});

test('keeps a user attendance override once the one-time exam correction is already stored', () => {
  const state = {
    selectedIds: ['ai-701889001'],
    attendance: { 'ai-701889001': 'physical' },
    addedCourses: [{
      id: 'ai-701889001',
      sectionCode: '701889001',
      title: '生成式 AI：文字與圖像生成的原理與實務',
      source: 'nccu-verified-import',
      sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
      schedule: null,
      meetings: [],
      asyncAllowed: true,
      attendance: 'physical',
      scheduleCorrectionId: 'nccu-1151-701889001-one-time-exam',
    }],
  };

  const saved = JSON.parse(serializePlannerState(state)).state;

  assert.equal(saved.attendance['ai-701889001'], 'physical');
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
