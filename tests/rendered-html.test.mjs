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

test('renders the full NCCU period grid and spanning course blocks', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="schedule-scroll"/);
  assert.match(html, /class="nccu-grid"/);
  assert.match(html, /NCCU_PERIODS\.map/);
  assert.match(html, /gridPlacement\(meeting\)/);
  assert.match(html, /data-period-code/);
  assert.match(html, /--row-span/);
});

test('lets a selected multi-option course choose its official section and advisor', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-course-variant/);
  assert.match(html, /data-course-advisor/);
  assert.match(html, /applyCourseOption\(selected, courseId, selection\)/);
  assert.match(html, /courseOptions/);
});

test('offers automatic and fixed internship controls and paints reservations on the grid', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="internship-form"/);
  assert.match(html, /id="internship-target"[^>]*step="0\.5"/);
  assert.match(html, /id="internship-start"/);
  assert.match(html, /id="internship-end"/);
  assert.match(html, /id="internship-mode"/);
  assert.match(html, /data-internship-day/);
  assert.match(html, /calculateInternshipPlan\(selected, internshipSettings\)/);
  assert.match(html, /class="internship-reservation/);
});

test('renders the rain-after-sunlight dreamcore design accessibly', async () => {
  const html = await (await render()).text();
  ['#F5F3EF', '#D8D5D2', '#FFAA55', '#6879C9', '#9180B5', '#D94A48', '#454348']
    .forEach((color) => assert.match(html, new RegExp(color, 'i')));
  assert.match(html, /class="dream-grain"[^>]*aria-hidden="true"/);
  assert.match(html, /class="dream-orb dream-orb-sun"[^>]*aria-hidden="true"/);
  assert.match(html, /class="dream-orb dream-orb-rain"[^>]*aria-hidden="true"/);
  assert.match(html, /class="dream-orb dream-orb-violet"[^>]*aria-hidden="true"/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /data-testid="schedule-panel"/);
  assert.match(html, /data-testid="course-catalog"/);
});
