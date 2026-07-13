import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
