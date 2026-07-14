import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildNccuCourseUrl, normalizeNccuRows } from '../src/nccu-course-adapter.mjs';

const execFileAsync = promisify(execFile);

test('live NCCU endpoint exposes the fields used by the adapter', { timeout: 20_000 }, async () => {
  const url = buildNccuCourseUrl({ term: '115-1', keyword: '人機互動' });
  const { stdout } = await execFileAsync('curl', ['--fail', '--silent', '--show-error', '--max-time', '15', url.href]);
  const rows = normalizeNccuRows(JSON.parse(stdout), '115-1');
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => /^\w{9}$/.test(row.courseCode)));
  assert.ok(rows.every((row) => row.title && Number.isFinite(row.credits)));
});
