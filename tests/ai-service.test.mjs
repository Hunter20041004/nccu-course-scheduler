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

test('disables model reasoning for screenshot recognition', async () => {
  let reasoningEffort;
  await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async (request) => {
      reasoningEffort = request.reasoningEffort;
      return '{"recognizedCourses":[]}';
    },
    nccuSearch: async () => [],
  });

  assert.equal(reasoningEffort, 'none');
});

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

test('recovers an exact course code when OCR inserts a character into the title', async () => {
  const queries = [];
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => JSON.stringify({ recognizedCourses: [{
      courseCode: '651171001', title: '日文法律學名著選讀', teacher: '張韻琪', confidence: 0.99,
    }] }),
    nccuSearch: async ({ keyword }) => {
      queries.push(keyword);
      return keyword === '日文法' ? [{
        courseCode: '651171001', title: '日文法學名著選讀（二）', teacher: '張韻琪', credits: 3,
        scheduleText: '五567', available: true,
      }] : [];
    },
  });

  assert.deepEqual(queries, ['651171001', '日文法律學名著選讀', '日文法']);
  assert.deepEqual(result.importedCourses.map((course) => [course.sectionCode, course.title]), [
    ['651171001', '日文法學名著選讀（二）'],
  ]);
});

test('turns an official enrollment restriction into a required selectable condition', async () => {
  const recognizedCourse = JSON.stringify({ recognizedCourses: [{
    courseCode: '509041001', title: '德國文學概論', teacher: '蔡莫妮', confidence: 0.99,
  }] });
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [], groqRequest: async () => recognizedCourse,
    nccuSearch: async () => [{
      courseCode: '509041001', title: '德國文學概論', teacher: '蔡莫妮', credits: 2,
      scheduleText: '四78', available: true,
      restrictionText: '僅限歐文系及雙主修學生修讀。',
    }],
  });

  assert.deepEqual(result.importedCourses[0].eligibilityRules, [{
    conditionId: 'official-restriction:509041001',
    conditionLabel: '我是歐文系或雙主修學生',
    conditionDescription: '政大官方備註：僅限歐文系及雙主修學生修讀。',
    enforcement: 'required',
    rationale: '僅限歐文系及雙主修學生修讀。',
  }]);
});

test('creates a selectable condition from a department limit without 修讀 wording', async () => {
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => JSON.stringify({ recognizedCourses: [{
      courseCode: '123456001', title: '系所限制課程', teacher: '老師', confidence: 0.99,
    }] }),
    nccuSearch: async () => [{
      courseCode: '123456001', title: '系所限制課程', teacher: '老師', credits: 3,
      scheduleText: '二234', available: true, restrictionText: '限本系學生',
    }],
  });

  assert.equal(result.importedCourses[0].eligibilityRules[0].conditionLabel, '我符合：限本系學生');
  assert.equal(result.importedCourses[0].eligibilityRules[0].enforcement, 'required');
});

test('summarizes alternative language prerequisites as one selectable condition', async () => {
  const restrictionText = '須先修習學士班日文（一）、（二）其中一門，或曾在大學修習日文語文 4 學分以上，或通過日本語能力試驗 N3 以上，或 FLPT 日語能力測驗筆試 150 分以上，始得修習本課程。';
  const result = await importCoursesFromScreenshot(validImport, {
    apiKey: 'test-only', catalog: [],
    groqRequest: async () => JSON.stringify({ recognizedCourses: [{
      courseCode: '651171001', title: '日文法學名著選讀（二）', teacher: '張韻琪', confidence: 0.99,
    }] }),
    nccuSearch: async () => [{
      courseCode: '651171001', title: '日文法學名著選讀（二）', teacher: '張韻琪', credits: 3,
      scheduleText: '五567', available: true, restrictionText,
    }],
  });

  assert.deepEqual(result.importedCourses[0].eligibilityRules[0], {
    conditionId: 'official-restriction:651171001',
    conditionLabel: '我符合本課程任一項日文先修資格',
    conditionDescription: `政大官方備註：${restrictionText}`,
    enforcement: 'required',
    rationale: restrictionText,
  });
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
  let recommendationMaxCompletionTokens;
  let recommendationRetriesJsonValidation;
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
  }, { apiKey: 'test-only', groqRequest: async ({ messages, reasoningEffort, maxCompletionTokens, retryJsonValidation }) => {
    promptedCourseIds = JSON.parse(messages[1].content).courses.map(({ id }) => id);
    recommendationReasoningEffort = reasoningEffort;
    recommendationMaxCompletionTokens = maxCompletionTokens;
    recommendationRetriesJsonValidation = retryJsonValidation;
    return validThreePlans;
  } });
  assert.deepEqual(promptedCourseIds, ['eligible', 'locked']);
  assert.equal(recommendationReasoningEffort, 'none');
  assert.equal(recommendationMaxCompletionTokens, 2_200);
  assert.equal(recommendationRetriesJsonValidation, false);
});

test('does not resend the full recommendation payload when the JSON shape is invalid', async () => {
  let calls = 0;
  await assert.rejects(() => recommendCoursePlans({
    courses: [{ id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible' }],
    lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
  }, { apiKey: 'test-only', groqRequest: async () => {
    calls += 1;
    return '{"plans":[]}';
  } }), { code: 'INVALID_AI_RESPONSE' });
  assert.equal(calls, 1);
});

test('repairs a conflicting AI route locally without spending a second Groq request', async () => {
  let calls = 0;
  const plan = (id, courseIds) => ({
    id, title: id, reason: id, courseIds, attendance: '實體', tradeoffs: [],
  });
  const conflicting = JSON.stringify({ summary: '第一次', plans: [
    plan('focus', ['a', 'b']), plan('balance', ['a', 'c']), plan('explore', ['c']),
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
    groqRequest: async () => {
      calls += 1;
      return conflicting;
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.summary, '第一次');
  assert.deepEqual(result.plans[0].courseIds, ['a']);
  assert.match(result.plans[0].tradeoffs.join(''), /已移除衝堂課程：課程 B/);
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

test('treats maximum credits as an explicit objective and orders routes by total credits', async () => {
  let systemPrompt = '';
  const response = JSON.stringify({ summary: '依學分排序', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['a'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'balance', title: '高學分', reason: '高學分', courseIds: ['a', 'b'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['c'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
  ] });
  const courses = [
    { id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible' },
    { id: 'b', title: '課程 B', credits: 3, eligibility: 'eligible' },
    { id: 'c', title: '課程 C', credits: 2, eligibility: 'eligible' },
  ];

  const result = await recommendCoursePlans({
    courses, lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
    preferences: '集中週二週四，學分越多越好',
  }, { apiKey: 'test-only', groqRequest: async ({ messages }) => {
    systemPrompt = messages[0].content;
    return response;
  } });

  assert.match(systemPrompt, /最高總學分/);
  assert.match(systemPrompt, /summary 60 字內/);
  assert.deepEqual(result.plans[0].courseIds, ['a', 'b', 'c']);
  assert.deepEqual(result.plans.map((plan) => plan.id), ['focus', 'balance', 'explore']);
});

test('builds a deterministic maximum-credit route when the model omits compatible courses', async () => {
  const response = JSON.stringify({ summary: '模型漏選課程', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['a'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['c'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['d'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
  ] });
  const courses = [
    { id: 'a', title: '低學分衝堂課', credits: 3, eligibility: 'eligible', schedule: { day: 1, start: 610, end: 780 } },
    { id: 'b', title: '高學分衝堂課', credits: 5, eligibility: 'eligible', schedule: { day: 1, start: 700, end: 870 } },
    { id: 'c', title: '週二課程', credits: 4, eligibility: 'eligible', schedule: { day: 2, start: 610, end: 780 } },
    { id: 'd', title: '週三課程', credits: 2, eligibility: 'eligible', schedule: { day: 3, start: 610, end: 780 } },
  ];

  const result = await recommendCoursePlans({
    courses, lockedCourseIds: [], selectedCourseIds: [], internshipSettings: {},
    preferences: '集中週二週四，學分越多越好',
  }, { apiKey: 'test-only', groqRequest: async () => response });

  assert.deepEqual(result.plans[0].courseIds, ['b', 'c', 'd']);
  assert.match(result.plans[0].reason, /系統已在不衝堂前提下補齊最高學分組合/);
});
