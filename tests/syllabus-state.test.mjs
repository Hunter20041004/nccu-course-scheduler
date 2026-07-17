import test from 'node:test';
import assert from 'node:assert/strict';
import { officialSyllabusState } from '../src/syllabus-state.mjs';

test('marks a trusted official syllabus URL available', () => {
  assert.deepEqual(officialSyllabusState({
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
    lookupStatus: 'success',
    checkedAt: '2026-07-17T18:00:00.000Z',
  }), {
    status: 'available',
    url: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
    checkedAt: '2026-07-17T18:00:00.000Z',
  });
});

test('marks a successful lookup without a URL as not uploaded', () => {
  assert.deepEqual(officialSyllabusState({
    sourceUrl: '',
    lookupStatus: 'success',
    checkedAt: '2026-07-17T18:00:00.000Z',
  }), {
    status: 'not_uploaded',
    url: '',
    checkedAt: '2026-07-17T18:00:00.000Z',
  });
});

test('keeps a failed official lookup unverified', () => {
  assert.deepEqual(officialSyllabusState({
    sourceUrl: '',
    lookupStatus: 'error',
    checkedAt: null,
  }), {
    status: 'unverified',
    url: '',
    checkedAt: null,
  });
});
