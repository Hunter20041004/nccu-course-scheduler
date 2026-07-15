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

test('preserves explicit per-course asynchronous attendance in recommendation plans', () => {
  const content = JSON.stringify({ summary: '摘要', plans: [
    { id: 'a', title: 'A', reason: 'A', courseIds: ['physical', 'async'], asyncCourseIds: ['async'], attendance: '混合', tradeoffs: [] },
    { id: 'b', title: 'B', reason: 'B', courseIds: ['physical'], asyncCourseIds: [], attendance: '實體', tradeoffs: [] },
    { id: 'c', title: 'C', reason: 'C', courseIds: ['async'], asyncCourseIds: ['async'], attendance: '非同步', tradeoffs: [] },
  ] });

  const result = parseRecommendedPlans(content, new Set(['physical', 'async']));

  assert.deepEqual(result.plans[0].asyncCourseIds, ['async']);
});

test('preserves one-time course events needed for recommendation conflict checks', () => {
  const event = { label: '實體期末考', date: '2026-12-23', day: 3, start: 550, end: 730 };

  const result = validateRecommendationRequest({
    courses: [{ id: 'fintech', title: '金融科技導論', credits: 3, events: [event] }],
    selectedCourseIds: [], lockedCourseIds: [], internshipSettings: {},
  });

  assert.deepEqual(result.courses[0].events, [event]);
});

test('repairs a uniquely identifiable two-character course id typo', () => {
  const content = JSON.stringify({ summary: '摘要', plans: [
    { id: 'focus', title: '集中', reason: '集中', courseIds: ['social-mineding'], attendance: '實體', tradeoffs: [] },
    { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['a'], attendance: '實體', tradeoffs: [] },
    { id: 'explore', title: '探索', reason: '探索', courseIds: ['b'], attendance: '實體', tradeoffs: [] },
  ] });

  const result = parseRecommendedPlans(content, new Set(['social-mining', 'a', 'b']));

  assert.deepEqual(result.plans[0].courseIds, ['social-mining']);
});
