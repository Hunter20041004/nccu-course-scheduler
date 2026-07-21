import test from 'node:test';
import assert from 'node:assert/strict';
import { countActiveCatalogFilters, filterCandidateCourses } from '../src/catalog-filters.mjs';

test('keeps only courses meeting on one selected weekday', () => {
  const courses = [
    { id: 'tue', schedule: { day: 2, start: 490, end: 600 } },
    { id: 'thu', schedule: { day: 4, start: 610, end: 720 } },
    { id: 'flexible' },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [4] }).map(({ id }) => id),
    ['thu'],
  );
});

test('treats multiple selected weekdays as alternatives', () => {
  const courses = [
    { id: 'mon', schedule: { day: 1, start: 490, end: 600 } },
    { id: 'thu', schedule: { day: 4, start: 610, end: 720 } },
    { id: 'fri', schedule: { day: 5, start: 790, end: 900 } },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [1, 5] }).map(({ id }) => id),
    ['mon', 'fri'],
  );
});

test('requires weekday and daypart to match the same fixed meeting', () => {
  const courses = [{
    id: 'split',
    meetings: [
      { day: 2, start: 490, end: 600 },
      { day: 4, start: 790, end: 900 },
    ],
  }];

  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [2], dayparts: ['afternoon'] }),
    [],
  );
  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [4], dayparts: ['afternoon'] }).map(({ id }) => id),
    ['split'],
  );
});

test('matches flexible courses without treating async capability as the chosen schedule', () => {
  const courses = [
    { id: 'async', attendance: 'async', schedule: { day: 2, start: 490, end: 600 } },
    { id: 'undecided' },
    { id: 'capable-only', asyncAllowed: true, schedule: { day: 4, start: 790, end: 900 } },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, { dayparts: ['flexible'] }).map(({ id }) => id),
    ['async', 'undecided'],
  );
  assert.deepEqual(
    filterCandidateCourses(courses, { weekdays: [2], dayparts: ['flexible'] }),
    [],
  );
});

test('uses the currently selected attendance when filtering flexible courses', () => {
  const courses = [{
    id: 'remote-course',
    attendance: 'physical',
    asyncAllowed: true,
    schedule: { day: 4, start: 790, end: 900 },
  }];

  assert.deepEqual(
    filterCandidateCourses(courses, {
      dayparts: ['flexible'],
      attendanceByCourse: { 'remote-course': 'async' },
    }).map(({ id }) => id),
    ['remote-course'],
  );
});

test('combines status alternatives with weekday requirements', () => {
  const courses = [
    { id: 'selected-mon', schedule: { day: 1, start: 490, end: 600 } },
    { id: 'remote-thu', asyncAllowed: true, schedule: { day: 4, start: 790, end: 900 } },
    { id: 'review-thu', schedule: { day: 4, start: 790, end: 900 } },
  ];

  assert.deepEqual(
    filterCandidateCourses(courses, {
      statuses: ['selected', 'remote'],
      weekdays: [4],
      selectedIds: ['selected-mon'],
      eligibilityStatuses: { 'review-thu': 'review' },
    }).map(({ id }) => id),
    ['remote-thu'],
  );
});

test('keeps keyword search independent and counts checked filter conditions', () => {
  const courses = [
    {
      id: 'hci', title: '人機互動', teacher: '韓秉軒', sectionCode: '070426001',
      schedule: { day: 2, start: 490, end: 600 },
    },
    {
      id: 'finance', title: '金融科技導論', teacher: '張智星', sectionCode: '070424001',
      schedule: { day: 4, start: 790, end: 900 },
    },
  ];
  const filters = {
    query: '韓秉軒',
    statuses: ['selected', 'remote'],
    selectedIds: ['hci'],
    weekdays: [2, 4],
    dayparts: ['morning'],
  };

  assert.deepEqual(filterCandidateCourses(courses, filters).map(({ id }) => id), ['hci']);
  assert.equal(countActiveCatalogFilters(filters), 5);
});
