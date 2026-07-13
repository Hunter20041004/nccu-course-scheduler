import test from 'node:test';
import assert from 'node:assert/strict';

async function render() {
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  workerUrl.searchParams.set('test', `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request('http://localhost/'));
}

test('serves the private NCCU course scheduler with schedule before catalog', async () => {
  const response = await render();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/i);
  assert.match(html, /<title>政大排課｜實習友善課表規劃<\/title>/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /data-testid="schedule-panel"/);
  assert.match(html, /data-testid="course-catalog"/);
  assert.ok(html.indexOf('data-testid="schedule-panel"') < html.indexOf('data-testid="course-catalog"'));
  assert.match(html, /24 門候選課程/);
});

test('wires catalog course buttons to the schedule selection handler', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-course-id/);
  assert.match(html, /catalogList\.addEventListener\('click'/);
  assert.match(html, /toggleSelectableCourse\(selected, course, profile\)/);
});

test('includes manual course creation and local screenshot handoff', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="manual-course-form"/);
  assert.match(html, /validateManualCourse/);
  assert.match(html, /id="screenshot-input"/);
  assert.match(html, /URL\.createObjectURL/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /請辨識我附上的政大課程備選清單截圖/);
});

test('offers the three planning presets and applies the selected preset', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-preset="concentrated"/);
  assert.match(html, /data-preset="async-first"/);
  assert.match(html, /data-preset="lighter"/);
  assert.match(html, /applyPreset\(courseStore, button\.dataset\.preset\)/);
});

test('lets the student change eligibility conditions used by the catalog', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="profile-form"/);
  assert.match(html, /id="profile-year"/);
  assert.match(html, /id="profile-innovation"/);
  assert.match(html, /id="profile-statistics"/);
  assert.match(html, /profile\.prerequisites = byId\('profile-statistics'\)\.checked/);
});

test('requires a screenshot before starting the Codex handoff', async () => {
  const html = await (await render()).text();
  assert.match(html, /if \(!byId\('screenshot-input'\)\.files\.length\)/);
  assert.match(html, /請先選擇一張課程備選清單截圖/);
});
