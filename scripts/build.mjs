import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [template, styles, nccuPeriods, courseData, plannerCore, plannerStorage, app] = await Promise.all([
  read('src/index.html'),
  read('src/styles.css'),
  read('src/nccu-periods.mjs'),
  read('src/course-data.mjs'),
  read('src/planner-core.mjs'),
  read('src/planner-storage.mjs'),
  read('src/app.mjs'),
]);

const stripModuleSyntax = (source) => source
  .replace(/^import .*;\n/gm, '')
  .replace(/^export\s+/gm, '');
const script = [nccuPeriods, courseData, plannerCore, plannerStorage, app]
  .map(stripModuleSyntax)
  .join('\n\n');

const html = template
  .replace('/*__STYLES__*/', styles)
  .replace('/*__SCRIPT__*/', script);

const outputDir = new URL('dist/server/', root);
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await writeFile(new URL('index.js', outputDir), `const html = ${JSON.stringify(html)};\nexport default {\n  async fetch() {\n    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });\n  },\n};\n`);
await mkdir(new URL('dist/.openai/', root), { recursive: true });
await writeFile(new URL('dist/.openai/hosting.json', root), await read('.openai/hosting.json'));
