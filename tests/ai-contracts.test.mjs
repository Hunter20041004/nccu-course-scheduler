import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRecognizedCourses,
  parseRecommendedPlans,
  validateImportRequest,
  validateRecommendationRequest,
} from '../src/ai-contracts.mjs';

test('rejects non-image import data URLs', () => {
  assert.throws(
    () => validateImportRequest({ imageDataUrl: 'data:text/plain;base64,QQ==', term: '115-1' }),
    { name: 'ContractError', message: '只接受 PNG、JPEG 或 WebP 截圖。' },
  );
});

test('parses recognized courses into a bounded normalized shape', () => {
  const result = parseRecognizedCourses(JSON.stringify({ recognizedCourses: [{
    courseCode: ' 703055001 ', title: ' 人機互動 ', teacher: '廖文宏', credits: 3,
    scheduleText: '四234', confidence: 0.97,
  }] }));
  assert.deepEqual(result.recognizedCourses[0], {
    courseCode: '703055001', title: '人機互動', teacher: '廖文宏',
    credits: 3, scheduleText: '四234', confidence: 0.97,
  });
});

test('rejects recommendation plans with hallucinated course ids', () => {
  const content = JSON.stringify({ summary: '摘要', plans: [
    { id: 'a', title: 'A', reason: 'A', courseIds: ['known'], attendance: '', tradeoffs: [] },
    { id: 'b', title: 'B', reason: 'B', courseIds: ['invented'], attendance: '', tradeoffs: [] },
    { id: 'c', title: 'C', reason: 'C', courseIds: ['known'], attendance: '', tradeoffs: [] },
  ] });
  assert.throws(() => parseRecommendedPlans(content, new Set(['known'])), /未知課程/);
});
