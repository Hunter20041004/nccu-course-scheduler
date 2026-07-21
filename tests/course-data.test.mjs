import test from 'node:test';
import assert from 'node:assert/strict';
import { courses, dayLabels } from '../src/course-data.mjs';

test('imports only open course groups and exactly three required courses', () => {
  assert.equal(courses.length, 23);
  assert.equal(courses.every((course) => course.available !== false), true);
  assert.equal(courses.some((course) => course.id === 'applied-ml'), false);
  assert.deepEqual(
    courses.filter((course) => course.required).map((course) => course.title).sort(),
    ['Agentic AI 在金融領域的應用', '創創入門', '數位創新沙龍'].sort(),
  );
});

test('exports Sunday as the seventh timetable day', () => {
  assert.equal(dayLabels[7], '週日');
});

test('models AI practical project as official sections with advisor choices', () => {
  const course = courses.find(({ id }) => id === 'ai-practical-project');
  assert.deepEqual(course.variants.map(({ id }) => id), ['783006001', '070395001']);
  const advisors = course.variants.find(({ id }) => id === '070395001').advisors;
  assert.deepEqual(advisors.map(({ id }) => id), ['chen-chao-ling', 'wu-chih-hsun', 'wu-yi-chieh']);
  assert.equal(advisors.find(({ id }) => id === 'wu-chih-hsun').schedule.label, '週二 D56');
  assert.equal(advisors.find(({ id }) => id === 'wu-yi-chieh').schedule.label, '週三 D56');
});

test('models Wei Lingyin project discussions as two mutually exclusive arrangements', () => {
  const course = courses.find(({ id }) => id === 'ai-practical-project');
  const variant = course.variants.find(({ id }) => id === '783006001');

  assert.equal(variant.selectionLabel, '討論時間安排');
  assert.deepEqual(variant.advisors.map(({ id }) => id), ['wei-tuesday-34c', 'wei-flexible']);
  assert.deepEqual(variant.advisors[0].schedule, {
    day: 2, start: 610, end: 780, label: '週二 34C',
  });
  assert.equal(variant.advisors[1].schedule, null);
  assert.equal(variant.advisors[1].optionMessage, '另約討論時間（中午時段亦可）');
});

test('keeps the Wei Lingyin NCCU section as one atomic record', () => {
  const course = courses.find(({ id }) => id === 'ai-practical-project');
  const section = course.sections.find(({ id }) => id === '783006001');

  assert.equal(section.sectionCode, '783006001');
  assert.equal(section.teacher, '魏綾音');
  assert.equal(section.credits, 3);
  assert.deepEqual(section.arrangements.map(({ id }) => id), [
    'wei-tuesday-34c',
    'wei-flexible',
  ]);
});

test('routes FinTech Introduction through undergraduate eligibility review', () => {
  const course = courses.find(({ id }) => id === 'fintech-intro');

  assert.equal(course.level, 'graduate');
  assert.equal(course.undergradReview, true);
});
