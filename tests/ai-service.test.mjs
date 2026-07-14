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
