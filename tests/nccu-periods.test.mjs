import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NCCU_PERIODS, formatNccuSchedule, gridPlacement, periodsForRange,
} from '../src/nccu-periods.mjs';

test('defines the 16 official NCCU periods in display order', () => {
  assert.deepEqual(
    NCCU_PERIODS.map(({ code }) => code),
    ['A', 'B', '1', '2', '3', '4', 'C', 'D', '5', '6', '7', '8', 'E', 'F', 'G', 'H'],
  );
  assert.deepEqual(NCCU_PERIODS.find(({ code }) => code === 'D'), {
    code: 'D', start: 790, end: 840, time: '13:10–14:00', special: false,
  });
});

test('converts exact and offset minute ranges to NCCU period codes', () => {
  assert.equal(periodsForRange(790, 960).map(({ code }) => code).join(''), 'D56');
  assert.equal(periodsForRange(1110, 1280).map(({ code }) => code).join(''), 'EFGH');
});

test('formats a course time with weekday and NCCU codes', () => {
  assert.equal(
    formatNccuSchedule({ day: 4, start: 790, end: 960 }, ['', '週一', '週二', '週三', '週四']),
    '週四 D56',
  );
});

test('places a spanning course on the matching grid rows', () => {
  assert.deepEqual(gridPlacement({ day: 4, start: 790, end: 960 }), {
    rowStart: 9,
    rowSpan: 3,
    codes: 'D56',
  });
});
