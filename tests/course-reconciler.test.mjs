import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOfficialCandidate } from '../src/course-reconciler.mjs';

test('refreshes official fields while preserving user-owned planning state', () => {
  const existing = {
    id: 'ai-703055001',
    sectionCode: '703055001',
    title: '人機互動',
    source: 'nccu-verified-import',
    sourceUrl: '',
    attendance: 'async',
    userNote: '優先修',
    schedule: { day: 4, start: 550, end: 720 },
  };
  const incoming = {
    ...existing,
    teacher: '廖文宏',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
    attendance: 'physical',
    userNote: undefined,
  };

  assert.deepEqual(reconcileOfficialCandidate(existing, incoming), {
    ...incoming,
    attendance: 'async',
    userNote: '優先修',
  });
});
