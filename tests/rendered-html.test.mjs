import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(html, /候選課程/);
});

test('starts a new browser with an empty personal workspace', async () => {
  const html = await (await render()).text();

  assert.match(html, /let courseStore = \[\];/);
  assert.match(html, /let selected = \[\];/);
  assert.match(html, /createStartupCatalog\(saved, courses\)/);
  assert.doesNotMatch(html, /let selected = applyPreset/);
});

test('build emits a GitHub Pages static fallback', () => {
  const html = readFileSync(new URL('../dist/static/index.html', import.meta.url), 'utf8');

  assert.match(html, /<title>政大排課｜實習友善課表規劃<\/title>/);
  assert.match(html, /id="schedule-grid"/);
  assert.match(html, /id="export-wallpaper"/);
  assert.match(html, /第一次使用/);
});

test('static fallback warns that AI features require the full live demo', () => {
  const html = readFileSync(new URL('../dist/static/index.html', import.meta.url), 'utf8');

  assert.match(html, /GitHub Pages 分享版可測試一般排課與桌布匯出/);
  assert.match(html, /AI 匯入與推薦請改用完整 Live Demo/);
  assert.match(html, /isStaticFallbackHost/);
});

test('renders secure Gemini API key setup without first-load auto prompt', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="api-key-status-button"/);
  assert.match(html, /<dialog id="api-key-dialog"[^>]*aria-labelledby="api-key-title"/);
  assert.match(html, /id="api-key-input"[^>]*type="password"[^>]*autocomplete="off"/);
  assert.match(html, /aistudio\.google\.com\/app\/apikey/);
  assert.match(html, /Google Assistant／Gemini App 不等於 Gemini API/);
  assert.match(html, /createApiKeySession\(\)/);
  assert.match(html, /validateAndStoreApiKey/);
  assert.match(html, /function requireApiKeyForAi\(status\)/);
  assert.match(html, /byId\('api-key-status-button'\)\.addEventListener\('click', openApiKeyDialog\)/);
  assert.match(html, /const apiKey = requireApiKeyForAi\(status\)/);
  assert.match(html, /apiKey,\s*profileText:/);
  assert.match(html, /JSON\.stringify\(\{ apiKey, imageDataUrl, term: '115-1' \}\)/);
  assert.doesNotMatch(html, /API_ONBOARDING_SEEN_KEY/);
  assert.doesNotMatch(html, /openApiKeyDialog\(\);[\s\S]{0,240}renderApiKeyState\(\)/);
  assert.doesNotMatch(html, /sessionStorage/);
});

test('shows a first-use tutorial welcome instead of auto-opening API setup', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="first-use-dialog"[^>]*aria-labelledby="first-use-title"/);
  assert.match(html, /id="start-quick-tour"/);
  assert.match(html, /id="skip-quick-tour"/);
  assert.match(html, /id="open-tutorial-from-welcome"/);
  assert.match(html, /FIRST_USE_TUTORIAL_SEEN_KEY/);
  assert.match(html, /openFirstUseWelcome\(\)/);
  assert.doesNotMatch(html, /if \(localStorage\.getItem\(API_ONBOARDING_SEEN_KEY\) !== 'true'\) openApiKeyDialog\(\)/);
  assert.doesNotMatch(html, /catch \{ openApiKeyDialog\(\); \}/);
});

test('keeps a permanent tutorial center with detailed first-run help', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="open-tutorial-center"[^>]*>使用教學<\/button>/);
  assert.match(html, /id="tutorial-center"[^>]*aria-labelledby="tutorial-center-title"/);
  assert.match(html, /id="tutorial-center-close"/);
  assert.match(html, /id="restart-quick-tour"/);
  for (const label of ['第一次使用', '取得 Gemini API Key', '匯入候選課程', '管理選課條件', '排課操作', '實習與個人行程', 'AI 推薦方案', '常見問題']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /API Key 等同使用者自己的額度，請不要傳給別人/);
  assert.match(html, /function openTutorialCenter\(\)/);
  assert.match(html, /byId\('open-tutorial-center'\)\.addEventListener\('click', openTutorialCenter\)/);
});

test('marks quick tour skipped or completed without changing planner data', async () => {
  const html = await (await render()).text();

  assert.match(html, /function markFirstUseTutorialSeen\(\)/);
  assert.match(html, /localStorage\.setItem\(FIRST_USE_TUTORIAL_SEEN_KEY, 'true'\)/);
  assert.match(html, /byId\('skip-quick-tour'\)\.addEventListener\('click'/);
  assert.match(html, /byId\('start-quick-tour'\)\.addEventListener\('click', startQuickTour\)/);
  assert.match(html, /byId\('restart-quick-tour'\)\.addEventListener\('click', startQuickTour\)/);
  assert.match(html, /function endQuickTour\(\{ completed = false \} = \{\}\)/);
  assert.doesNotMatch(html, /startQuickTour[\s\S]{0,1200}selected =/);
  assert.doesNotMatch(html, /startQuickTour[\s\S]{0,1200}courseStore =/);
});

test('defines a native eight-step quick tour that can switch tabs without mutating data', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="quick-tour-overlay"/);
  assert.match(html, /id="quick-tour-prev"/);
  assert.match(html, /id="quick-tour-next"/);
  assert.match(html, /id="quick-tour-end"/);
  assert.match(html, /const quickTourSteps = \[/);
  for (const target of ['schedule-panel', 'workspace-panel-catalog', 'course-actions', 'workspace-panel-conditions', 'workspace-panel-internship', 'workspace-panel-ai', 'workspace-panel-add', 'schedule-grid']) {
    assert.match(html, new RegExp(`target: '${target}'`));
  }
  assert.match(html, /setWorkspaceTab\(step\.tab\)/);
  assert.match(html, /setCompactView\(step\.compactView\)/);
  assert.match(html, /targetElement\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
  assert.doesNotMatch(html, /renderQuickTourStep[\s\S]{0,1600}persistState\(\)/);
});

test('positions a visible spotlight for every quick tour target after each step changes', async () => {
  const html = await (await render()).text();

  assert.match(html, /function positionQuickTourSpotlight\(targetElement\)/);
  assert.match(html, /targetElement\.getBoundingClientRect\(\)/);
  assert.match(html, /const spotlight = byId\('quick-tour-spotlight'\)/);
  assert.match(html, /spotlight\.style\.setProperty\('--tour-x'/);
  assert.match(html, /spotlight\.style\.setProperty\('--tour-y'/);
  assert.match(html, /spotlight\.style\.setProperty\('--tour-width'/);
  assert.match(html, /spotlight\.style\.setProperty\('--tour-height'/);
  assert.match(html, /positionQuickTourSpotlight\(targetElement\)/);
  assert.match(html, /\.quick-tour-spotlight\s*\{[^}]*transform:\s*translate\(var\(--tour-x\),\s*var\(--tour-y\)\)/s);
  assert.match(html, /\.quick-tour-spotlight\s*\{[^}]*box-shadow:\s*0 0 0 9999px rgba\(33,31,38,\.42\)/s);
});

test('uses an inline favicon so the private app makes no missing icon request', async () => {
  const html = await (await render()).text();
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
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

test('offers a destructive bulk candidate clear without restoring author courses', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="clear-candidates"[^>]*>清空候選課程<\/button>/);
  assert.match(html, /clearCandidateCatalog\(\)/);
  assert.match(html, /確定清空全部候選課程/);
  assert.doesNotMatch(html, /恢復建議方案/);
});

test('shows at least ten candidates through compact rows with progressive details', async () => {
  const html = await (await render()).text();

  assert.match(html, /--catalog-row-height:\s*48px/);
  assert.match(html, /\.catalog-course\s*\{[^}]*min-height:\s*var\(--catalog-row-height\)/s);
  assert.match(html, /class="course-details"/);
  assert.match(html, /<summary[^>]*>詳細<\/summary>/);
  assert.match(html, /class="course-details-card"[\s\S]*class="course-conditions"/);
});

test('shows the NCCU schedule summary inside every candidate row', async () => {
  const html = await (await render()).text();

  assert.match(html, /candidateScheduleSummary\(selectedCourse \|\| course, dayLabels\)/);
  assert.match(html, /class="catalog-time"/);
});

test('offers safe syllabus actions only for course candidates', async () => {
  const html = await (await render()).text();

  assert.match(html, /trustedOfficialSyllabusUrl\(course\)/);
  assert.match(html, /course\.source !== 'manual' \|\| course\.itemType === 'course'/);
  assert.match(html, /class="catalog-syllabus"[^>]*target="_blank" rel="noopener noreferrer"[^>]*>課綱<\/a>/);
  assert.match(html, /class="catalog-syllabus"[^>]*disabled[^>]*>無課綱<\/button>/);
});

test('renders complete course details as an inline panel', async () => {
  const html = await (await render()).text();

  assert.match(html, /let expandedCourseId = null/);
  assert.match(html, /class="catalog-details-trigger"[^>]*aria-expanded=/);
  assert.match(html, /class="course-details-panel"/);
  for (const label of ['課程名稱', '課號', '授課教師', '學分', '上課時間', '修課資格', '資料來源']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /開啟官方課綱/);
});

test('lets an expanded attendance control increase its candidate row height', async () => {
  const html = await (await render()).text();

  assert.match(html, /\.catalog-list\s*\{[^}]*display:\s*block/s);
  assert.match(html, /\.catalog-list\s*\{[^}]*flex:\s*1 1 auto/s);
});

test('reveals physical synchronous and asynchronous choices after selecting a remote-capable course', async () => {
  const html = await (await render()).text();

  assert.match(html, /selectedNow && course\.asyncAllowed/);
  assert.match(html, /<span>實體／同步／非同步<\/span>/);
  assert.match(html, /<option value="physical"[^>]*>實體<\/option>/);
  assert.match(html, /<option value="sync"[^>]*>同步<\/option>/);
  assert.match(html, /<option value="async"[^>]*>非同步<\/option>/);
  assert.doesNotMatch(html, /selectedNow && course\.asyncAllowed[\s\S]{0,800}實體／固定同步/);
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

test('uses the same timetable palette for core and optional courses', async () => {
  const html = await (await render()).text();

  assert.doesNotMatch(html, /\.grid-course\.is-required\s*\{/);
  assert.doesNotMatch(html, /\.grid-course\.is-required\.has-conflict\s*\{/);
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

test('searches and imports official NCCU 115-1 courses without an AI key', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="nccu-course-search-form"/);
  assert.match(html, /id="nccu-course-query"/);
  assert.match(html, /id="nccu-course-results"/);
  assert.match(html, /searchNccuCourses\(\{ term: '115-1', keyword: query \}\)/);
  assert.match(html, /data-add-nccu-course/);
  assert.match(html, /nccuCourseToCandidate/);
});

test('keeps the NCCU search form reference valid after the async request', async () => {
  const html = await (await render()).text();

  assert.match(html, /const searchForm = event\.currentTarget;/);
  assert.match(html, /searchForm\.removeAttribute\('aria-busy'\)/);
  assert.doesNotMatch(html, /event\.currentTarget\.removeAttribute\('aria-busy'\)/);
});

test('uploads a screenshot to the private import API and renders review groups', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="import-screenshot"/);
  assert.match(html, /fetch\('\/api\/ai\/import-courses'/);
  assert.match(html, /截圖會以你的 Key 傳送給 Gemini 3\.1 Flash-Lite/);
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

test('removes quick presets and groups tools into a labeled right workspace', async () => {
  const html = await (await render()).text();
  assert.doesNotMatch(html, /id="preset-picker"/);
  assert.doesNotMatch(html, /button\.dataset\.preset/);
  assert.match(html, /id="workspace-tabs"[^>]*role="tablist"/);
  for (const tab of ['catalog', 'ai', 'conditions', 'internship', 'add']) {
    assert.match(html, new RegExp(`data-workspace-tab="${tab}"`));
    assert.match(html, new RegExp(`id="workspace-panel-${tab}"`));
  }
  assert.ok(html.indexOf('data-testid="schedule-panel"') < html.indexOf('id="workspace-tabs"'));
});

test('switches workspace tabs with synchronized selected and hidden states', async () => {
  const html = await (await render()).text();
  assert.match(html, /function setWorkspaceTab\(name\)/);
  assert.match(html, /tab\.setAttribute\('aria-selected', String\(selected\)\)/);
  assert.match(html, /panel\.hidden = panel\.dataset\.workspacePanel !== name/);
  assert.match(html, /byId\('workspace-tabs'\)\.addEventListener\('click'/);
  assert.match(html, /setWorkspaceTab\(button\.dataset\.workspaceTab\)/);
});

test('switches between the schedule and tools on compact screens', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="compact-view-switch"/);
  assert.match(html, /data-compact-view="schedule"/);
  assert.match(html, /data-compact-view="tools"/);
  assert.match(html, /function setCompactView\(name\)/);
  assert.match(html, /byId\('planner-workbench'\)\.dataset\.compactView = name/);
  assert.match(html, /setCompactView\(button\.dataset\.compactView\)/);
});

test('collects the student profile and goals for AI planning', async () => {
  const html = await (await render()).text();
  for (const id of ['ai-profile', 'ai-future', 'ai-goals', 'ai-preferences']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /id="ai-activities"/);
  assert.match(html, /這學期想達成什麼/);
  assert.match(html, /個人敘述會以你的 Key 傳送給 Gemini/);
  assert.match(html, /id="ai-advisor-status"[^>]*aria-live="polite"/);
});

test('sends current courses locks and internship settings to the advisor API', async () => {
  const html = await (await render()).text();
  assert.match(html, /fetch\('\/api\/ai\/recommend-plans'/);
  assert.match(html, /internshipSettings,/);
  assert.match(html, /lockedCourseIds,/);
  assert.match(html, /events:\s*course\.events/);
  assert.match(html, /eligibility:\s*evaluateEligibility\(course, profile\)\.status/);
});

test('renders exactly three actionable recommendation cards', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="ai-plan-grid"/);
  assert.match(html, /data-apply-ai-plan/);
  assert.match(html, /套用此方案/);
  assert.match(html, /applyRecommendedPlan\(/);
});

test('presents AI recommendations as previewable strategy routes', async () => {
  const html = await (await render()).text();
  assert.match(html, /class="ai-route-board"/);
  assert.match(html, /data-preview-ai-plan/);
  assert.match(html, /收起預覽' : '預覽'/);
  assert.match(html, /class="route-week-preview"/);
  assert.match(html, /lockedCourseIds\.includes\(course\.id\)[\s\S]*鎖定保留/);
  assert.match(html, /plan\.asyncCourseIds\?\.includes\(course\.id\)[\s\S]*非同步/);
  assert.match(html, /let previewedPlanId = null/);
  assert.match(html, /function toggleRecommendedPlanPreview\(planId\)/);
  assert.match(html, /previewedPlanId = previewedPlanId === planId \? null : planId/);
  assert.match(html, /const previewButton = event\.target\.closest\('\[data-preview-ai-plan\]'\)/);
  assert.match(html, /toggleRecommendedPlanPreview\(previewButton\.dataset\.previewAiPlan\)/);
});

test('does not render locally conflicting AI routes', async () => {
  const html = await (await render()).text();

  assert.match(html, /conflicts,/);
  assert.match(html, /const safePlans = previewedPlans\.filter\(\(\{ preview \}\) => preview\.conflicts\.length === 0\)/);
  assert.match(html, /已隱藏 \$\{hiddenConflictCount\} 個衝堂方案/);
  assert.match(html, /目前沒有可安全套用的方案/);
  assert.doesNotMatch(html, /方案有衝堂/);
});

test('clears the current timetable while preserving the candidate catalog', async () => {
  const html = await (await render()).text();
  assert.match(html, /id="clear-schedule"/);
  assert.match(html, /clearPlannerSelection\(\)/);
  assert.match(html, /id="planner-status"[^>]*aria-live="polite"/);
  assert.match(html, /已清空目前課表/);
  assert.match(html, /persistState\(\);\s*renderAll\(\)/);
});

test('exports the current timetable as a phone wallpaper PNG', async () => {
  const html = await (await render()).text();

  assert.match(html, /id="export-wallpaper"[^>]*>匯出手機桌布<\/button>/);
  assert.match(html, /function exportScheduleWallpaper\(\)/);
  assert.match(html, /function renderScheduleWallpaper\(canvas\)/);
  assert.match(html, /canvas\.width = 1170/);
  assert.match(html, /canvas\.height = 2532/);
  assert.match(html, /downloadCanvasPng\(canvas, 'nccu-schedule-wallpaper-115-1\.png'\)/);
  assert.match(html, /canvas\.toDataURL\('image\/png'\)/);
  assert.doesNotMatch(html, /drawWallpaperStat\(ctx, '已選學分'/);
  assert.doesNotMatch(html, /drawWallpaperStat\(ctx, '可實習'/);
  assert.doesNotMatch(html, /drawWallpaperStat\(ctx, '提醒'/);
  assert.doesNotMatch(html, /匯出時間/);
  assert.match(html, /const safeX = 96/);
  assert.match(html, /const safeBottom = 176/);
  assert.match(html, /byId\('export-wallpaper'\)\.addEventListener\('click', exportScheduleWallpaper\)/);
  assert.match(html, /手機桌布已匯出/);
});

test('renders the exported wallpaper with a readable light-dreamcore visual system', async () => {
  const html = await (await render()).text();

  assert.match(html, /const dreamcoreWallpaper = \{/);
  assert.match(html, /mistLavender: '#ECE7F7'/);
  assert.match(html, /sunHalo: '#F8DFA8'/);
  assert.match(html, /function drawDreamcoreBackdrop\(ctx, canvas, colors, safeX, safeTop\)/);
  assert.match(html, /function drawGlassPanel\(ctx, x, y, width, height, radius, colors\)/);
  assert.match(html, /function drawMistDivider\(ctx, x1, y1, x2, y2, colors\)/);
  assert.match(html, /shadowBlur = 34/);
  assert.match(html, /rgba\(110, 70, 184, 0\.10\)/);
  assert.match(html, /rgba\(248, 223, 168, 0\.48\)/);
  assert.match(html, /夢核/);
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

test('labels syllabus-defined project arrangements instead of treating every option as an advisor', async () => {
  const html = await (await render()).text();

  assert.match(html, /selectedVariant\.selectionLabel \|\| '指導老師與時段'/);
  assert.match(html, /advisor\.optionLabel \|\|/);
  assert.match(html, /variant\.selectionLabel \|\| '指導老師'/);
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

test('renders the Sunbreak workbench without decorative dreamcore effects', async () => {
  const html = await (await render()).text();
  ['#F7F6FA', '#FFFFFF', '#211F26', '#5E5B68', '#DAD7E2', '#2446D8', '#6E46B8', '#E7A43A', '#B43830']
    .forEach((color) => assert.match(html, new RegExp(color, 'i')));
  assert.match(html, /class="brand-lockup"/);
  assert.match(html, /class="header-metrics"/);
  assert.match(html, /id="internship-progress"/);
  assert.match(html, /--radius-panel:\s*12px/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /data-testid="schedule-panel"/);
  assert.match(html, /data-testid="course-catalog"/);
  assert.doesNotMatch(html, /dream-orb|dream-grain|weather-window|hero-copy/);
  assert.doesNotMatch(html, /backdrop-filter/);
});

test('updates the Sunbreak internship progress line from the current target', async () => {
  const html = await (await render()).text();
  assert.match(html, /const internshipProgress = byId\('internship-progress'\)/);
  assert.match(html, /internshipProgress\.style\.setProperty\('--internship-progress', `\$\{progressPercent\}%`\)/);
  assert.match(html, /internshipProgress\.setAttribute\('aria-valuenow', String\(progressPercent\)\)/);
});

test('reveals a newly added course in the official timetable', async () => {
  const html = await (await render()).text();
  assert.match(html, /data-grid-course="\$\{escapeHtml\(course\.id\)\}"/);
  assert.match(html, /function revealPlacedCourse\(courseId\)/);
  assert.match(html, /block\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
  assert.match(html, /if \(!wasSelected\) revealPlacedCourse\(course\.id\)/);
  assert.match(html, /\.grid-course\.is-newly-placed\s*\{[^}]*200ms/s);
});

test('uses plain-language eligibility labels in compact course rows', async () => {
  const html = await (await render()).text();
  assert.match(html, /blocked: '條件不符合，請看詳細。'/);
  assert.match(html, /unavailable: '本學期未開課'/);
  assert.doesNotMatch(html, /blocked: '條件不符合'/);
});

test('exposes the actual eligibility reasons in every non-eligible course detail', async () => {
  const html = await (await render()).text();
  assert.match(html, /eligibility\.status !== 'eligible'/);
  assert.match(html, /<strong>資格說明<\/strong>/);
  assert.match(html, /eligibility\.reasons\.map\(\(reason\)/);
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

test('keeps tutorial UI usable on compact screens', async () => {
  const html = await (await render()).text();

  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.quick-tour-card\s*\{[\s\S]*right:\s*10px[\s\S]*bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom\)\)[\s\S]*max-height:\s*min\(460px,\s*calc\(100dvh - 24px - env\(safe-area-inset-bottom\)\)\)[\s\S]*overflow:\s*hidden/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.quick-tour-body\s*\{[\s\S]*overflow:\s*auto/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.quick-tour-actions\s*\{[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.quick-tour-actions\s*\{[\s\S]*position:\s*sticky[\s\S]*bottom:\s*0/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.tutorial-center\s*\{[\s\S]*width:\s*calc\(100% - 12px\)/s);
  assert.match(html, /@media \(max-width: 640px\)[\s\S]*\.first-use-actions\s*\{[\s\S]*display:\s*grid/s);
  assert.match(html, /\.quick-tour-overlay\s*\{[^}]*pointer-events:\s*auto/s);
  assert.match(html, /\.quick-tour-overlay\s*\{[^}]*z-index:\s*1000/s);
  assert.match(html, /\.quick-tour-spotlight\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(html, /\.quick-tour-card\s*\{[^}]*z-index:\s*1002[\s\S]*pointer-events:\s*auto/s);
  assert.match(html, /\.is-tour-target\s*\{[^}]*z-index:\s*auto/s);
  assert.match(html, /max-height:\s*calc\(100dvh - 20px\)/);
});
