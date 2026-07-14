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
