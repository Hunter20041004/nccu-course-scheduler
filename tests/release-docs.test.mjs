import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('README presents the course scheduler as a maintained open-source project', () => {
  const readme = readText('README.md');

  for (const required of [
    '[![CI](https://github.com/Hunter20041004/nccu-course-scheduler/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Hunter20041004/nccu-course-scheduler/actions/workflows/ci.yml)',
    '**[Share-safe Demo](https://hunter20041004.github.io/nccu-course-scheduler/)**',
    '**[Live Demo](https://nccu-course-planner-1151.huntertseng.chatgpt.site)**',
    'GitHub Pages 靜態版適合傳給朋友測試一般排課流程',
    '## Executive Summary',
    '## 功能重點',
    '## 60 秒 Demo',
    '## 架構摘要',
    '## AI 與資料安全邊界',
    '## 驗證',
    '## License',
  ]) {
    assert.match(readme, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  // The public framing is "an open-source tool people use", not "a portfolio piece".
  // Reviewers and prospective users read the first screen literally.
  for (const forbidden of [/portfolio/i, /作品集/]) {
    assert.doesNotMatch(readme, forbidden);
  }
});

test('ships a security policy covering the key and data boundaries', () => {
  const security = readText('SECURITY.md');

  assert.match(security, /## Reporting a vulnerability/);
  assert.match(security, /GitHub Security Advisories/);
  // The two boundaries the project actually promises users.
  assert.match(security, /bring-your-own-key/i);
  assert.match(security, /not persisted/i);
});

test('documents the real API key route and the limits of the security promise', () => {
  const security = readText('SECURITY.md');

  assert.match(security, /same-origin Worker/i);
  assert.match(security, /x-goog-api-key/i);
  assert.match(security, /cannot guarantee zero risk/i);
  assert.match(security, /browser extensions/i);
  assert.match(security, /hosting infrastructure/i);
});

test('keeps a changelog with a released version and an unreleased section', () => {
  const changelog = readText('CHANGELOG.md');

  assert.match(changelog, /## \[Unreleased\]/);
  assert.match(changelog, /## \[0\.1\.0\]/);
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

test('release includes CI and a narrow MIT license', () => {
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
