import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('the browser bundle parses after source modules are combined', async () => {
  const root = new URL('../', import.meta.url);
  const sources = await Promise.all([
    'src/nccu-periods.mjs',
    'src/internship-planner.mjs',
    'src/course-data.mjs',
    'src/planner-core.mjs',
    'src/planner-storage.mjs',
    'src/ai-planner.mjs',
    'src/app.mjs',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const script = sources.map((source) => source
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/^export\s+/gm, '')).join('\n\n');

  assert.doesNotThrow(() => new Function(script));
});

test('the finished browser bundle has valid ES module syntax', async () => {
  const root = new URL('../', import.meta.url);
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr);

  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  workerUrl.searchParams.set('syntax-test', String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const html = await (await worker.fetch(new Request('http://localhost/'))).text();
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'expected an inline module script');

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nccu-bundle-'));
  const modulePath = join(temporaryDirectory, 'browser-bundle.mjs');
  await writeFile(modulePath, script);
  const syntaxCheck = spawnSync(process.execPath, ['--check', modulePath], { encoding: 'utf8' });
  await rm(temporaryDirectory, { recursive: true, force: true });

  assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr);
});

test('the finished server bundle can validate AI route conflicts', async () => {
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  workerUrl.searchParams.set('ai-bundle-test', String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({
    summary: '無衝堂方案',
    plans: [
      { id: 'focus', title: '集中', reason: '集中', courseIds: ['a'], attendance: '實體', tradeoffs: [] },
      { id: 'balance', title: '平衡', reason: '平衡', courseIds: ['b'], attendance: '實體', tradeoffs: [] },
      { id: 'explore', title: '探索', reason: '探索', courseIds: ['c'], attendance: '實體', tradeoffs: [] },
    ],
  }) } }] });
  try {
    const response = await worker.fetch(new Request('http://localhost/api/ai/recommend-plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        courses: [
          { id: 'a', title: '課程 A', credits: 3, eligibility: 'eligible', schedule: { day: 1, start: 610, end: 780 } },
          { id: 'b', title: '課程 B', credits: 3, eligibility: 'eligible', schedule: { day: 2, start: 610, end: 780 } },
          { id: 'c', title: '課程 C', credits: 3, eligibility: 'eligible', schedule: { day: 3, start: 610, end: 780 } },
        ],
        selectedCourseIds: [], lockedCourseIds: [], internshipSettings: {},
      }),
    }), { GROQ_API_KEY: 'test-only' });
    assert.equal(response.status, 200, await response.text());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps server secrets and authorization headers out of browser HTML', async () => {
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  workerUrl.searchParams.set('secret-test', String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request('http://localhost/'));
  const browserHtml = await response.text();
  assert.doesNotMatch(browserHtml, /gsk_[A-Za-z0-9]+/);
  assert.doesNotMatch(browserHtml, /GROQ_API_KEY|Authorization:\s*Bearer/);
});
