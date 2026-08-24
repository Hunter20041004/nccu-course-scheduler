import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('documents contribution setup, TDD, and official course evidence', () => {
  const contributing = readText('CONTRIBUTING.md');

  for (const required of [
    'npm install',
    'npm run verify',
    'Red → Green → Refactor',
    '九碼課號',
    '官方課綱',
    '不要提交 API Key',
  ]) assert.match(contributing, new RegExp(required));
});

test('documents community conduct and a private enforcement route', () => {
  const conduct = readText('CODE_OF_CONDUCT.md');

  assert.match(conduct, /Contributor Covenant/);
  assert.match(conduct, /可接受的行為/);
  assert.match(conduct, /不可接受的行為/);
  assert.match(conduct, /執行準則/);
  assert.match(conduct, /GitHub Security Advisories/);
  assert.match(conduct, /私下回報/);
});

test('collects reproducible bug reports without private data', () => {
  const template = readText('.github/ISSUE_TEMPLATE/bug_report.yml');

  for (const required of [
    '重現步驟',
    '預期結果',
    '實際結果',
    '瀏覽器與裝置',
    '發生問題的網址',
    'API Key',
    '學生個資',
  ]) assert.match(template, new RegExp(required));
});

test('collects official evidence for course data corrections', () => {
  const template = readText('.github/ISSUE_TEMPLATE/course_data_correction.yml');

  for (const required of [
    '學期',
    '九碼課號',
    '政大官方網址',
    '官方證據',
    '固定時段與出席形式',
    '考試、展示或其他固定義務',
  ]) assert.match(template, new RegExp(required));
});

test('requires pull request evidence, privacy checks, and UI screenshots', () => {
  const template = readText('.github/pull_request_template.md');

  for (const required of [
    '摘要',
    '關聯 issue',
    'Red',
    'Green',
    'npm run verify',
    '官方來源',
    '隱私',
    '桌機',
    '手機',
    '剩餘限制',
  ]) assert.match(template, new RegExp(required, 'i'));
});

test('states the unofficial boundary and course correction workflow up front', () => {
  const readme = readText('README.md');
  const firstScreen = readme.slice(0, readme.indexOf('## Executive Summary'));

  assert.match(firstScreen, /非政大官方服務/);
  assert.match(readme, /政大正式選課系統.*系所公告.*最終依據/);
  assert.match(readme, /## 課程資料更正/);
  assert.match(readme, /學期.*九碼課號.*官方課綱/s);
  assert.match(readme, /CONTRIBUTING\.md/);
  assert.match(readme, /course_data_correction\.yml/);
  assert.match(readme, /不會.*套用到其他學期/s);
});

test('scans full repository history for secrets on pushes and pull requests', () => {
  const workflow = readText('.github/workflows/secret-scan.yml');

  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /gitleaks\/gitleaks-action@[0-9a-f]{40}/);
  assert.match(workflow, /GITLEAKS_VERSION:\s*["']?8\.30\.1/);
  assert.match(workflow, /redacted output/i);
  assert.match(workflow, /GITLEAKS_ENABLE_COMMENTS:\s*["']?false/);
  assert.match(workflow, /GITLEAKS_ENABLE_UPLOAD_ARTIFACT:\s*["']?false/);
  assert.match(workflow, /GITLEAKS_ENABLE_SUMMARY:\s*["']?false/);
});

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
