import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOfficialCandidate } from '../src/course-reconciler.mjs';
import { nccuCourseToCandidate } from '../src/nccu-course-adapter.mjs';

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

test('preserves the existing planner identity when an official section is refreshed', () => {
  assert.equal(reconcileOfficialCandidate(
    { id: 'hci', sectionCode: '703055001' },
    { id: 'ai-703055001', sectionCode: '703055001', teacher: '廖文宏' },
  ).id, 'hci');
});

test('applies a verified asynchronous correction immediately when refreshing a selected course', () => {
  const existing = {
    id: 'ai-701889001',
    sectionCode: '701889001',
    attendance: 'physical',
    schedule: { day: 2, start: 970, end: 1140 },
  };
  const incoming = nccuCourseToCandidate({
    courseCode: '701889001',
    title: '生成式 AI：文字與圖像生成的原理與實務',
    teacher: '蔡炎龍',
    credits: 3,
    scheduleText: '二78E',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
  });

  const refreshed = reconcileOfficialCandidate(existing, incoming);

  assert.equal(refreshed.attendance, 'async');
  assert.equal(refreshed.schedule, null);
  assert.deepEqual(refreshed.meetings, []);
});

test('preserves an intentional attendance override after the schedule correction was already applied', () => {
  const existing = {
    id: 'ai-701889001',
    sectionCode: '701889001',
    attendance: 'physical',
    schedule: null,
    meetings: [],
  };
  const incoming = nccuCourseToCandidate({
    courseCode: '701889001',
    title: '生成式 AI：文字與圖像生成的原理與實務',
    teacher: '蔡炎龍',
    credits: 3,
    scheduleText: '二78E',
    sourceUrl: 'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
  });

  const refreshed = reconcileOfficialCandidate(existing, incoming);

  assert.equal(refreshed.attendance, 'physical');
  assert.equal(refreshed.schedule, null);
  assert.deepEqual(refreshed.meetings, []);
});
