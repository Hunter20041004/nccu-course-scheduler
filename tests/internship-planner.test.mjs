import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERNSHIP_SETTINGS, calculateInternshipPlan, validateInternshipSettings,
} from '../src/internship-planner.mjs';

const concentrated = [
  { id: 'ml', title: '機器學習概論', schedule: { day: 1, start: 790, end: 960 }, attendance: 'physical' },
  { id: 'social', title: '社群媒體探勘', schedule: { day: 1, start: 970, end: 1140 }, attendance: 'physical' },
  { id: 'hci', title: '人機互動', schedule: { day: 4, start: 550, end: 720 }, attendance: 'physical' },
  { id: 'agentic', title: 'Agentic AI', schedule: { day: 4, start: 790, end: 960 }, attendance: 'physical' },
  { id: 'creative', title: '創創入門', schedule: { day: 4, start: 1090, end: 1260 }, attendance: 'physical' },
  { id: 'salon', title: '數位創新沙龍', schedule: { day: 5, start: 790, end: 960 }, attendance: 'physical' },
];

test('finds three equivalent internship days in the concentrated plan', () => {
  const result = calculateInternshipPlan(concentrated, DEFAULT_INTERNSHIP_SETTINGS);

  assert.equal(result.availableDays, 3);
  assert.equal(result.meetsTarget, true);
  assert.deepEqual(result.suggestedWindows.map(({ day, mode }) => ({ day, mode })), [
    { day: 2, mode: 'full' },
    { day: 3, mode: 'full' },
    { day: 1, mode: 'morning' },
  ]);
});

test('counts only conflict-free fixed internship windows', () => {
  const selected = [{
    id: 'course', title: '週二課程', attendance: 'physical',
    schedule: { day: 2, start: 790, end: 960 },
  }];
  const result = calculateInternshipPlan(selected, {
    targetDays: 1.5,
    start: '09:00',
    end: '18:00',
    mode: 'fixed',
    fixedDays: { 2: 'full', 3: 'morning' },
  });

  assert.equal(result.availableDays, 0.5);
  assert.equal(result.conflicts[0].courseId, 'course');
  assert.equal(result.meetsTarget, false);
  assert.equal(result.displayWindows.length, 2);
});

test('rejects an internship window shorter than two hours', () => {
  assert.deepEqual(validateInternshipSettings({ start: '09:00', end: '10:30' }), {
    field: 'end',
    message: '實習結束時間必須晚於開始時間，且每日時段至少兩小時。',
  });
});
