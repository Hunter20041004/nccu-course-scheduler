import test from 'node:test';
import assert from 'node:assert/strict';

import { buildScheduleAgenda } from '../src/schedule-agenda.mjs';

test('groups physical meetings by weekday and sorts them from morning to evening', () => {
  const agenda = buildScheduleAgenda([
    { id: 'late', title: '晚課', attendance: 'physical', schedule: { day: 2, start: 780, end: 900 } },
    { id: 'multi', title: '多時段課', attendance: 'physical', meetings: [
      { day: 4, start: 610, end: 720 },
      { day: 2, start: 490, end: 540 },
    ] },
    { id: 'async', title: '非同步課', attendance: 'async', schedule: { day: 1, start: 490, end: 540 } },
    { id: 'pending', title: '時間未定課' },
  ]);

  assert.deepEqual(agenda.days.map(({ day }) => day), [2, 4]);
  assert.deepEqual(agenda.days[0].items.map(({ courseId }) => courseId), ['multi', 'late']);
  assert.deepEqual(agenda.flexible.map(({ courseId, reason }) => ({ courseId, reason })), [
    { courseId: 'async', reason: '非同步' },
    { courseId: 'pending', reason: '時間未定' },
  ]);
});
