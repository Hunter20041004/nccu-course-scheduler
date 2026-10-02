import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Competition entry terms forbid models developed or maintained by Chinese organisations, including via API.
const BANNED = /\b(qwen|deepseek|glm-?\d|chatglm|zhipu|moonshot|kimi|baichuan|minimax|yi-\d|ernie|hunyuan|doubao)\b/i;

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('runtime code and package scripts reference no Chinese-origin AI models', () => {
  const offenders = [...files('src'), 'package.json']
    .filter((path) => BANNED.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});
