import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatGptComparisonPrompt,
  parseCourseComparison,
  validateComparisonRequest,
} from '../src/course-comparison.mjs';

const course = (id, overrides = {}) => ({
  id,
  title: `課程 ${id}`,
  teacher: '老師',
  credits: 3,
  syllabusUrl: `https://newdoc.nccu.edu.tw/teaschm/${id}.html`,
  meetings: [{ day: 2, start: 550, end: 720, label: '二234' }],
  ...overrides,
});

test('builds an objective ChatGPT prompt when profile fields are empty', () => {
  const prompt = buildChatGptComparisonPrompt({
    courses: [
      { ...course('a'), syllabusText: '課程 A 課綱內容' },
      { ...course('b'), syllabusText: '課程 B 課綱內容' },
    ],
    profileText: '', futureDirection: '', semesterGoals: '', preferences: '',
  });

  assert.match(prompt, /請比較以下政大課程/);
  assert.match(prompt, /課程 A 課綱內容/);
  assert.match(prompt, /未提供個人目標，請只做客觀比較/);
});

test('includes only the provided optional profile fields in a personalized ChatGPT prompt', () => {
  const prompt = buildChatGptComparisonPrompt({
    courses: [
      { ...course('a'), syllabusText: '課程 A 課綱內容' },
      { ...course('b'), syllabusText: '課程 B 課綱內容' },
    ],
    profileText: '',
    futureDirection: 'AI 產品經理',
    semesterGoals: '完成作品集',
    preferences: '少考試',
  });

  assert.match(prompt, /未來方向：AI 產品經理/);
  assert.match(prompt, /學期目標：完成作品集/);
  assert.match(prompt, /排課偏好：少考試/);
  assert.doesNotMatch(prompt, /自我介紹：未提供/);
});

test('rejects comparison results that reference an unknown course id', () => {
  const payload = JSON.stringify({
    summary: '比較完成',
    overlap: { score: 50, level: '中度重疊', sharedTopics: ['AI'] },
    courses: [{ id: 'unknown', focus: 'AI', uniqueValue: '實作', assessment: '專題', workload: '中' }],
    recommendation: { courseIds: ['unknown'], reason: '較適合', confidence: 'medium' },
    personalized: { used: false, reason: '' },
    limitations: [],
  });

  assert.throws(() => parseCourseComparison(payload, new Set(['a', 'b'])), {
    code: 'INVALID_AI_RESPONSE',
  });
});

test('rejects comparison results with an overlap score outside zero to one hundred', () => {
  const payload = JSON.stringify({
    summary: '比較完成',
    overlap: { score: 140, level: '高度重疊', sharedTopics: ['AI'] },
    courses: [
      { id: 'a', focus: 'AI', uniqueValue: '實作', assessment: '專題', workload: '中' },
      { id: 'b', focus: '產品', uniqueValue: '研究', assessment: '報告', workload: '中' },
    ],
    recommendation: { courseIds: ['a'], reason: '較適合', confidence: 'medium' },
    personalized: { used: false, reason: '' },
    limitations: [],
  });

  assert.throws(() => parseCourseComparison(payload, new Set(['a', 'b'])), {
    code: 'INVALID_AI_RESPONSE',
  });
});

test('validates two to five courses while keeping profile fields optional', () => {
  const normalized = validateComparisonRequest({
    courses: [course('a'), course('b')],
    futureDirection: ' AI PM ',
  });

  assert.equal(normalized.courses.length, 2);
  assert.equal(normalized.futureDirection, 'AI PM');
  assert.equal(normalized.profileText, '');
  assert.throws(
    () => validateComparisonRequest({ courses: [course('a')] }),
    { code: 'INVALID_COMPARISON_COUNT' },
  );
  assert.throws(
    () => validateComparisonRequest({ courses: [course('a'), course('b', { syllabusUrl: 'https://example.com/a' })] }),
    { code: 'UNTRUSTED_SYLLABUS_URL' },
  );
});
