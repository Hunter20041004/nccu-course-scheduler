import test from 'node:test';
import assert from 'node:assert/strict';
import { importCoursesFromScreenshot, recommendCoursePlans } from '../src/ai-service.mjs';

const imageDataUrl = 'data:image/png;base64,QQ==';
const validImport = { imageDataUrl, term: '115-1' };
const recognizedUnknown = JSON.stringify({ recognizedCourses: [{
  courseCode: '', title: '未知課程', teacher: '老師', confidence: 0.8,
}] });
const officialA = { courseCode: '123456001', title: '未知課程', teacher: '老師', credits: 3, scheduleText: '一234', available: true };
const officialB = { ...officialA, courseCode: '123456002' };

test('matches recognized course codes against the verified built-in catalog', async () => {
  let officialCalls = 0;
  const result = await importCoursesFromScreenshot(
    { imageDataUrl, term: '115-1' },
    {
      apiKey: 'test-only',
      catalog: [{ id: 'hci', sectionCode: '703055001', title: '人機互動', available: true }],
      groqRequest: async () => JSON.stringify({ recognizedCourses: [{
        courseCode: '703055001', title: '人機互動', confidence: 0.99,
      }] }),
      nccuSearch: async () => { officialCalls += 1; return []; },
    },
  );
  assert.deepEqual(result.importedCourses.map(({ id }) => id), ['hci']);
  assert.equal(officialCalls, 0);
});

test('returns ambiguous official matches as pending instead of importing them', async () => {
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => recognizedUnknown,
    nccuSearch: async () => [officialA, officialB],
  });
  assert.equal(result.importedCourses.length, 0);
  assert.equal(result.pendingCourses[0].reason, '找到多筆官方課程，請確認班別。');
});

test('uses a recognized course code to disambiguate same-title official courses', async () => {
  const recognizedCourse = JSON.stringify({ recognizedCourses: [{
    courseCode: '781063001', title: '遊戲引擎應用開發', teacher: '周大鈞', confidence: 0.99,
  }] });
  const sameTitleCourses = [
    { courseCode: '462889001', title: '遊戲引擎應用開發', teacher: '周大鈞', credits: 3, scheduleText: '四EFG', available: true },
    { courseCode: '781063001', title: '遊戲引擎應用開發', teacher: '周大鈞', credits: 3, scheduleText: '四EFG', available: true },
  ];
  let searches = 0;

  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => recognizedCourse,
    nccuSearch: async () => {
      searches += 1;
      return searches === 1 ? [] : sameTitleCourses;
    },
  });

  assert.equal(result.pendingCourses.length, 0);
  assert.deepEqual(result.importedCourses.map((course) => course.sectionCode), ['781063001']);
});

test('retries screenshot recognition once when the JSON shape is invalid', async () => {
  let calls = 0;
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => {
      calls += 1;
      return calls === 1 ? '{"courses":[]}' : '{"recognizedCourses":[]}';
    },
    nccuSearch: async () => [],
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.importedCourses, []);
});

test('excludes blocked and unavailable courses from recommendation prompts', async () => {
  let promptedCourseIds;
  let recommendationReasoningEffort;
  const eligibleCourse = { id: 'eligible', title: '合格課', credits: 3, eligibility: 'eligible' };
  const blockedCourse = { id: 'blocked', title: '不合格課', credits: 3, eligibility: 'blocked' };
  const validThreePlans = JSON.stringify({ summary: '摘要', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['eligible'], attendance: '實體', tradeoffs: ['密集'] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['eligible', 'locked'], attendance: '混合', tradeoffs: ['較多課'] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['locked'], attendance: '彈性', tradeoffs: ['學分少'] },
  ] });
  await recommendCoursePlans({
    profileText: '大三', desiredActivities: '實習', futureDirection: 'AI', semesterGoals: '作品', preferences: '集中',
    internshipSettings: {}, selectedCourseIds: [], lockedCourseIds: ['locked'],
    courses: [eligibleCourse, blockedCourse, { id: 'locked', title: '鎖定課', credits: 2, eligibility: 'eligible' }],
  }, { apiKey: 'test-only', groqRequest: async ({ messages, reasoningEffort }) => {
    promptedCourseIds = JSON.parse(messages[1].content).courses.map(({ id }) => id);
    recommendationReasoningEffort = reasoningEffort;
    return validThreePlans;
  } });
  assert.deepEqual(promptedCourseIds, ['eligible', 'locked']);
  assert.equal(recommendationReasoningEffort, 'none');
});

test('retries recommendations once when the JSON shape is invalid', async () => {
  let calls = 0;
  const validPlans = JSON.stringify({ summary: '摘要', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['a'], attendance: '實體', tradeoffs: [] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['a', 'b'], attendance: '混合', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['b'], attendance: '彈性', tradeoffs: [] },
  ] });
  const result = await recommendCoursePlans({
    courses: [
      { id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible' },
      { id: 'b', title: '課程 B', credits: 3, eligibility: 'eligible' },
    ],
    lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
  }, {
    apiKey: 'test-only',
    groqRequest: async () => {
      calls += 1;
      return calls === 1 ? '{"plans":[]}' : validPlans;
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.plans.length, 3);
});

test('rejects a conflicting AI route and retries before returning recommendations', async () => {
  let calls = 0;
  const requests = [];
  const plan = (id, courseIds) => ({
    id, title: id, reason: id, courseIds, attendance: '實體', tradeoffs: [],
  });
  const conflicting = JSON.stringify({ summary: '第一次', plans: [
    plan('focus', ['a', 'b']), plan('balance', ['a', 'c']), plan('explore', ['c']),
  ] });
  const conflictFree = JSON.stringify({ summary: '第二次', plans: [
    plan('focus', ['a']), plan('balance', ['b', 'c']), plan('explore', ['c']),
  ] });
  const courses = [
    { id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible', schedule: { day: 1, start: 610, end: 780 } },
    { id: 'b', title: '課程 B', credits: 3, eligibility: 'eligible', schedule: { day: 1, start: 700, end: 870 } },
    { id: 'c', title: '課程 C', credits: 3, eligibility: 'eligible', schedule: { day: 2, start: 610, end: 780 } },
  ];

  const result = await recommendCoursePlans({
    courses, lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
  }, {
    apiKey: 'test-only',
    groqRequest: async (request) => {
      calls += 1;
      requests.push(request);
      return calls === 1 ? conflicting : conflictFree;
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.summary, '第二次');
  assert.match(requests[1].messages.at(-1).content, /上一個回覆未通過驗證.*衝堂/);
  assert.match(requests[1].messages.at(-1).content, /課程 A 與 課程 B 每週時段重疊/);
});

test('accepts an overlapping route only when an async-capable course is explicitly asynchronous', async () => {
  let calls = 0;
  const response = JSON.stringify({ summary: '混合安排', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['a', 'b'], asyncCourseIds: ['b'], attendance: '混合', tradeoffs: [] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['a', 'c'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['b', 'c'], asyncCourseIds: ['b'], attendance: '混合', tradeoffs: [] },
  ] });
  const courses = [
    { id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible', schedule: { day: 1, start: 610, end: 780 } },
    { id: 'b', title: '課程 B', credits: 3, eligibility: 'eligible', asyncAllowed: true, schedule: { day: 1, start: 700, end: 870 } },
    { id: 'c', title: '課程 C', credits: 3, eligibility: 'eligible', schedule: { day: 2, start: 610, end: 780 } },
  ];

  const result = await recommendCoursePlans({
    courses, lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
  }, { apiKey: 'test-only', groqRequest: async () => { calls += 1; return response; } });

  assert.equal(calls, 1);
  assert.deepEqual(result.plans[0].asyncCourseIds, ['b']);
});

test('allows a locked async course to be named outside each plan course list', async () => {
  const response = JSON.stringify({ summary: '保留鎖定課', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['a'], asyncCourseIds: ['locked'], attendance: '混合', tradeoffs: [] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['b'], asyncCourseIds: ['locked'], attendance: '混合', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['c'], asyncCourseIds: ['locked'], attendance: '混合', tradeoffs: [] },
  ] });
  const courses = [
    { id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible' },
    { id: 'b', title: '課程 B', credits: 3, eligibility: 'eligible' },
    { id: 'c', title: '課程 C', credits: 3, eligibility: 'eligible' },
    { id: 'locked', title: '鎖定非同步課', credits: 3, eligibility: 'eligible', asyncAllowed: true },
  ];

  const result = await recommendCoursePlans({
    courses, lockedCourseIds: ['locked'], selectedCourseIds: ['locked'], internshipSettings: {},
  }, { apiKey: 'test-only', groqRequest: async () => response });

  assert.deepEqual(result.plans[0].asyncCourseIds, ['locked']);
});

test('ignores asynchronous metadata for courses outside a route', async () => {
  const response = JSON.stringify({ summary: '忽略無效註記', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['a'], asyncCourseIds: ['outside'], attendance: '實體', tradeoffs: [] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['b'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['c'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
  ] });
  const courses = ['a', 'b', 'c', 'outside'].map((id) => ({
    id, title: `課程 ${id}`, credits: 3, eligibility: 'eligible', asyncAllowed: id === 'outside',
  }));

  const result = await recommendCoursePlans({
    courses, lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
  }, { apiKey: 'test-only', groqRequest: async () => response });

  assert.deepEqual(result.plans[0].asyncCourseIds, []);
});
