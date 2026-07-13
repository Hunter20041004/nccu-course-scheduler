import test from 'node:test';
import assert from 'node:assert/strict';
import { courses } from '../src/course-data.mjs';

test('loads all 24 course groups and exactly three required courses', () => {
  assert.equal(courses.length, 24);
  assert.deepEqual(
    courses.filter((course) => course.required).map((course) => course.title).sort(),
    ['Agentic AI 在金融領域的應用', '創創入門', '數位創新沙龍'].sort(),
  );
});

test('models AI practical project as official sections with advisor choices', () => {
  const course = courses.find(({ id }) => id === 'ai-practical-project');
  assert.deepEqual(course.variants.map(({ id }) => id), ['783006001', '070395001']);
  const advisors = course.variants.find(({ id }) => id === '070395001').advisors;
  assert.deepEqual(advisors.map(({ id }) => id), ['chen-chao-ling', 'wu-chih-hsun', 'wu-yi-chieh']);
  assert.equal(advisors.find(({ id }) => id === 'wu-chih-hsun').schedule.label, '週二 D56');
  assert.equal(advisors.find(({ id }) => id === 'wu-yi-chieh').schedule.label, '週三 D56');
});
