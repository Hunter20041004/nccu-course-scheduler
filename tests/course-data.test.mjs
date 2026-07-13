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
