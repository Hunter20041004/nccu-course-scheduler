import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterComparisonCourses,
  reconcileComparisonCourseIds,
  toggleComparisonCourse,
} from '../src/course-comparison-picker.mjs';

const courses = [
  { id: 'hci', title: '智慧人機互動', teacher: '韓秉軒', sectionCode: '070426001' },
  { id: 'nlp', title: '自然語言處理', teacher: '高宏宇', sectionCode: '070427001' },
];

test('filters comparison candidates by title, teacher, or section code', () => {
  assert.deepEqual(filterComparisonCourses(courses, '人機').map(({ id }) => id), ['hci']);
  assert.deepEqual(filterComparisonCourses(courses, '高宏宇').map(({ id }) => id), ['nlp']);
  assert.deepEqual(filterComparisonCourses(courses, ' 070426001 ').map(({ id }) => id), ['hci']);
});

test('keeps comparison selection within five courses while allowing removal', () => {
  const full = ['1', '2', '3', '4', '5'];
  assert.deepEqual(toggleComparisonCourse(full, '6', true), { ids: full, limitReached: true });
  assert.deepEqual(toggleComparisonCourse(full, '3', false), {
    ids: ['1', '2', '4', '5'],
    limitReached: false,
  });
});

test('removes comparison ids that are no longer candidate courses', () => {
  assert.deepEqual(
    reconcileComparisonCourseIds(['kept', 'deleted'], [{ id: 'kept' }, { id: 'other' }]),
    ['kept'],
  );
});
