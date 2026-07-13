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
    'src/app.mjs',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const script = sources.map((source) => source
    .replace(/^import .*;\n/gm, '')
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
  const html = await (await worker.fetch()).text();
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'expected an inline module script');

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nccu-bundle-'));
  const modulePath = join(temporaryDirectory, 'browser-bundle.mjs');
  await writeFile(modulePath, script);
  const syntaxCheck = spawnSync(process.execPath, ['--check', modulePath], { encoding: 'utf8' });
  await rm(temporaryDirectory, { recursive: true, force: true });

  assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr);
});
