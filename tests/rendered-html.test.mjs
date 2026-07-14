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
  assert.match(html, /23 門候選課程/);
});

test('wires catalog course buttons to the schedule selection handler', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-course-id/);
  assert.match(html, /catalogList\.addEventListener\('click'/);
  assert.match(html, /toggleSelectableCourse\(selected, course, profile\)/);
});

test('deletes an optional candidate after confirmation and announces the result', async () => {
  const html = await (await render()).text();

  assert.match(html, /data-delete-course/);
  assert.match(html, /window\.confirm/);
  assert.match(html, /deleteCandidateCourse\(courseStore, selected, lockedCourseIds, course\.id\)/);
  assert.match(html, /deletedCourseIds/);
  assert.match(html, /id="catalog-status"[^>]*aria-live="polite"/);
});

test('shows at least ten candidates through compact rows with progressive details', async () => {
  const html = await (await render()).text();

  assert.match(html, /--catalog-row-height:\s*48px/);
  assert.match(html, /\.catalog-course\s*\{[^}]*min-height:\s*var\(--catalog-row-height\)/s);
  assert.match(html, /class="course-details"/);
  assert.match(html, /<summary[^>]*>詳細<\/summary>/);
  assert.match(html, /class="course-details-card"[\s\S]*class="course-conditions"/);
});

test('renders detail lock and delete controls for every candidate type', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="course-actions"/);
  assert.match(html, /data-lock-course=/);
  assert.match(html, /data-delete-course=/);
  assert.doesNotMatch(html, /course\.required\s*\?\s*`<button class="catalog-lock/);
});

test('locks unselected courses and confirms deletion of core candidates', async () => {
  const html = await (await render()).text();
  assert.match(html, /lockCandidateCourse\(selected, lockedCourseIds, course, profile\)/);
  assert.match(html, /這是你標記為一定要修的課程/);
  assert.match(html, /deleteCandidateCourse\(courseStore, selected, lockedCourseIds, course\.id\)/);
});

test('fits the full official NCCU period grid into a compact at-a-glance schedule', async () => {
  const html = await (await render()).text();

  assert.match(html, /grid-template-rows:\s*40px repeat\(16,\s*36px\)/);
  assert.match(html, /min-width:\s*840px/);
  assert.match(html, /\.period-label strong\s*\{[^}]*font-size:\s*\.88rem/s);
});

test('renders Monday through Sunday in the timetable and manual form', async () => {
  const html = await (await render()).text();
  assert.match(html, /dayLabels\.slice\(1, 8\)/);
  assert.match(html, /\[1, 2, 3, 4, 5, 6, 7\]\.map/);
  assert.match(html, /grid-template-columns:\s*60px repeat\(7,\s*minmax\(96px,\s*1fr\)\)/);
  assert.match(html, /週日/);
});

test('includes manual course creation and private screenshot import', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="manual-course-form"/);
  assert.match(html, /validateManualCourse/);
  assert.match(html, /id="screenshot-input"/);
  assert.match(html, /URL\.createObjectURL/);
  assert.match(html, /FileReader/);
  assert.match(html, /mergeImportedCourses/);
});

test('uploads a screenshot to the private import API and renders review groups', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="import-screenshot"/);
  assert.match(html, /fetch\('\/api\/ai\/import-courses'/);
  assert.match(html, /截圖會傳送給 Groq/);
  assert.match(html, /id="imported-courses"/);
  assert.match(html, /id="pending-courses"/);
  assert.doesNotMatch(html, /copy-codex-prompt/);
});

test('creates courses, clubs, organizations, and personal schedule items', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="manual-item-type"/);
  assert.match(html, /value="club"/);
  assert.match(html, /value="organization"/);
  assert.match(html, /value="personal"/);
  assert.match(html, /itemType: byId\('manual-item-type'\)\.value/);
  assert.match(html, /creditInput\.disabled = itemType !== 'course'/);
});

test('offers the three planning presets and applies the selected preset', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-preset="concentrated"/);
  assert.match(html, /data-preset="async-first"/);
  assert.match(html, /data-preset="lighter"/);
  assert.match(html, /applyPreset\(courseStore, button\.dataset\.preset\)/);
  assert.match(html, /applyRecommendedPlan\([^;]+lockedCourseIds/s);
  assert.doesNotMatch(html, /applyPreset\(courseStore, button\.dataset\.preset\);\s*lockedCourseIds = \[\]/);
});

test('collects the student profile and goals for AI planning', async () => {
  const html = await (await render()).text();
  for (const id of ['ai-profile', 'ai-activities', 'ai-future', 'ai-goals', 'ai-preferences']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /個人敘述會傳送給 Groq/);
  assert.match(html, /id="ai-advisor-status"[^>]*aria-live="polite"/);
});

test('sends current courses locks and internship settings to the advisor API', async () => {
  const html = await (await render()).text();
  assert.match(html, /fetch\('\/api\/ai\/recommend-plans'/);
  assert.match(html, /internshipSettings,/);
  assert.match(html, /lockedCourseIds,/);
  assert.match(html, /eligibility:\s*evaluateEligibility\(course, profile\)\.status/);
});

test('renders exactly three actionable recommendation cards', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="ai-plan-grid"/);
  assert.match(html, /data-apply-ai-plan/);
  assert.match(html, /套用此方案/);
  assert.match(html, /applyRecommendedPlan\(/);
});

test('clears the current timetable while preserving the candidate catalog', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="clear-schedule"/);
  assert.match(html, /clearPlannerSelection\(\)/);
  assert.match(html, /id="planner-status"[^>]*aria-live="polite"/);
  assert.match(html, /已清空目前課表/);
  assert.match(html, /persistState\(\);\s*renderAll\(\)/);
});

test('lets the student lock and unlock selected core courses', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-lock-course/);
  assert.match(html, /saved\.lockedCourseIds \|\| \[\]/);
  assert.match(html, /lockedCourseIds,/);
  assert.match(html, /lockCandidateCourse\(selected, lockedCourseIds, course, profile\)/);
  assert.match(html, /toggleCourse\(selected, course, lockedCourseIds\)/);
});

test('does not silently restore removed core courses after reload', async () => {
  const html = await (await render()).text();
  assert.doesNotMatch(html, /courseStore\.filter\(\(course\) => course\.required\)\.forEach/);
});

test('renders course-driven eligibility conditions with reasons and affected courses', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="profile-form"/);
  assert.match(html, /id="profile-year"/);
  assert.match(html, /id="condition-list"/);
  assert.match(html, /buildConditionDefinitions\(courseStore, customConditions\)/);
  assert.match(html, /buildConditionImpacts\(courseStore, definitions, profile\)/);
  assert.match(html, /impact\.summary/);
  assert.match(html, /impact\.affectedCourses/);
  assert.doesNotMatch(html, /id="profile-innovation"/);
  assert.doesNotMatch(html, /id="profile-statistics"/);
});

test('adds a validated custom condition to the profile and persists it', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="custom-condition-form"/);
  assert.match(html, /id="custom-condition-label"/);
  assert.match(html, /id="custom-condition-category"/);
  assert.match(html, /id="custom-condition-description"/);
  assert.match(html, /validateCustomCondition\(input, definitions\)/);
  assert.match(html, /customConditions\.push\(condition\)/);
  assert.match(html, /profile\.conditionIds = \[\.\.\.selectedIds, condition\.id\]/);
  assert.match(html, /id="custom-condition-status"[^>]*aria-live="polite"/);
});

test('deletes only custom conditions and removes them from the profile', async () => {
  const html = await (await render()).text();
  assert.match(html, /impact\.source === 'custom'/);
  assert.match(html, /data-delete-condition/);
  assert.match(html, /customConditions = customConditions\.filter/);
  assert.match(html, /profile\.conditionIds = profileConditionIds\(profile\)\.filter/);
  assert.match(html, /確定刪除自訂條件/);
});

test('requires a screenshot before starting the private import', async () => {
  const html = await (await render()).text();
  assert.match(html, /if \(!file\)/);
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

test('contains the wide NCCU timetable inside the mobile schedule panel', async () => {
  const html = await (await render()).text();

  assert.match(html, /\.panel\s*\{[^}]*min-width:\s*0/s);
  assert.match(html, /\.planner-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test('keeps compact course detail disclosure targets at least 44 pixels tall', async () => {
  const html = await (await render()).text();

  assert.match(html, /\.course-details summary[^}]*\{[^}]*min-height:\s*44px/s);
});
