import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/planner-core.mjs';

const profile = {
  level: 'undergrad',
  year: 3,
  programs: ['innovation'],
  prerequisites: [],
};

test('marks a program-only junior course eligible for a matching year-three student', () => {
  assert.equal(typeof core.evaluateEligibility, 'function');
  assert.deepEqual(
    core.evaluateEligibility({ minYear: 3, programs: ['innovation'] }, profile),
    { status: 'eligible', reasons: [] },
  );
});

test('marks a graduate course that opens to juniors as conditional for an undergraduate', () => {
  assert.deepEqual(
    core.evaluateEligibility({ level: 'graduate', openToUndergradYear: 3 }, profile),
    { status: 'conditional', reasons: ['碩士班課程，課綱開放大三以上，需確認學分認列'] },
  );
});

test('marks a graduate course requiring undergraduate review as conditional', () => {
  assert.deepEqual(
    core.evaluateEligibility({ level: 'graduate', undergradReview: true }, profile),
    { status: 'conditional', reasons: ['碩士班課程，學士生須確認選課資格與學分認列'] },
  );
});

test('marks a course with no current section unavailable', () => {
  assert.deepEqual(
    core.evaluateEligibility({ available: false }, profile),
    { status: 'unavailable', reasons: ['115-1 查無開課資料'] },
  );
});

test('blocks a course when its prerequisite is missing', () => {
  assert.deepEqual(
    core.evaluateEligibility({ prerequisites: ['statistics'] }, profile),
    { status: 'blocked', reasons: ['缺少先修：statistics'] },
  );
});

test('blocks a graduate-only course for an undergraduate', () => {
  assert.deepEqual(
    core.evaluateEligibility({ level: 'graduate' }, profile),
    { status: 'blocked', reasons: ['僅限碩、博士班'] },
  );
});

test('reports a weekly conflict when two selected physical courses overlap', () => {
  const selected = [
    { id: 'agentic', title: 'Agentic AI', schedule: { day: 4, start: 790, end: 960 }, attendance: 'physical' },
    { id: 'ai-tools', title: '人工智慧方法與工具', schedule: { day: 4, start: 790, end: 960 }, attendance: 'physical' },
  ];

  assert.deepEqual(core.findConflicts(selected), [
    {
      type: 'weekly',
      courseIds: ['agentic', 'ai-tools'],
      message: 'Agentic AI 與 人工智慧方法與工具 每週時段重疊',
    },
  ]);
});

test('reports a conflict from any meeting of a multi-meeting course', () => {
  const selected = [
    {
      id: 'studio', title: '跨時段專題', attendance: 'physical',
      meetings: [
        { day: 2, start: 550, end: 720 },
        { day: 4, start: 790, end: 960 },
      ],
    },
    { id: 'agentic', title: 'Agentic AI', attendance: 'physical', schedule: { day: 4, start: 790, end: 960 } },
  ];

  assert.deepEqual(core.findConflicts(selected), [{
    type: 'weekly',
    courseIds: ['studio', 'agentic'],
    message: '跨時段專題 與 Agentic AI 每週時段重疊',
  }]);
});

test('does not reserve the weekly slot when an allowed remote course is taken asynchronously', () => {
  const selected = [
    { id: 'agentic', title: 'Agentic AI', schedule: { day: 4, start: 790, end: 960 }, attendance: 'physical' },
    { id: 'ai-intro', title: '人工智慧導論', schedule: { day: 4, start: 790, end: 960 }, attendance: 'async' },
  ];

  assert.deepEqual(core.findConflicts(selected), []);
});

test('keeps a synchronous exam as a hard conflict for an asynchronously attended course', () => {
  const selected = [
    { id: 'agentic', title: 'Agentic AI', schedule: { day: 4, start: 790, end: 960 }, attendance: 'physical' },
    {
      id: 'ai-intro',
      title: '人工智慧導論',
      schedule: { day: 4, start: 790, end: 960 },
      attendance: 'async',
      events: [{ label: '實體考試', date: '2026-12-10', day: 4, start: 790, end: 960 }],
    },
  ];

  assert.deepEqual(core.findConflicts(selected), [
    {
      type: 'event',
      courseIds: ['ai-intro', 'agentic'],
      message: '人工智慧導論的實體考試與 Agentic AI 時段重疊',
    },
  ]);
});

test('counts two full internship days and two free half-days for the concentrated plan', () => {
  const selected = [
    { id: 'ml', schedule: { day: 1, start: 790, end: 960 }, attendance: 'physical' },
    { id: 'social', schedule: { day: 1, start: 970, end: 1140 }, attendance: 'physical' },
    { id: 'hci', schedule: { day: 4, start: 550, end: 720 }, attendance: 'physical' },
    { id: 'agentic', schedule: { day: 4, start: 790, end: 960 }, attendance: 'physical' },
    { id: 'creative', schedule: { day: 4, start: 1090, end: 1260 }, attendance: 'physical' },
    { id: 'salon', schedule: { day: 5, start: 790, end: 960 }, attendance: 'physical' },
  ];

  assert.deepEqual(core.calculateInternshipAvailability(selected), {
    fullDays: [2, 3],
    halfDays: [1, 5],
    equivalentDays: 3,
    meetsTarget: true,
  });
});

test('clears selected items, locks, and course options in one action', () => {
  assert.deepEqual(core.clearPlannerSelection(), {
    selected: [],
    lockedCourseIds: [],
    courseOptions: {},
  });
});

test('removes an unlocked required course from the selection', () => {
  const required = { id: 'agentic', title: 'Agentic AI', required: true };
  assert.deepEqual(core.toggleCourse([required], required, []), []);
});

test('adds an available optional course to the selection', () => {
  const optional = { id: 'hci', title: '人機互動', asyncAllowed: false };
  assert.deepEqual(core.toggleCourse([], optional), [{ ...optional, attendance: 'physical' }]);
});

test('removes a selected optional course', () => {
  const optional = { id: 'hci', title: '人機互動', required: false };
  assert.deepEqual(core.toggleCourse([{ ...optional, attendance: 'physical' }], optional), []);
});

test('builds the concentrated preset from required and tagged courses', () => {
  const courses = [
    { id: 'agentic', required: true, credits: 3 },
    { id: 'salon', required: true, credits: 2 },
    { id: 'creative', required: true, credits: 3 },
    { id: 'ml', presets: ['concentrated'], credits: 3 },
    { id: 'social', presets: ['concentrated'], credits: 3 },
    { id: 'hci', presets: ['concentrated'], credits: 3 },
    { id: 'visualization', presets: ['balanced'], credits: 3 },
  ];

  assert.deepEqual(
    core.applyPreset(courses, 'concentrated').map(({ id, attendance }) => ({ id, attendance })),
    [
      { id: 'agentic', attendance: 'physical' },
      { id: 'salon', attendance: 'physical' },
      { id: 'creative', attendance: 'physical' },
      { id: 'ml', attendance: 'physical' },
      { id: 'social', attendance: 'physical' },
      { id: 'hci', attendance: 'physical' },
    ],
  );
});

test('applies asynchronous attendance configured by a preset', () => {
  const course = {
    id: 'smart-hci',
    presets: ['async-first'],
    presetAttendance: { 'async-first': 'async' },
  };
  assert.equal(core.applyPreset([course], 'async-first')[0].attendance, 'async');
});

test('normalizes a manually entered physical course into a schedulable block', () => {
  assert.deepEqual(
    core.createManualCourse({
      title: '使用者新增課程',
      credits: '2',
      day: '2',
      start: '09:10',
      end: '12:00',
      mode: 'physical',
    }, 7),
    {
      id: 'manual-7',
      title: '使用者新增課程',
      credits: 2,
      source: 'manual',
      attendance: 'physical',
      asyncAllowed: false,
      required: false,
      available: true,
      schedule: { day: 2, start: 550, end: 720, label: '週二 234' },
      conditions: ['手動新增，尚未查證官方資料'],
    },
  );
});

test('adds an eligible catalog course to the schedule', () => {
  const hci = { id: 'hci', title: '人機互動', available: true, required: false };
  assert.deepEqual(
    core.toggleSelectableCourse([], hci, profile),
    [{ ...hci, attendance: 'physical' }],
  );
});

test('adds a multi-option catalog course in a pending selection state', () => {
  const project = {
    id: 'ai-practical-project', title: '人工智慧實務專題', available: true,
    variants: [{ id: '070395001', advisors: [] }],
  };

  const [selectedProject] = core.toggleSelectableCourse([], project, profile);

  assert.equal(selectedProject.optionStatus, 'pending');
  assert.equal(selectedProject.optionMessage, '請選擇正式課號');
});

test('rejects a manual course whose end is not after its start', () => {
  assert.deepEqual(
    core.validateManualCourse({ title: '測試課', mode: 'physical', start: '12:00', end: '09:00' }),
    { field: 'end', message: '結束時間必須晚於開始時間。' },
  );
});

test('resolves the AI project advisor to the correct mutually exclusive meeting', () => {
  const course = {
    id: 'ai-practical-project',
    title: '人工智慧實務專題',
    variants: [{
      id: '070395001',
      sectionCode: '070395001',
      advisors: [
        {
          id: 'wu-chih-hsun',
          teacher: '吳致勳',
          schedule: { day: 2, start: 790, end: 960, label: '週二 D56' },
        },
        {
          id: 'wu-yi-chieh',
          teacher: '吳怡潔',
          schedule: { day: 3, start: 790, end: 960, label: '週三 D56' },
        },
      ],
    }],
  };

  const resolved = core.resolveCourseOption(course, {
    variantId: '070395001', advisorId: 'wu-chih-hsun',
  });

  assert.equal(resolved.teacher, '吳致勳');
  assert.equal(resolved.id, 'ai-practical-project');
  assert.equal(resolved.selectedVariantId, '070395001');
  assert.equal(resolved.schedule.label, '週二 D56');
  assert.equal(resolved.optionStatus, 'resolved');
});

test('keeps the selected section while waiting for an advisor choice', () => {
  const course = {
    id: 'ai-practical-project',
    variants: [{
      id: '070395001',
      sectionCode: '070395001',
      advisors: [{ id: 'advisor', teacher: '老師', schedule: null }],
    }],
  };

  const pending = core.resolveCourseOption(course, { variantId: '070395001' });

  assert.equal(pending.selectedVariantId, '070395001');
  assert.equal(pending.optionStatus, 'pending');
});

test('applies a course option without changing its credits or attendance', () => {
  const course = {
    id: 'ai-practical-project', credits: 3, attendance: 'physical',
    variants: [{ id: 'section', advisors: [{
      id: 'advisor', teacher: '老師', schedule: { day: 2, start: 790, end: 960 },
    }] }],
  };
  const [resolved] = core.applyCourseOption([course], course.id, {
    variantId: 'section', advisorId: 'advisor',
  });
  assert.equal(resolved.credits, 3);
  assert.equal(resolved.attendance, 'physical');
  assert.equal(resolved.teacher, '老師');
});

test('restores the official catalog by removing manually added courses', () => {
  const official = { id: 'official', source: 'nccu' };
  const manual = { id: 'manual-1', source: 'manual' };

  assert.deepEqual(core.restoreOfficialCatalog([official, manual]), [official]);
});

test('deletes an optional candidate from both the catalog and selected schedule', () => {
  const required = { id: 'required', required: true };
  const optional = { id: 'optional', required: false };

  assert.deepEqual(
    core.deleteCandidateCourse([required, optional], [required, optional], optional.id),
    { courseStore: [required], selected: [required], deleted: optional },
  );
});

test('refuses to delete one of the three fixed required courses', () => {
  const required = { id: 'required', required: true };

  assert.deepEqual(
    core.deleteCandidateCourse([required], [required], required.id),
    { courseStore: [required], selected: [required], deleted: null },
  );
});

test('rebuilds a saved catalog without deleted official candidates', () => {
  const official = [{ id: 'keep' }, { id: 'deleted' }];
  const manual = [{ id: 'manual-1', source: 'manual' }];

  assert.deepEqual(
    core.buildCandidateCatalog(official, manual, ['deleted']),
    [official[0], manual[0]],
  );
});
