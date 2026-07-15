import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNccuCourseUrl, searchNccuCourses } from '../src/nccu-course-adapter.mjs';

test('builds the NCCU 115-1 keyword endpoint', () => {
  const url = buildNccuCourseUrl({ term: '115-1', keyword: '人機互動' });
  assert.equal(
    decodeURIComponent(url.pathname),
    '/course/zh-TW/:sem=1151 :curn=人機互動 /',
  );
});

test('normalizes the public NCCU course response', async () => {
  const fetchImpl = async () => Response.json([{ y: '115', s: '1', subNum: '703055001',
    subNam: '人機互動', teaNam: '廖文宏', subPoint: '3.0', subTime: '四234',
    teaSchmUrl: 'https://newdoc.nccu.edu.tw/example.html', note: '＠備註:僅限資訊系及雙主修學生修讀。',
    lmtKind: '限本系學生', gdeTpeMsg: '' }]);
  assert.deepEqual(await searchNccuCourses({ term: '115-1', keyword: '703055001', fetchImpl }), [{
    courseCode: '703055001', title: '人機互動', teacher: '廖文宏', credits: 3,
    scheduleText: '四234', available: true,
    sourceUrl: 'https://newdoc.nccu.edu.tw/example.html',
    restrictionText: '僅限資訊系及雙主修學生修讀。；限本系學生',
  }]);
});
