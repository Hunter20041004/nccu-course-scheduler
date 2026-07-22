import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('README presents the course scheduler as a portfolio project', () => {
  const readme = readText('README.md');

  for (const required of [
    '[![CI](https://github.com/Hunter20041004/nccu-course-scheduler/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Hunter20041004/nccu-course-scheduler/actions/workflows/ci.yml)',
    '**[Share-safe Demo](https://hunter20041004.github.io/nccu-course-scheduler/)**',
    '**[Live Demo](https://nccu-course-planner-1151.huntertseng.chatgpt.site)**',
    'GitHub Pages 靜態版適合傳給朋友測試一般排課流程',
    '## Executive Summary',
    '## 作品集重點',
    '## 60 秒 Demo',
    '## 架構摘要',
    '## AI 與資料安全邊界',
    '## 驗證',
    '## License',
  ]) {
    assert.match(readme, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('points every live-demo reference at the canonical original Sites project', () => {
  const hosting = JSON.parse(readText('.openai/hosting.json'));
  const readme = readText('README.md');
  const html = readText('src/index.html');
  const app = readText('src/app.mjs');
  const canonicalUrl = 'https://nccu-course-planner-1151.huntertseng.chatgpt.site';

  assert.equal(hosting.project_id, 'appgprj_6a5587c540b0819191572c9cb320c553');
  for (const source of [readme, html, app]) {
    assert.match(source, new RegExp(canonicalUrl.replaceAll('.', '\\.')));
    assert.doesNotMatch(source, /nccu-internship-scheduler\.abuzz-teal-2691\.chatgpt\.site/);
  }
});

test('portfolio release includes CI and a narrow MIT license', () => {
  const workflow = readText('.github/workflows/ci.yml');
  const pagesWorkflow = readText('.github/workflows/pages.yml');
  const license = readText('LICENSE');

  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /node-version: 22/);
  assert.match(pagesWorkflow, /deploy-pages/);
  assert.match(pagesWorkflow, /dist\/static/);
  assert.match(license, /MIT License/);
  assert.match(license, /Hunter Tseng/);
});

test('documents the empty personal workspace and official search flow', () => {
  const readme = readText('README.md');

  assert.match(readme, /新訪客.*空白/);
  assert.match(readme, /政大 115-1.*搜尋/);
  assert.match(readme, /同一.*網址.*瀏覽器/);
});
