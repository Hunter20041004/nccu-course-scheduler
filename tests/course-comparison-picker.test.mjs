import test from 'node:test';
import assert from 'node:assert/strict';
import { filterComparisonCourses } from '../src/course-comparison-picker.mjs';

const courses = [
  { id: 'hci', title: '智慧人機互動', teacher: '韓秉軒', sectionCode: '070426001' },
  { id: 'nlp', title: '自然語言處理', teacher: '高宏宇', sectionCode: '070427001' },
];

test('filters comparison candidates by title, teacher, or section code', () => {
  assert.deepEqual(filterComparisonCourses(courses, '人機').map(({ id }) => id), ['hci']);
  assert.deepEqual(filterComparisonCourses(courses, '高宏宇').map(({ id }) => id), ['nlp']);
  assert.deepEqual(filterComparisonCourses(courses, ' 070426001 ').map(({ id }) => id), ['hci']);
});
