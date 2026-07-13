import test from 'node:test';
import assert from 'node:assert/strict';
import { NCCU_PERIODS } from '../src/nccu-periods.mjs';

test('defines the 16 official NCCU periods in display order', () => {
  assert.deepEqual(
    NCCU_PERIODS.map(({ code }) => code),
    ['A', 'B', '1', '2', '3', '4', 'C', 'D', '5', '6', '7', '8', 'E', 'F', 'G', 'H'],
  );
  assert.deepEqual(NCCU_PERIODS.find(({ code }) => code === 'D'), {
    code: 'D', start: 790, end: 840, time: '13:10–14:00', special: false,
  });
});
