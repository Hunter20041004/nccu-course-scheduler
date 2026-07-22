const byId = (id) => document.getElementById(id);
const FIRST_USE_TUTORIAL_SEEN_KEY = 'sunbreak:first-use-tutorial-seen:v1';
const SCHEDULE_VIEW_KEY = 'sunbreak:schedule-view:v1';
const FULL_LIVE_DEMO_URL = 'https://nccu-course-planner-1151.huntertseng.chatgpt.site';
const isStaticFallbackHost = location.hostname.endsWith('github.io');
const apiKeySession = createApiKeySession();
const defaultProfile = {
  level: 'undergrad',
  year: 3,
  programs: [],
  prerequisites: [],
  conditionIds: ['program:innovation'],
  rejectedConditionIds: [],
};

let profile = { ...defaultProfile };
let courseStore = [];
let selected = [];
let courseOptions = {};
let lockedCourseIds = [];
let internshipSettings = { ...DEFAULT_INTERNSHIP_SETTINGS, fixedDays: {} };
let pendingCourses = [];
let lastImportedCourses = [];
let recommendedPlans = [];
let recommendationShortfall = '';
let previewedPlanId = null;
let customConditions = [];
let quickTourIndex = 0;
let expandedCourseId = null;
const MAX_COMPARISON_COURSES = 5;
let comparisonCourseIds = [];
let comparisonSearchQuery = '';
let activeAiTool = 'hub';

const quickTourSteps = [
  { target: 'schedule-panel', compactView: 'schedule', title: '課表總覽', body: '左側使用政大官方節次，會顯示週一到週日、實習保留、課程衝堂、非同步工作區與排課提醒。' },
  { target: 'workspace-panel-catalog', tab: 'catalog', compactView: 'tools', title: '候選課程', body: '每列會顯示課名、教師、課號、學分、時間與資格狀態；點課程主區塊可加入或移出左側課表。' },
  { target: 'catalog-list', tab: 'catalog', compactView: 'tools', title: '查看與管理課程', body: '按「詳細」查看完整詳細資料並切換實體／同步／非同步；已在候選的課可用「更新官方資料」補齊最新官方欄位，並保留選課、鎖定、上課方式與班別安排。課綱與其他管理操作在「•••」。' },
  { target: 'workspace-panel-conditions', tab: 'conditions', compactView: 'tools', title: '選課條件', body: '逐項標記符合、不符合或待確認的系所、雙主修、學程、年級與先修條件，並查看每個條件會影響哪些課。' },
  { target: 'workspace-panel-internship', tab: 'internship', compactView: 'tools', title: '實習設定', body: '設定目標天數與每日時段，再選擇自動找可用時段或指定固定實習時段。' },
  { target: 'ai-feature-hub', tab: 'ai', aiTool: 'hub', compactView: 'tools', title: 'AI 功能', body: '先選擇「AI 排課推薦」或「AI 課綱比較」。兩項 AI 功能共用同一份選填個人資料，在任一頁修改都會立即同步；重新整理後清除。推薦會依最低學分與實習偏好產生三個無衝堂方案；要比較的課必須先加入候選清單，再到比較頁搜尋並勾選 2 至 5 門。' },
  { target: 'workspace-panel-add', tab: 'add', compactView: 'tools', title: '匯入與新增', body: '可搜尋政大 115-1 課程庫、使用 AI 截圖辨識或手動新增課程，也能加入社團、課外組織與個人行程。' },
  { target: 'schedule-grid', compactView: 'schedule', title: '最後檢查與匯出', body: '手機可切換「行程／方格」；確認學分、資格、出席方式、衝堂與提醒後，再匯出手機桌布。' },
];

function openApiKeyDialog() { const dialog = byId('api-key-dialog'); if (!dialog.open) dialog.showModal(); byId('api-key-input').focus(); }
function renderApiKeyState() { const ready = apiKeySession.hasKey(); byId('api-key-status-button').textContent = isStaticFallbackHost ? '靜態分享版' : ready ? '本分頁已連線' : 'API Key 未設定'; byId('api-key-clear').hidden = !ready; }
function requireApiKeyForAi(status) {
  if (isStaticFallbackHost) {
    status.textContent = `GitHub Pages 分享版沒有後端 API；AI 匯入與推薦請改用完整 Live Demo：${FULL_LIVE_DEMO_URL}`;
    return null;
  }
  const apiKey = apiKeySession.getKey();
  if (apiKey) return apiKey;
  status.textContent = '請先貼上自己的 Gemini API Key，再使用 AI 功能。';
  openApiKeyDialog();
  return null;
}
function renderDeploymentCopy() {
  const aiNote = byId('deployment-ai-note');
  const tutorialNote = byId('tutorial-deployment-note');
  const apiKeyNote = byId('api-key-deployment-note');
  if (isStaticFallbackHost) {
    aiNote.textContent = 'GitHub Pages 分享版可測試一般排課與桌布匯出；AI 匯入與推薦請改用完整 Live Demo。';
    tutorialNote.innerHTML = '<strong>Key 安全：</strong>靜態分享版不會接收 Key。一般排課可直接使用；需要 AI 時，請先匯出排課資料，再前往完整版匯入。';
    apiKeyNote.textContent = '目前是靜態分享版，不會接收或驗證 API Key。';
  } else {
    aiNote.textContent = '完整版：AI 會使用你在本分頁設定的 Gemini Key；現有表單與課表在重試時都會保留。';
    tutorialNote.innerHTML = '<strong>Key 安全：</strong>Key 只保留在目前分頁記憶體，不會寫入伺服器、資料庫、網址或瀏覽器長期儲存；關閉或重新整理分頁即清除。';
    apiKeyNote.textContent = '此完整版可以驗證 Key；Key 仍只保留於目前分頁記憶體。';
  }
}
renderDeploymentCopy();
function openFirstUseWelcome() {
  const dialog = byId('first-use-dialog');
  if (!dialog.open) dialog.showModal();
  byId('start-quick-tour').focus();
}
function markFirstUseTutorialSeen() {
  try { localStorage.setItem(FIRST_USE_TUTORIAL_SEEN_KEY, 'true'); } catch {}
}
function closeFirstUseWelcome({ remember = true } = {}) {
  if (remember) {
    markFirstUseTutorialSeen();
  }
  const dialog = byId('first-use-dialog');
  if (dialog.open) dialog.close();
}
function startQuickTour() {
  closeFirstUseWelcome();
  closeTutorialCenter();
  markFirstUseTutorialSeen();
  clearQuickTourTarget();
  quickTourIndex = 0;
  renderQuickTourStep();
}
function endQuickTour({ completed = false } = {}) {
  if (completed) markFirstUseTutorialSeen();
  clearQuickTourTarget();
  byId('quick-tour-overlay').hidden = true;
}
function openTutorialCenter() {
  const dialog = byId('tutorial-center');
  if (!dialog.open) dialog.showModal();
  byId('tutorial-center-close').focus();
}
function closeTutorialCenter() {
  const dialog = byId('tutorial-center');
  if (dialog.open) dialog.close();
}
function clearQuickTourTarget() {
  document.querySelectorAll('.is-tour-target').forEach((item) => item.classList.remove('is-tour-target'));
  byId('quick-tour-spotlight').hidden = true;
}
function positionQuickTourSpotlight(targetElement) {
  const rect = targetElement.getBoundingClientRect();
  const inset = 6;
  const spotlight = byId('quick-tour-spotlight');
  spotlight.hidden = false;
  spotlight.style.setProperty('--tour-x', `${Math.max(8, rect.left - inset)}px`);
  spotlight.style.setProperty('--tour-y', `${Math.max(8, rect.top - inset)}px`);
  spotlight.style.setProperty('--tour-width', `${Math.min(window.innerWidth - 16, rect.width + inset * 2)}px`);
  spotlight.style.setProperty('--tour-height', `${Math.min(window.innerHeight - 16, rect.height + inset * 2)}px`);
}
function renderQuickTourStep() {
  const step = quickTourSteps[quickTourIndex];
  if (step.tab) setWorkspaceTab(step.tab);
  if (step.aiTool) setAiTool(step.aiTool);
  if (step.compactView) setCompactView(step.compactView);
  const overlay = byId('quick-tour-overlay');
  const targetElement = document.getElementById(step.target) || document.querySelector(`.${step.target}`);
  byId('quick-tour-count').textContent = `步驟 ${quickTourIndex + 1} / ${quickTourSteps.length}`;
  byId('quick-tour-title').textContent = step.title;
  byId('quick-tour-body').textContent = step.body;
  byId('quick-tour-prev').disabled = quickTourIndex === 0;
  byId('quick-tour-next').textContent = quickTourIndex === quickTourSteps.length - 1 ? '完成導覽' : '下一步';
  overlay.hidden = false;
  if (targetElement) {
    targetElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    positionQuickTourSpotlight(targetElement);
    targetElement.classList.add('is-tour-target');
  }
}
function goQuickTourStep(offset) {
  clearQuickTourTarget();
  quickTourIndex += offset;
  if (quickTourIndex >= quickTourSteps.length) {
    endQuickTour({ completed: true });
    return;
  }
  quickTourIndex = Math.max(0, quickTourIndex);
  renderQuickTourStep();
}
try {
  if (localStorage.getItem(FIRST_USE_TUTORIAL_SEEN_KEY) !== 'true') openFirstUseWelcome();
} catch {
  openFirstUseWelcome();
}
renderApiKeyState();
byId('open-tutorial-center').addEventListener('click', openTutorialCenter);
byId('open-tutorial-from-welcome').addEventListener('click', () => {
  closeFirstUseWelcome();
  openTutorialCenter();
});
byId('tutorial-center-close').addEventListener('click', closeTutorialCenter);
byId('skip-quick-tour').addEventListener('click', () => closeFirstUseWelcome());
byId('start-quick-tour').addEventListener('click', startQuickTour);
byId('restart-quick-tour').addEventListener('click', startQuickTour);
byId('quick-tour-prev').addEventListener('click', () => goQuickTourStep(-1));
byId('quick-tour-next').addEventListener('click', () => goQuickTourStep(1));
byId('quick-tour-end').addEventListener('click', () => endQuickTour());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !byId('quick-tour-overlay').hidden) endQuickTour();
});
byId('api-key-status-button').addEventListener('click', openApiKeyDialog);
byId('api-key-dialog-close').addEventListener('click', () => byId('api-key-dialog').close());
byId('api-key-skip').addEventListener('click', () => byId('api-key-dialog').close());
byId('api-key-reveal').addEventListener('click', () => { const input = byId('api-key-input'); const reveal = input.type === 'password'; input.type = reveal ? 'text' : 'password'; byId('api-key-reveal').textContent = reveal ? '隱藏' : '顯示'; byId('api-key-reveal').setAttribute('aria-pressed', String(reveal)); });
byId('api-key-clear').addEventListener('click', () => { apiKeySession.clearKey(); renderApiKeyState(); byId('api-key-status').textContent = '已清除本分頁的 API Key。'; });
byId('api-key-form').addEventListener('submit', async (event) => { event.preventDefault(); const input = byId('api-key-input'); const status = byId('api-key-status'); try { await validateAndStoreApiKey({ apiKey: input.value, session: apiKeySession }); input.value = ''; renderApiKeyState(); byId('api-key-dialog').close(); } catch (error) { status.textContent = error.message; } });

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function restoreState() {
  try {
    const saved = parsePlannerState(localStorage.getItem(STORAGE_KEY), null);
    if (!saved) return;
    profile = { ...defaultProfile, ...saved.profile };
    courseStore = createStartupCatalog(saved, courses);
    pendingCourses = Array.isArray(saved.pendingCourses) ? saved.pendingCourses : [];
    customConditions = Array.isArray(saved.customConditions) ? saved.customConditions : [];
    const attendance = saved.attendance || {};
    courseOptions = saved.courseOptions || {};
    lockedCourseIds = saved.lockedCourseIds || [];
    const savedInternship = saved.internshipSettings;
    if (savedInternship && !validateInternshipSettings(savedInternship)) {
      internshipSettings = { ...DEFAULT_INTERNSHIP_SETTINGS, ...savedInternship, fixedDays: savedInternship.fixedDays || {} };
    }
    selected = (saved.selectedIds || [])
      .map((id) => courseStore.find((course) => course.id === id))
      .filter(Boolean)
      .map((course) => ({
        ...resolveCourseOption(course, courseOptions[course.id]),
        attendance: attendance[course.id] || 'physical',
      }));
    lockedCourseIds = lockedCourseIds.filter((id) => selected.some((course) => course.id === id));
  } catch {
    courseStore = [];
    selected = [];
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, serializePlannerState(plannerStateSnapshot()));
  } catch {
    // The planner still works when browser storage is unavailable.
  }
}

function plannerStateSnapshot() {
    const addedCourses = persistedCourseAdditions(courseStore, courses);
    const retainedIds = new Set(courseStore.map((course) => course.id));
    const deletedCourseIds = courses
      .filter((course) => !retainedIds.has(course.id))
      .map((course) => course.id);
    return {
      selectedIds: selected.map((course) => course.id),
      attendance: Object.fromEntries(selected.map((course) => [course.id, course.attendance])),
      courseOptions,
      lockedCourseIds,
      internshipSettings,
      profile,
      addedCourses,
      pendingCourses,
      customConditions,
      deletedCourseIds,
    };
}

function replacePlannerState(snapshot) {
  localStorage.setItem(STORAGE_KEY, serializePlannerState(snapshot));
  profile = { ...defaultProfile };
  courseStore = [];
  selected = [];
  courseOptions = {};
  lockedCourseIds = [];
  internshipSettings = { ...DEFAULT_INTERNSHIP_SETTINGS, fixedDays: {} };
  pendingCourses = [];
  customConditions = [];
  restoreState();
  syncProfileForm();
  syncInternshipForm();
  renderAll();
  renderImportResults();
}

const undo = createPlannerUndo({ ttlMs: 15_000 });
let undoHideTimer;

function hidePlannerUndo() {
  byId('planner-undo-toast').hidden = true;
  clearTimeout(undoHideTimer);
}

function capturePlannerUndo(label) {
  undo.capture(plannerStateSnapshot(), label);
  byId('planner-undo-message').textContent = `${label}。可在 15 秒內復原。`;
  byId('planner-undo-toast').hidden = false;
  clearTimeout(undoHideTimer);
  undoHideTimer = setTimeout(hidePlannerUndo, 15_000);
}

byId('restore-planner-change').addEventListener('click', () => {
  const snapshot = undo.restore();
  if (!snapshot) {
    byId('planner-status').textContent = '復原期限已過，無法回復上一個狀態。';
    hidePlannerUndo();
    return;
  }
  replacePlannerState(snapshot);
  byId('planner-status').textContent = '已復原上一個排課變更。';
  hidePlannerUndo();
});

byId('export-and-open-full').hidden = !isStaticFallbackHost;

function downloadPlannerTransfer() {
  const blob = new Blob([exportPlannerTransfer(plannerStateSnapshot())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sunbreak-planner-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  byId('planner-transfer-status').textContent = '已下載排課資料；檔案不含 API Key、AI 自我介紹或截圖。';
}

byId('export-planner-data').addEventListener('click', downloadPlannerTransfer);
byId('export-and-open-full').addEventListener('click', downloadPlannerTransfer);
byId('header-more-menu').addEventListener('click', (event) => {
  if (event.target.closest('[role="menuitem"]')) byId('header-more-menu').open = false;
});
byId('import-planner-data').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const status = byId('planner-transfer-status');
  const raw = await file.text();
  const preview = previewPlannerTransfer(raw, plannerStateSnapshot());
  if (!preview.valid) {
    status.textContent = preview.error.message;
    event.target.value = '';
    return;
  }
  const { summary } = preview;
  const message = `將匯入 ${summary.addedCourses} 門新課、更新 ${summary.replacedCourses} 門，並略過 ${summary.skippedCourses} 筆重複資料。這會取代目前排課，是否繼續？`;
  if (!window.confirm(message)) {
    status.textContent = '已取消匯入，現在的排課沒有變更。';
    event.target.value = '';
    return;
  }
  capturePlannerUndo('已匯入另一份排課資料');
  const applied = applyPlannerTransfer(preview, plannerStateSnapshot());
  replacePlannerState(applied);
  status.textContent = `匯入完成；目前課表有 ${selected.length} 個項目。`;
  event.target.value = '';
  byId('header-more-menu').open = false;
});

function eligibilityLabel(status) {
  return {
    eligible: '條件符合',
    review: '資格待確認，請看詳細。',
    blocked: '條件不符合，請看詳細。',
    unavailable: '本學期未開課',
  }[status];
}

function errorFromPayload(payload, fallbackMessage) {
  const error = new Error(payload?.error?.message || fallbackMessage);
  error.retryable = Boolean(payload?.error?.retryable);
  error.requestId = payload?.error?.requestId || '';
  return error;
}

function showAiError(status, retryButton, error) {
  const requestReference = error.requestId ? `（編號：${error.requestId}）` : '';
  status.textContent = `${error.message || 'AI 服務暫時無法使用。'}${requestReference}`;
  retryButton.hidden = !error.retryable;
}

function renderStats() {
  const credits = selected.reduce((total, course) => total + Number(course.credits || 0), 0);
  const internshipPlan = calculateInternshipPlan(selected, internshipSettings);
  const progressPercent = internshipSettings.targetDays === 0
    ? 100
    : Math.min(100, Math.round((internshipPlan.confirmedDays / internshipSettings.targetDays) * 100));
  const internshipProgress = byId('internship-progress');
  const conflicts = findConflicts(selected);
  const eligibilityWarnings = selected.filter((course) => evaluateEligibility(course, profile).status !== 'eligible');
  const specialEvents = selected.reduce((total, course) => total + (course.events || []).length, 0);
  const optionWarnings = selected.filter((course) => course.optionStatus === 'pending' || course.optionStatus === 'flexible').length;
  byId('credit-value').textContent = `${credits} 學分`;
  byId('internship-confirmed-value').textContent = String(internshipPlan.confirmedDays);
  byId('internship-pending-value').textContent = String(internshipPlan.pendingDays);
  byId('warning-value').textContent = String(conflicts.length + eligibilityWarnings.length + specialEvents + optionWarnings + internshipPlan.conflicts.length);
  internshipProgress.style.setProperty('--internship-progress', `${progressPercent}%`);
  internshipProgress.setAttribute('aria-valuenow', String(progressPercent));
  document.querySelector('.status-pill').textContent = internshipPlan.tentative
    ? '實習時間待確認'
    : (internshipPlan.meetsTarget ? '實習時間達標' : '實習時間不足');
}

function meetingsForCourse(course) {
  if (course.attendance === 'async') return [];
  if (course.meetings?.length) return course.meetings;
  return course.schedule ? [course.schedule] : [];
}

function gridCourseBlock(course, meeting, conflictingIds) {
  const placement = gridPlacement(meeting);
  if (!placement) return '';
  const required = course.required;
  const locked = lockedCourseIds.includes(course.id);
  const stateClasses = [
    required ? 'is-required' : '',
    locked ? 'is-locked' : '',
    course.itemType ? `is-${course.itemType}` : '',
    conflictingIds.has(course.id) ? 'has-conflict' : '',
  ].filter(Boolean).join(' ');
  return `<article class="grid-course ${stateClasses}" data-grid-course="${escapeHtml(course.id)}" role="cell" style="--grid-column:${meeting.day + 1};--grid-row:${placement.rowStart};--row-span:${placement.rowSpan}">
    <button type="button" data-remove-course="${escapeHtml(course.id)}" ${locked ? 'disabled' : ''} aria-label="${locked ? '已鎖定' : '移除'} ${escapeHtml(course.title)}">
      <strong>${escapeHtml(course.title)}</strong>
      <span>${escapeHtml(formatNccuSchedule(meeting, dayLabels))}</span>
      <small>${escapeHtml(course.sectionCode || '')}${locked ? ' · 已鎖定' : ' · 點擊移除'}</small>
    </button>
  </article>`;
}

function formatMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function internshipBlock(window, conflicted) {
  const placement = gridPlacement(window);
  if (!placement) return '';
  const label = { full: '全天實習', morning: '上午實習', afternoon: '下午實習' }[window.mode];
  return `<div class="internship-reservation ${conflicted ? 'has-conflict' : ''}" role="cell" style="--grid-column:${window.day + 1};--grid-row:${placement.rowStart};--row-span:${placement.rowSpan}">
    <strong>${label}</strong><small>${formatMinutes(window.start)}–${formatMinutes(window.end)}</small>
  </div>`;
}

function renderSchedule() {
  const conflicts = findConflicts(selected);
  const conflictingIds = new Set(conflicts.flatMap(({ courseIds }) => courseIds));
  const headers = ['節次', ...dayLabels.slice(1, 8)].map((label, index) => (
    `<div class="weekday-header" role="columnheader" style="--grid-column:${index + 1}">${escapeHtml(label)}</div>`
  )).join('');
  const periodRows = NCCU_PERIODS.map((period, index) => `<div class="period-label ${period.special ? 'is-special' : ''}" data-period-code="${period.code}" role="rowheader" style="--grid-row:${index + 2}">
      <strong>${period.code}</strong><small>${period.time}</small>
    </div>${[1, 2, 3, 4, 5, 6, 7].map((day) => `<div class="grid-cell" role="cell" style="--grid-column:${day + 1};--grid-row:${index + 2}"></div>`).join('')}`
  ).join('');
  const courseBlocks = selected.flatMap((course) => meetingsForCourse(course)
    .map((meeting) => gridCourseBlock(course, meeting, conflictingIds))).join('');
  const internshipPlan = calculateInternshipPlan(selected, internshipSettings);
  const conflictedWindows = new Set(internshipPlan.conflicts.map(({ window }) => window));
  const internshipBlocks = internshipPlan.displayWindows
    .map((window) => internshipBlock(window, conflictedWindows.has(window))).join('');
  byId('schedule-grid').innerHTML = headers + periodRows + internshipBlocks + courseBlocks;

  const agenda = buildScheduleAgenda(selected);
  byId('schedule-agenda').innerHTML = agenda.days.length
    ? agenda.days.map(({ day, items }) => `<section class="agenda-day">
        <h3><span>${escapeHtml(dayLabels[day])}</span><small>${items.length} 個時段</small></h3>
        <div class="agenda-day-items">${items.map((item) => {
          const locked = lockedCourseIds.includes(item.courseId);
          return `<button type="button" data-remove-course="${escapeHtml(item.courseId)}" ${locked ? 'disabled' : ''} aria-label="${locked ? '已鎖定' : '移除'} ${escapeHtml(item.title)}">
            <time>${escapeHtml(formatMinutes(item.start))}<small>${escapeHtml(formatMinutes(item.end))}</small></time>
            <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.sectionCode || item.label || '固定時段')}${locked ? ' · 已鎖定' : ' · 點擊移除'}</small></span>
          </button>`;
        }).join('')}</div>
      </section>`).join('')
    : '<div class="agenda-empty"><strong>這週還沒有固定時段</strong><p>從右側候選課程加入課表後，會依星期與時間排列在這裡。</p></div>';

  const asynchronous = selected.filter((course) => course.attendance === 'async' || !meetingsForCourse(course).length);
  byId('async-lane').innerHTML = asynchronous.length
    ? `<div class="async-list">${asynchronous.map((course) => `<button type="button" data-remove-course="${escapeHtml(course.id)}">${escapeHtml(course.title)} · ${course.attendance === 'async' ? '非同步' : '時間未定'}</button>`).join('')}</div>`
    : '<p class="empty">目前沒有非同步或時間未定課程</p>';
}

const compactScheduleMedia = window.matchMedia('(max-width: 640px)');
function setScheduleView(view, { persist = false } = {}) {
  const panel = document.querySelector('.schedule-panel');
  panel.dataset.scheduleView = view;
  byId('schedule-view-switch').querySelectorAll('[data-schedule-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.scheduleView === view));
  });
  if (persist) {
    try { localStorage.setItem(SCHEDULE_VIEW_KEY, view); } catch {}
  }
}
let savedScheduleView;
try { savedScheduleView = localStorage.getItem(SCHEDULE_VIEW_KEY); } catch {}
setScheduleView(['agenda', 'grid'].includes(savedScheduleView)
  ? savedScheduleView
  : compactScheduleMedia.matches ? 'agenda' : 'grid');
byId('schedule-view-switch').addEventListener('click', (event) => {
  const button = event.target.closest('[data-schedule-view]');
  if (button) setScheduleView(button.dataset.scheduleView, { persist: true });
});

function collectScheduleReminders() {
  const items = findConflicts(selected).map((conflict) => conflict.message);
  const internshipPlan = calculateInternshipPlan(selected, internshipSettings);
  internshipPlan.conflicts.forEach((conflict) => {
    items.push(`${dayLabels[conflict.window.day]}實習時段與 ${conflict.courseTitle} 重疊`);
  });
  if (internshipPlan.tentative) items.push('有實體課程尚未選定時段，實習可用天數目前為暫估。');
  selected.forEach((course) => {
    const eligibility = evaluateEligibility(course, profile);
    if (eligibility.status !== 'eligible') items.push(`${course.title}：${eligibility.reasons.join('、')}`);
    if (course.optionStatus === 'pending' || course.optionStatus === 'flexible') {
      items.push(`${course.title}：${course.optionMessage}`);
    }
    (course.events || []).forEach((event) => items.push(`${course.title}：${event.date} ${event.label}`));
  });
  return items;
}

function renderWarnings() {
  const items = collectScheduleReminders();
  byId('warning-list').innerHTML = items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="empty">目前沒有需要處理的提醒。</p>';
}

function canvasRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, fill, stroke = null) {
  canvasRoundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || '').split('');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const nextLine = `${line}${word}`;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visible[maxLines - 1] = `${visible[maxLines - 1].slice(0, Math.max(0, visible[maxLines - 1].length - 1))}…`;
  }
  visible.forEach((row, index) => ctx.fillText(row, x, y + (index * lineHeight)));
  return visible.length * lineHeight;
}

function drawWallpaperStat(ctx, label, value, x, y, width) {
  fillRoundRect(ctx, x, y, width, 92, 18, '#FFFFFF', '#DAD7E2');
  ctx.fillStyle = '#5E5B68';
  ctx.font = '700 24px "Noto Sans TC", sans-serif';
  ctx.fillText(label, x + 22, y + 34);
  ctx.fillStyle = '#211F26';
  ctx.font = '800 34px "Noto Sans TC", sans-serif';
  ctx.fillText(String(value), x + 22, y + 72);
}

const dreamcoreWallpaper = {
  paper: '#F9F7FB',
  mistLavender: '#ECE7F7',
  dawnViolet: '#D7CCF0',
  sunHalo: '#F8DFA8',
  warmCloud: '#FFF8EA',
  glass: 'rgba(255, 255, 255, 0.78)',
  glassLine: 'rgba(110, 70, 184, 0.16)',
  mistLine: 'rgba(110, 70, 184, 0.10)',
  dreamInk: '#211F26',
  dreamMuted: '#696371',
};

function drawDreamcoreOrb(ctx, x, y, radius, colorStop, transparentStop) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colorStop);
  gradient.addColorStop(1, transparentStop);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawDreamcoreBackdrop(ctx, canvas, colors, safeX, safeTop) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colors.paper);
  gradient.addColorStop(0.48, colors.warmCloud);
  gradient.addColorStop(1, colors.mistLavender);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  drawDreamcoreOrb(ctx, canvas.width - safeX - 126, safeTop - 26, 180, 'rgba(248, 223, 168, 0.48)', 'rgba(248, 223, 168, 0)');
  drawDreamcoreOrb(ctx, canvas.width - safeX - 266, safeTop + 18, 150, 'rgba(255, 255, 255, 0.68)', 'rgba(255, 255, 255, 0)');
  drawDreamcoreOrb(ctx, safeX + 90, canvas.height - 420, 260, 'rgba(110, 70, 184, 0.10)', 'rgba(110, 70, 184, 0)');
  drawDreamcoreOrb(ctx, canvas.width - safeX - 40, canvas.height - 320, 220, 'rgba(36, 70, 216, 0.08)', 'rgba(36, 70, 216, 0)');
  ctx.restore();
}

function drawGlassPanel(ctx, x, y, width, height, radius, colors) {
  ctx.save();
  ctx.shadowColor = 'rgba(110, 70, 184, 0.10)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  fillRoundRect(ctx, x, y, width, height, radius, colors.glass, colors.glassLine);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.54;
  const shine = ctx.createLinearGradient(x, y, x + width, y + height);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.74)');
  shine.addColorStop(0.42, 'rgba(255, 255, 255, 0.16)');
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  fillRoundRect(ctx, x + 1, y + 1, width - 2, height - 2, radius - 1, shine);
  ctx.restore();
}

function drawMistDivider(ctx, x1, y1, x2, y2, colors) {
  ctx.save();
  ctx.strokeStyle = colors.mistLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function wallpaperCourseColor(course, conflictingIds) {
  if (conflictingIds.has(course.id)) return { fill: 'rgba(252, 236, 234, 0.86)', stroke: 'rgba(180, 56, 48, 0.58)', text: '#211F26' };
  if (course.itemType === 'club') return { fill: 'rgba(255, 244, 216, 0.84)', stroke: 'rgba(200, 139, 46, 0.48)', text: '#211F26' };
  if (course.itemType === 'personal') return { fill: 'rgba(238, 241, 255, 0.82)', stroke: 'rgba(36, 70, 216, 0.44)', text: '#211F26' };
  return { fill: 'rgba(242, 236, 250, 0.84)', stroke: 'rgba(110, 70, 184, 0.46)', text: '#211F26' };
}

function renderScheduleWallpaper(canvas) {
  canvas.width = 1170;
  canvas.height = 2532;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const safeX = 96;
  const safeTop = 164;
  const safeBottom = 176;
  const contentWidth = canvas.width - (safeX * 2);
  const colors = {
    ...dreamcoreWallpaper,
    canvas: '#F7F6FA',
    surface: '#FFFFFF',
    ink: '#211F26',
    muted: '#5E5B68',
    line: '#DAD7E2',
    blue: '#2446D8',
    violet: '#6E46B8',
    sun: '#E7A43A',
    sunSoft: '#FFF4D8',
  };
  drawDreamcoreBackdrop(ctx, canvas, colors, safeX, safeTop);

  ctx.fillStyle = colors.violet;
  ctx.font = '800 22px "Noto Sans TC", sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('NCCU · 115-1 · SUNBREAK', safeX, safeTop);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = colors.ink;
  ctx.font = '800 58px Georgia, "Noto Serif TC", serif';
  ctx.fillText('我的課表', safeX, safeTop + 76);
  ctx.fillStyle = colors.dreamMuted;
  ctx.font = '700 19px "Noto Sans TC", sans-serif';
  ctx.fillText('雨後日光 · 輕夢核課表', safeX, safeTop + 112);

  const internshipPlan = calculateInternshipPlan(selected, internshipSettings);
  const reminders = collectScheduleReminders();

  const gridX = safeX;
  const gridY = safeTop + 148;
  const periodWidth = 78;
  const dayWidth = (contentWidth - periodWidth) / 7;
  const headerHeight = 62;
  const periodHeight = 72;
  const gridWidth = periodWidth + (dayWidth * 7);
  const gridHeight = headerHeight + (periodHeight * NCCU_PERIODS.length);
  drawGlassPanel(ctx, gridX, gridY, gridWidth, gridHeight, 30, colors);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  fillRoundRect(ctx, gridX + 10, gridY + 10, gridWidth - 20, headerHeight - 10, 18, 'rgba(255, 255, 255, 0.58)');
  ctx.fillStyle = colors.muted;
  ctx.font = '800 24px "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  dayLabels.slice(1, 8).forEach((label, index) => {
    ctx.fillText(label.replace('週', ''), gridX + periodWidth + (index * dayWidth) + (dayWidth / 2), gridY + 45);
  });

  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  NCCU_PERIODS.forEach((period, index) => {
    const y = gridY + headerHeight + (index * periodHeight);
    drawMistDivider(ctx, gridX + 14, y, gridX + gridWidth - 14, y, colors);
    ctx.fillStyle = period.special ? colors.violet : colors.ink;
    ctx.font = '800 26px "Noto Sans TC", sans-serif';
    ctx.fillText(period.code, gridX + 39, y + 38);
    ctx.fillStyle = colors.muted;
    ctx.font = '600 13px "Noto Sans TC", sans-serif';
    ctx.fillText(period.time.replace('–', '-'), gridX + 39, y + 56);
  });
  for (let day = 0; day <= 7; day += 1) {
    const x = gridX + periodWidth + (day * dayWidth);
    drawMistDivider(ctx, x, gridY + 14, x, gridY + gridHeight - 14, colors);
  }

  const conflicts = findConflicts(selected);
  const conflictingIds = new Set(conflicts.flatMap(({ courseIds }) => courseIds));
  const conflictedWindows = new Set(internshipPlan.conflicts.map(({ window }) => window));
  internshipPlan.displayWindows.forEach((window) => {
    const placement = gridPlacement(window);
    if (!placement) return;
    const x = gridX + periodWidth + ((window.day - 1) * dayWidth) + 6;
    const y = gridY + headerHeight + ((placement.rowStart - 2) * periodHeight) + 4;
    const height = Math.max(44, (placement.rowSpan * periodHeight) - 8);
    fillRoundRect(ctx, x, y, dayWidth - 12, height, 16, conflictedWindows.has(window) ? 'rgba(252, 236, 234, 0.82)' : 'rgba(238, 241, 255, 0.76)', conflictedWindows.has(window) ? 'rgba(180, 56, 48, 0.58)' : 'rgba(36, 70, 216, 0.42)');
    ctx.fillStyle = conflictedWindows.has(window) ? '#B43830' : '#1736A3';
    ctx.textAlign = 'left';
    ctx.font = '800 19px "Noto Sans TC", sans-serif';
    ctx.fillText({ full: '實習', morning: '上午實習', afternoon: '下午實習' }[window.mode], x + 12, y + 28);
    ctx.font = '700 14px "Noto Sans TC", sans-serif';
    ctx.fillText(`${formatMinutes(window.start)}-${formatMinutes(window.end)}`, x + 12, y + 50);
  });

  selected.forEach((course) => {
    meetingsForCourse(course).forEach((meeting) => {
      const placement = gridPlacement(meeting);
      if (!placement) return;
      const x = gridX + periodWidth + ((meeting.day - 1) * dayWidth) + 6;
      const y = gridY + headerHeight + ((placement.rowStart - 2) * periodHeight) + 4;
      const height = Math.max(44, (placement.rowSpan * periodHeight) - 8);
      const color = wallpaperCourseColor(course, conflictingIds);
      ctx.lineWidth = conflictingIds.has(course.id) ? 4 : 2;
      ctx.save();
      ctx.shadowColor = 'rgba(110, 70, 184, 0.10)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      fillRoundRect(ctx, x, y, dayWidth - 12, height, 16, color.fill, color.stroke);
      ctx.restore();
      ctx.fillStyle = color.text;
      ctx.textAlign = 'left';
      ctx.font = '800 19px "Noto Sans TC", sans-serif';
      drawWrappedText(ctx, course.title, x + 12, y + 30, dayWidth - 34, 23, Math.max(1, Math.floor((height - 34) / 23)));
      ctx.fillStyle = colors.muted;
      ctx.font = '700 14px "Noto Sans TC", sans-serif';
      ctx.fillText(course.sectionCode || '', x + 12, y + height - 14);
    });
  });

  const asyncCourses = selected.filter((course) => course.attendance === 'async' || !meetingsForCourse(course).length);
  const infoY = gridY + gridHeight + 72;
  const infoHeight = Math.min(460, canvas.height - safeBottom - infoY);
  const gap = 28;
  const cardWidth = (contentWidth - gap) / 2;
  drawGlassPanel(ctx, safeX, infoY, cardWidth, infoHeight, 28, colors);
  drawGlassPanel(ctx, safeX + cardWidth + gap, infoY, cardWidth, infoHeight, 28, colors);
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.ink;
  ctx.font = '800 34px Georgia, "Noto Serif TC", serif';
  ctx.fillText('非同步與時間未定', safeX + 34, infoY + 64);
  ctx.font = '800 30px Georgia, "Noto Serif TC", serif';
  ctx.fillText('排課提醒', safeX + cardWidth + gap + 34, infoY + 64);
  ctx.fillStyle = colors.muted;
  ctx.font = '700 24px "Noto Sans TC", sans-serif';
  const asyncList = asyncCourses.length ? asyncCourses.map((course) => `${course.title} · ${course.attendance === 'async' ? '非同步' : '時間未定'}`) : ['目前沒有非同步或時間未定課程'];
  asyncList.slice(0, 7).forEach((item, index) => drawWrappedText(ctx, item, safeX + 34, infoY + 112 + (index * 42), cardWidth - 68, 29, 1));
  const reminderList = reminders.length ? reminders : ['目前沒有需要處理的提醒'];
  reminderList.slice(0, 8).forEach((item, index) => drawWrappedText(ctx, item, safeX + cardWidth + gap + 34, infoY + 112 + (index * 38), cardWidth - 68, 27, 1));
  return canvas;
}

function downloadCanvasPng(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.append(link);
  link.click();
  link.remove();
}

function exportScheduleWallpaper() {
  const canvas = document.createElement('canvas');
  renderScheduleWallpaper(canvas);
  downloadCanvasPng(canvas, 'nccu-schedule-wallpaper-115-1.png');
  byId('planner-status').textContent = '手機桌布已匯出。';
}

function syllabusStateForCourse(course) {
  if (course.syllabus) return course.syllabus;
  const legacyUrl = trustedOfficialSyllabusUrl(course);
  return officialSyllabusState({
    sourceUrl: legacyUrl,
    lookupStatus: legacyUrl ? 'success' : 'legacy',
    checkedAt: null,
  });
}

function syllabusAction(course) {
  if (course.source === 'manual') {
    return '<button class="catalog-syllabus" type="button" role="menuitem" disabled>手動課程沒有連結官方課綱</button>';
  }
  const syllabus = syllabusStateForCourse(course);
  if (syllabus.status === 'available') {
    return `<a class="catalog-syllabus" href="${escapeHtml(syllabus.url)}" target="_blank" rel="noopener noreferrer" role="menuitem">查看課綱</a>`;
  }
  if (syllabus.status === 'not_uploaded') {
    return '<button class="catalog-syllabus" type="button" role="menuitem" disabled>老師尚未上傳課綱</button>';
  }
  return `<button class="catalog-syllabus" type="button" role="menuitem" data-refresh-nccu-course="${escapeHtml(course.sectionCode || '')}">課綱狀態暫時無法確認 · 重新查詢官方資料</button>`;
}

function currentCatalogFilters() {
  return {
    query: byId('catalog-search').value,
    statuses: [...document.querySelectorAll('[data-catalog-status-filter]:checked')]
      .map((input) => input.dataset.catalogStatusFilter),
    weekdays: [...document.querySelectorAll('[data-catalog-day-filter]:checked')]
      .map((input) => Number(input.dataset.catalogDayFilter)),
    dayparts: [...document.querySelectorAll('[data-catalog-daypart-filter]:checked')]
      .map((input) => input.dataset.catalogDaypartFilter),
    selectedIds: selected.map(({ id }) => id),
    attendanceByCourse: Object.fromEntries(selected.map(({ id, attendance }) => [id, attendance])),
    eligibilityStatuses: Object.fromEntries(courseStore.map((course) => [
      course.id,
      evaluateEligibility(course, profile).status,
    ])),
  };
}

function renderCourseComparisonPicker() {
  comparisonCourseIds = reconcileComparisonCourseIds(comparisonCourseIds, courseStore);
  const count = comparisonCourseIds.length;
  const limitReached = comparisonCourseIds.length >= MAX_COMPARISON_COURSES;
  const visibleCourses = filterComparisonCourses(courseStore, comparisonSearchQuery);
  const list = byId('comparison-course-list');
  byId('comparison-course-search').value = comparisonSearchQuery;
  byId('comparison-selected-count').textContent = `已選 ${count}／${MAX_COMPARISON_COURSES}`;
  byId('course-comparison-status').textContent = count < 2
    ? `再選 ${2 - count} 門就能開始比較。`
    : limitReached
      ? `已選滿 ${MAX_COMPARISON_COURSES} 門；若要更換，請先取消一門。`
      : `已選 ${count} 門，可以開始比較。`;
  byId('run-ai-comparison').disabled = count < 2;
  byId('open-chatgpt-comparison').disabled = count < 2;
  byId('clear-course-comparison').disabled = count === 0;
  list.innerHTML = !courseStore.length
    ? '<div class="comparison-picker-empty"><strong>尚無候選課程</strong><p>請先到「匯入／新增」加入課程。</p><button class="button button-quiet" type="button" data-open-add-panel>前往匯入／新增</button></div>'
    : !visibleCourses.length
      ? '<p class="comparison-picker-empty">找不到符合的候選課程，請調整關鍵字。</p>'
      : visibleCourses.map((course) => {
          const checked = comparisonCourseIds.includes(course.id);
          const disabled = limitReached && !checked;
          return `<label class="comparison-picker-course ${checked ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}">
            <input type="checkbox" data-comparison-course="${escapeHtml(course.id)}" aria-label="選擇 ${escapeHtml(course.title)}進行課綱比較" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
            <span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.sectionCode || '—')} · ${escapeHtml(course.teacher || '—')}</small><small>${escapeHtml(candidateScheduleSummary(course, dayLabels))}</small></span>
            <b>${course.credits} 學分</b>
          </label>`;
        }).join('');
}

function comparisonRequestBody() {
  return {
    ...readSharedAiProfile(),
    courses: comparisonCourseIds.map((id) => {
      const course = selected.find((item) => item.id === id)
        || courseStore.find((item) => item.id === id);
      const syllabus = syllabusStateForCourse(course);
      return {
        id: course.id,
        sectionCode: course.sectionCode,
        title: course.title,
        teacher: course.teacher,
        credits: course.credits,
        syllabusUrl: syllabus.status === 'available' ? syllabus.url : '',
        schedule: course.schedule,
        meetings: meetingsForCourse(course),
        conditions: (course.conditions || []).map((condition) => (
          typeof condition === 'string' ? condition : condition.label || condition.description || condition.id
        )).filter(Boolean),
      };
    }),
  };
}

function comparisonCourseTitle(id) {
  return courseStore.find((course) => course.id === id)?.title || id;
}

function comparisonConflictText(conflict) {
  const titles = (conflict.courseIds || []).map(comparisonCourseTitle).join(' × ');
  return [titles, conflict.label || conflict.message || '固定時段重疊'].filter(Boolean).join(' · ');
}

function renderCourseComparison(payload) {
  const results = byId('ai-comparison-results');
  const personalized = payload.profileMode === 'personalized' && payload.personalized?.used;
  const profileNotice = personalized
    ? `<section class="comparison-context is-personalized"><strong>個人化建議</strong><p>已讀取你選填的學期目標、未來方向與排課偏好。${escapeHtml(payload.personalized?.reason || '')}</p></section>`
    : '<section class="comparison-context"><strong>客觀比較</strong><p>這次未使用個人資料，只根據官方課綱與固定時段比較。建議填寫上方選填資料，取捨建議會更精準。</p></section>';
  const conflicts = payload.conflicts?.length
    ? `<section class="comparison-conflicts" role="alert"><h4>確定性衝堂</h4><ul>${payload.conflicts.map((conflict) => `<li>${escapeHtml(comparisonConflictText(conflict))}</li>`).join('')}</ul></section>`
    : '<section class="comparison-no-conflict"><strong>固定時段沒有衝堂</strong><span>仍請核對特殊日期與考試資訊。</span></section>';
  const sharedTopics = payload.overlap?.sharedTopics?.length
    ? `<ul class="comparison-topic-list">${payload.overlap.sharedTopics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join('')}</ul>`
    : '<p>課綱未提供足夠共同主題。</p>';
  const courseCards = (payload.courses || []).map((item) => {
    const source = payload.sources?.find(({ id }) => id === item.id);
    const sourceLink = source?.status === 'available' && source.url
      ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">查看官方課綱</a>`
      : '<span>官方課綱暫時無法讀取</span>';
    return `<article class="comparison-course-card">
      <header><h4>${escapeHtml(comparisonCourseTitle(item.id))}</h4>${sourceLink}</header>
      <dl>
        <div><dt>課程重點</dt><dd>${escapeHtml(item.focus)}</dd></div>
        <div><dt>獨有價值</dt><dd>${escapeHtml(item.uniqueValue)}</dd></div>
        <div><dt>評量方式</dt><dd>${escapeHtml(item.assessment)}</dd></div>
        <div><dt>預估負擔</dt><dd>${escapeHtml(item.workload)}</dd></div>
      </dl>
    </article>`;
  }).join('');
  const recommendedTitles = (payload.recommendation?.courseIds || []).map(comparisonCourseTitle);
  const recommendation = recommendedTitles.length
    ? `<strong>建議優先：${escapeHtml(recommendedTitles.join('、'))}</strong>`
    : '<strong>目前證據不足，不替你硬選</strong>';
  const limitations = payload.limitations?.length
    ? `<ul>${payload.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>目前沒有額外資料限制。</p>';
  results.innerHTML = `${profileNotice}
    ${conflicts}
    <section class="comparison-overlap">
      <div><p class="eyebrow">內容重疊</p><strong>${escapeHtml(payload.overlap?.level || '未判定')} · ${Number(payload.overlap?.score || 0)}%</strong></div>
      <div class="comparison-meter" role="progressbar" aria-label="課程內容重疊程度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(payload.overlap?.score || 0)}"><span style="--comparison-score:${Number(payload.overlap?.score || 0)}%"></span></div>
      ${sharedTopics}
    </section>
    <section class="comparison-course-section"><h4>各課獨有價值</h4><div class="comparison-course-grid">${courseCards}</div></section>
    <section class="comparison-recommendation">${recommendation}<p>${escapeHtml(payload.recommendation?.reason || payload.summary || '')}</p><small>信心程度：${escapeHtml(payload.recommendation?.confidence || 'low')}</small></section>
    <section class="comparison-limitations"><h4>資料限制</h4>${limitations}</section>`;
}

function showChatGptComparisonRecovery(prompt, message) {
  const recovery = byId('chatgpt-comparison-recovery');
  recovery.hidden = false;
  byId('chatgpt-comparison-prompt').value = prompt;
  byId('chatgpt-comparison-status').textContent = message;
}

function cacheComparisonSources(sources) {
  const available = new Map((sources || [])
    .filter((source) => source.status === 'available' && source.url)
    .map((source) => [source.id, source.url]));
  if (!available.size) return;
  const enrich = (courseList) => courseList.map((course) => {
    const url = available.get(course.id);
    if (!url) return course;
    const isSeedCourse = courses.some((seedCourse) => seedCourse.id === course.id);
    return {
      ...course,
      source: isSeedCourse ? 'nccu-verified-import' : course.source,
      sourceUrl: url,
      syllabus: {
        status: 'available',
        url,
        lookupStatus: 'success',
        checkedAt: new Date().toISOString(),
      },
    };
  });
  courseStore = enrich(courseStore);
  selected = enrich(selected);
  persistState();
}

function renderCatalogFilterCount(filters) {
  const count = countActiveCatalogFilters(filters);
  const badge = byId('catalog-filter-count');
  const toggle = byId('catalog-filter-toggle');
  badge.textContent = String(count);
  badge.hidden = count === 0;
  badge.setAttribute('aria-label', count ? `目前套用 ${count} 個複選條件` : '目前沒有套用複選條件');
  toggle.classList.toggle('has-active-filters', count > 0);
}

function renderCatalog() {
  const catalogList = byId('catalog-list');
  const filters = currentCatalogFilters();
  const visible = filterCandidateCourses(courseStore, filters);
  renderCatalogFilterCount(filters);
  byId('catalog-count').textContent = `${visible.length} / ${courseStore.length}`;
  if (!visible.length) {
    catalogList.innerHTML = courseStore.length
      ? '<div class="catalog-empty"><strong>沒有符合目前篩選的課程</strong><p>調整搜尋文字或篩選條件後再試一次。</p></div>'
      : '<div class="catalog-empty"><strong>建立你的候選課程</strong><p>前往「匯入／新增」，從政大課程庫、AI 截圖或手動輸入加入第一門課。</p><button class="button button-primary" type="button" data-open-add-panel>前往匯入／新增</button></div>';
    return;
  }
  catalogList.innerHTML = visible.map((course) => {
    const eligibility = evaluateEligibility(course, profile);
    const selectedNow = selected.some((item) => item.id === course.id);
    const selectedCourse = selected.find((item) => item.id === course.id);
    const scheduleSummary = candidateScheduleSummary(selectedCourse || course, dayLabels);
    const syllabus = syllabusStateForCourse(course);
    const syllabusUrl = syllabus.status === 'available' ? syllabus.url : '';
    const showsSyllabus = course.source !== 'manual' || course.itemType === 'course';
    const syllabusMenuAction = showsSyllabus ? syllabusAction(course) : '';
    const locked = lockedCourseIds.includes(course.id);
    const blocked = eligibility.status === 'blocked' || eligibility.status === 'unavailable';
    const attendance = selectedNow && course.asyncAllowed
      ? `<label class="attendance-control"><span>實體／同步／非同步</span><select data-attendance-course="${escapeHtml(course.id)}" aria-label="${escapeHtml(course.title)} 出席方式"><option value="physical" ${selectedCourse.attendance === 'physical' ? 'selected' : ''}>實體</option><option value="sync" ${selectedCourse.attendance === 'sync' ? 'selected' : ''}>同步</option><option value="async" ${selectedCourse.attendance === 'async' ? 'selected' : ''}>非同步</option></select></label>`
      : '';
    const conditions = course.conditions || [];
    const sections = course.sections || [];
    const sectionLabels = sections.map((section) => typeof section === 'string'
      ? section
      : `${section.sectionCode || section.id}｜${section.teacher || '教師待確認'}｜${section.schedule?.label || '依選定安排'}`);
    const expanded = expandedCourseId === course.id;
    const detailTrigger = `<button class="catalog-details-trigger" type="button" data-details-course="${escapeHtml(course.id)}" aria-expanded="${expanded}" aria-controls="course-details-${escapeHtml(course.id)}" aria-label="查看 ${escapeHtml(course.title)} 的完整資料">詳細</button>`;
    const sourceLabel = course.source === 'nccu-verified-import'
      ? '政大 115-1 課程庫'
      : course.source === 'manual'
        ? '手動新增'
        : course.source || '內建課程資料';
    const deliveryLabel = selectedCourse?.attendance === 'async'
      ? '非同步'
      : course.asyncAllowed ? '可切換實體／同步／非同步' : '實體／固定同步';
    const detailPanel = expanded ? `<section class="course-details-panel" id="course-details-${escapeHtml(course.id)}" aria-label="${escapeHtml(course.title)} 完整資料">
      <header class="course-details-heading">
        <div><p>COURSE DETAILS</p><h3>${escapeHtml(course.title)}</h3></div>
        <span>${escapeHtml(eligibilityLabel(eligibility.status))}</span>
      </header>
      <dl class="course-details-facts">
        <div><dt>課程名稱</dt><dd>${escapeHtml(course.title || '未提供')}</dd></div>
        <div><dt>課號</dt><dd>${escapeHtml(course.sectionCode || '未提供')}</dd></div>
        <div><dt>授課教師</dt><dd>${escapeHtml(course.teacher || '未提供')}</dd></div>
        <div><dt>學分</dt><dd>${Number(course.credits) || 0} 學分</dd></div>
        <div><dt>上課時間</dt><dd>${escapeHtml(scheduleSummary)}</dd></div>
        <div><dt>上課形式</dt><dd>${escapeHtml(deliveryLabel)}</dd></div>
        <div><dt>修課資格</dt><dd>${escapeHtml(eligibilityLabel(eligibility.status))}</dd></div>
        <div><dt>資料來源</dt><dd>${escapeHtml(sourceLabel)}</dd></div>
      </dl>
      <div class="course-details-sections">
        <section>
          <h4>資格說明</h4>
          ${eligibility.reasons.length ? `<ul class="course-conditions">${eligibility.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : '<p>目前條件符合。</p>'}
        </section>
        <section>
          <h4>選課條件與官方備註</h4>
          ${conditions.length ? `<ul class="course-conditions">${conditions.map((condition) => `<li>${escapeHtml(condition)}</li>`).join('')}</ul>` : '<p>目前沒有額外限制。</p>'}
        </section>
        <section>
          <h4>官方班別與時段</h4>
          ${sectionLabels.length ? `<ul class="course-sections">${sectionLabels.map((section) => `<li>${escapeHtml(section)}</li>`).join('')}</ul>` : `<p>${escapeHtml(scheduleSummary)}</p>`}
        </section>
      </div>
      <footer class="course-details-footer">
        ${syllabusUrl
          ? `<a href="${escapeHtml(syllabusUrl)}" target="_blank" rel="noopener noreferrer">開啟官方課綱</a>`
          : syllabus.status === 'not_uploaded'
            ? '<span>老師尚未上傳課綱</span>'
            : course.source === 'manual'
              ? '<span>手動課程沒有連結官方課綱</span>'
              : `<button class="course-details-refresh" type="button" data-refresh-nccu-course="${escapeHtml(course.sectionCode || '')}">課綱狀態暫時無法確認 · 重新查詢官方資料</button>`}
      </footer>
    </section>` : '';
    const atomicSections = sections.filter((section) => section && typeof section === 'object');
    const selectedSection = atomicSections.find(({ id }) => id === selectedCourse?.selectedSectionId);
    const sectionChoices = selectedSection?.arrangements || selectedSection?.advisorOptions || [];
    const choiceKind = selectedSection?.arrangements?.length ? 'arrangement' : 'advisor';
    const selectedVariant = selectedCourse?.variants?.find(({ id }) => id === selectedCourse.selectedVariantId);
    const atomicOptionControls = selectedNow && atomicSections.length
      ? `<div class="course-option-controls">
          <label>正式課號<select data-course-section="${escapeHtml(course.id)}">
            <option value="">請選擇</option>
            ${atomicSections.map((section) => `<option value="${escapeHtml(section.id)}" ${selectedCourse?.selectedSectionId === section.id ? 'selected' : ''}>${escapeHtml(section.sectionCode || section.id)} · ${escapeHtml(section.teacher || '教師待確認')}</option>`).join('')}
          </select></label>
          ${sectionChoices.length ? `<label>${escapeHtml(selectedSection.selectionLabel || (choiceKind === 'arrangement' ? '時間安排' : '指導老師與時段'))}<select data-course-${choiceKind}="${escapeHtml(course.id)}">
            <option value="">請選擇</option>
            ${sectionChoices.map((choice) => `<option value="${escapeHtml(choice.id)}" ${(choiceKind === 'arrangement' ? selectedCourse.selectedArrangementId : selectedCourse.selectedAdvisorId) === choice.id ? 'selected' : ''}>${escapeHtml(choice.optionLabel || `${choice.teacher || '彈性安排'} · ${choice.schedule?.label || '時間待確認'}`)}</option>`).join('')}
          </select></label>` : ''}
          <p>${escapeHtml(selectedCourse?.optionMessage || '選定後會把整個班別的課號、教師與時段一起放進左側課表。')}</p>
        </div>`
      : '';
    const legacyOptionControls = selectedNow && !atomicSections.length && course.variants?.length
      ? `<div class="course-option-controls">
          <label>正式課號<select data-course-variant="${escapeHtml(course.id)}">
            <option value="">請選擇</option>
            ${course.variants.map((variant) => `<option value="${escapeHtml(variant.id)}" ${selectedCourse?.selectedVariantId === variant.id ? 'selected' : ''}>${escapeHtml(variant.sectionCode || variant.id)} · ${escapeHtml(variant.teacher || '依指導老師')}</option>`).join('')}
          </select></label>
          ${selectedVariant?.advisors?.length ? `<label>${escapeHtml(selectedVariant.selectionLabel || '指導老師與時段')}<select data-course-advisor="${escapeHtml(course.id)}">
            <option value="">請選擇</option>
            ${selectedVariant.advisors.map((advisor) => `<option value="${escapeHtml(advisor.id)}" ${selectedCourse.selectedAdvisorId === advisor.id ? 'selected' : ''}>${escapeHtml(advisor.optionLabel || `${advisor.teacher} · ${advisor.schedule?.label || '彈性時間'}`)}</option>`).join('')}
          </select></label>` : ''}
          <p>${escapeHtml(selectedCourse?.optionMessage || '選定後會把對應時段放進左側課表。')}</p>
        </div>`
      : '';
    const optionControls = atomicOptionControls || legacyOptionControls;
    return `<article class="catalog-course ${selectedNow ? 'is-selected' : ''}">
      <button class="catalog-select" type="button" data-course-id="${escapeHtml(course.id)}" aria-pressed="${selectedNow}" ${blocked ? 'disabled' : ''}>
        <span class="catalog-main"><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.sectionCode || '—')} · ${escapeHtml(course.teacher || '—')}</small><small class="catalog-time">${escapeHtml(scheduleSummary)}</small></span>
        <span class="catalog-meta"><b>${course.credits} 學分</b><small>${course.asyncAllowed ? '可非同步 · ' : ''}${eligibilityLabel(eligibility.status)}</small></span>
      </button>
      <div class="course-actions">
        ${detailTrigger}
        <details class="catalog-more">
          <summary class="catalog-more-trigger" aria-label="更多操作 ${escapeHtml(course.title)}" aria-haspopup="menu">•••</summary>
          <div class="catalog-more-menu" role="menu" data-close-catalog-menus>
            ${syllabusMenuAction}
            <button class="catalog-lock ${locked ? 'is-active' : ''}" type="button" role="menuitem" data-lock-course="${escapeHtml(course.id)}" aria-pressed="${locked}">${locked ? '解除鎖定' : '鎖定課程'}</button>
            <button class="catalog-delete" type="button" role="menuitem" data-delete-course="${escapeHtml(course.id)}">刪除候選課程</button>
          </div>
        </details>
      </div>
      ${detailPanel}
      ${optionControls}
      ${attendance}
    </article>`;
  }).join('');
}

function renderAll() {
  renderStats();
  renderSchedule();
  renderWarnings();
  renderCatalog();
  renderCourseComparisonPicker();
  renderConditions();
}

function revealPlacedCourse(courseId) {
  requestAnimationFrame(() => {
    const block = [...document.querySelectorAll('[data-grid-course]')]
      .find((item) => item.dataset.gridCourse === courseId);
    if (!block) return;
    block.classList.add('is-newly-placed');
    block.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    block.addEventListener('animationend', () => block.classList.remove('is-newly-placed'), { once: true });
  });
}

function setWorkspaceTab(name) {
  document.querySelectorAll('[data-workspace-tab]').forEach((tab) => {
    const selected = tab.dataset.workspaceTab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-workspace-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.workspacePanel !== name;
  });
}

function readSharedAiProfile() {
  return {
    profileText: byId('ai-profile').value,
    futureDirection: byId('ai-future').value,
    semesterGoals: byId('ai-goals').value,
    preferences: byId('ai-preferences').value,
  };
}

function updateSharedAiProfileCompletion() {
  byId('shared-ai-profile-completion').textContent = aiProfileCompletionLabel(readSharedAiProfile());
}

function mountSharedAiProfile(toolName) {
  if (!['advisor', 'comparison'].includes(toolName)) return;
  const target = byId(toolName === 'advisor' ? 'ai-advisor-profile-mount' : 'ai-comparison-profile-mount');
  const profileSection = byId('shared-ai-profile');
  target.append(profileSection);
  profileSection.open = toolName === 'advisor';
  updateSharedAiProfileCompletion();
}

function setAiTool(name, { focus = false } = {}) {
  if (!['hub', 'advisor', 'comparison'].includes(name)) return;
  activeAiTool = name;
  const hub = byId('ai-feature-hub');
  const advisor = byId('ai-tool-advisor');
  const comparison = byId('ai-tool-comparison');
  hub.hidden = name !== 'hub';
  advisor.hidden = name !== 'advisor';
  comparison.hidden = name !== 'comparison';
  mountSharedAiProfile(name);
  if (!focus) return;
  const heading = name === 'hub'
    ? byId('ai-feature-hub-title')
    : name === 'advisor'
      ? byId('ai-advisor-title')
      : byId('ai-comparison-title');
  heading.focus();
}

byId('workspace-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-workspace-tab]');
  if (!button) return;
  setWorkspaceTab(button.dataset.workspaceTab);
});

byId('workspace-panel-ai').addEventListener('click', (event) => {
  const tool = event.target.closest('[data-ai-tool]');
  if (tool) {
    setAiTool(tool.dataset.aiTool, { focus: true });
    return;
  }
  if (event.target.closest('[data-ai-tool-back]')) setAiTool('hub', { focus: true });
});

byId('shared-ai-profile').addEventListener('input', updateSharedAiProfileCompletion);
updateSharedAiProfileCompletion();

byId('clear-course-comparison').addEventListener('click', () => {
  comparisonCourseIds = [];
  renderCourseComparisonPicker();
  byId('course-comparison-status').textContent = '已清除課程比較清單；請重新選擇至少兩門課。';
});

byId('comparison-course-search').addEventListener('input', (event) => {
  comparisonSearchQuery = event.target.value;
  renderCourseComparisonPicker();
});

byId('comparison-course-list').addEventListener('change', (event) => {
  const input = event.target.closest('[data-comparison-course]');
  if (!input) return;
  const result = toggleComparisonCourse(
    comparisonCourseIds,
    input.dataset.comparisonCourse,
    input.checked,
    MAX_COMPARISON_COURSES,
  );
  comparisonCourseIds = result.ids;
  renderCourseComparisonPicker();
  if (result.limitReached) {
    byId('course-comparison-status').textContent = `一次最多比較 ${MAX_COMPARISON_COURSES} 門課，請先移除一門。`;
  }
});

byId('comparison-course-list').addEventListener('click', (event) => {
  if (event.target.closest('[data-open-add-panel]')) setWorkspaceTab('add');
});

byId('run-ai-comparison').addEventListener('click', async () => {
  const pickerStatus = byId('course-comparison-status');
  const resultStatus = byId('ai-comparison-status');
  const button = byId('run-ai-comparison');
  const apiKey = requireApiKeyForAi(pickerStatus);
  if (!apiKey) return;
  setWorkspaceTab('ai');
  setAiTool('comparison');
  setCompactView('tools');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  pickerStatus.textContent = '正在讀取官方課綱並比較…';
  resultStatus.textContent = '正在分析共同主題、獨有內容、評量與負擔…';
  try {
    const response = await fetch('/api/ai/compare-courses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey, ...comparisonRequestBody() }),
    });
    const payload = await response.json();
    if (!response.ok) throw errorFromPayload(payload, '課綱比較失敗，請稍後重試。');
    cacheComparisonSources(payload.sources);
    renderCourseComparison(payload);
    resultStatus.textContent = payload.profileMode === 'personalized'
      ? '比較完成，已加入你選填的個人目標與偏好。'
      : '比較完成；這次未填個人資料，因此只提供客觀比較。';
    byId('ai-course-comparison').scrollIntoView({ block: 'start' });
    pickerStatus.textContent = '比較完成，結果已顯示在「AI 功能」。';
  } catch (error) {
    const message = error?.message || '課綱比較失敗，請稍後重試。';
    pickerStatus.textContent = message;
    resultStatus.textContent = message;
  } finally {
    button.disabled = comparisonCourseIds.length < 2;
    button.removeAttribute('aria-busy');
  }
});

byId('open-chatgpt-comparison').addEventListener('click', async () => {
  const pickerStatus = byId('course-comparison-status');
  const button = byId('open-chatgpt-comparison');
  const chatWindow = window.open('about:blank', '_blank');
  setWorkspaceTab('ai');
  setAiTool('comparison');
  setCompactView('tools');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  pickerStatus.textContent = '正在讀取官方課綱並準備提示詞…';
  try {
    const response = await fetch('/api/course-comparison/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(comparisonRequestBody()),
    });
    const payload = await response.json();
    if (!response.ok) throw errorFromPayload(payload, '無法產生 ChatGPT 比較提示詞。');
    cacheComparisonSources(payload.sources);
    showChatGptComparisonRecovery(payload.prompt, '提示詞已準備完成；正在嘗試自動複製…');
    if (chatWindow) {
      chatWindow.opener = null;
      chatWindow.location.href = 'https://chatgpt.com/';
    }
    const copied = await Promise.race([
      Promise.resolve().then(() => navigator.clipboard.writeText(payload.prompt)).then(() => true).catch(() => false),
      new Promise((resolve) => setTimeout(() => resolve(false), 1_500)),
    ]);
    const message = copied
      ? `已複製比較提示詞${chatWindow ? '並開啟 ChatGPT' : ''}，請貼上後自行送出。`
      : '瀏覽器未允許自動複製，請使用下方按鈕手動複製後開啟 ChatGPT。';
    showChatGptComparisonRecovery(payload.prompt, message);
    byId('chatgpt-comparison-recovery').scrollIntoView({ block: 'start' });
    pickerStatus.textContent = message;
  } catch (error) {
    if (chatWindow && !chatWindow.closed) chatWindow.close();
    pickerStatus.textContent = error?.message || '無法產生 ChatGPT 比較提示詞。';
  } finally {
    button.disabled = comparisonCourseIds.length < 2;
    button.removeAttribute('aria-busy');
  }
});

byId('copy-chatgpt-comparison-prompt').addEventListener('click', async () => {
  const prompt = byId('chatgpt-comparison-prompt').value;
  try {
    await navigator.clipboard.writeText(prompt);
    byId('chatgpt-comparison-status').textContent = '已複製提示詞，請到 ChatGPT 貼上並送出。';
  } catch {
    const textarea = byId('chatgpt-comparison-prompt');
    textarea.focus();
    textarea.select();
    byId('chatgpt-comparison-status').textContent = '請長按或使用鍵盤複製選取的提示詞。';
  }
});

function setCompactView(name) {
  byId('planner-workbench').dataset.compactView = name;
  document.querySelectorAll('[data-compact-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.compactView === name));
  });
}

byId('compact-view-switch').addEventListener('click', (event) => {
  const button = event.target.closest('[data-compact-view]');
  if (!button) return;
  setCompactView(button.dataset.compactView);
});

restoreState();
syncProfileForm();
syncInternshipForm();
renderAll();

function syncProfileForm() {
  byId('profile-level').value = profile.level;
  byId('profile-year').value = String(profile.year);
}

byId('profile-form').addEventListener('change', () => {
  profile.level = byId('profile-level').value;
  profile.year = Number(byId('profile-year').value);
  persistState();
  renderAll();
});

function renderConditions() {
  const definitions = buildConditionDefinitions(courseStore, customConditions);
  const impacts = buildConditionImpacts(courseStore, definitions, profile);
  byId('condition-list').innerHTML = impacts.map((impact) => `
    <article class="condition-item is-${impact.state}">
      <label class="condition-toggle">
        <span><strong>${escapeHtml(impact.label)}</strong><small>${escapeHtml(impact.summary)}</small></span>
        <select data-profile-condition-state="${escapeHtml(impact.id)}" aria-label="${escapeHtml(impact.label)}的符合狀態">
          <option value="unknown" ${impact.state === 'unknown' ? 'selected' : ''}>待確認</option>
          <option value="accepted" ${impact.state === 'accepted' ? 'selected' : ''}>符合</option>
          <option value="rejected" ${impact.state === 'rejected' ? 'selected' : ''}>不符合</option>
        </select>
      </label>
      <details class="condition-impact">
        <summary>為什麼需要這個條件？</summary>
        <p>${escapeHtml(impact.description)}</p>
        ${impact.affectedCourses.length ? `<ul>${impact.affectedCourses.map((course) => `
          <li><strong>${escapeHtml(course.title)}</strong><span>${escapeHtml(course.rationale)}</span><em>${escapeHtml(course.consequence)}</em></li>
        `).join('')}</ul>` : '<p>目前沒有候選課程使用這項條件。</p>'}
      </details>
      ${impact.source === 'custom' ? `<button class="condition-delete" type="button" data-delete-condition="${escapeHtml(impact.id)}">刪除自訂條件</button>` : ''}
    </article>
  `).join('');
}

byId('condition-list').addEventListener('change', (event) => {
  const input = event.target.closest('[data-profile-condition-state]');
  if (!input) return;
  const selectedIds = new Set(profileConditionIds(profile));
  const rejectedIds = new Set(profile.rejectedConditionIds || []);
  const conditionId = input.dataset.profileConditionState;
  selectedIds.delete(conditionId);
  rejectedIds.delete(conditionId);
  if (input.value === 'accepted') selectedIds.add(conditionId);
  if (input.value === 'rejected') rejectedIds.add(conditionId);
  profile.conditionIds = [...selectedIds];
  profile.rejectedConditionIds = [...rejectedIds];
  profile.programs = [];
  profile.prerequisites = [];
  persistState();
  renderAll();
});

byId('condition-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-condition]');
  if (!button) return;
  const condition = customConditions.find((item) => item.id === button.dataset.deleteCondition);
  if (!condition || !window.confirm(`確定刪除自訂條件「${condition.label}」嗎？`)) return;
  capturePlannerUndo(`已刪除條件「${condition.label}」`);
  customConditions = customConditions.filter((item) => item.id !== condition.id);
  profile.conditionIds = profileConditionIds(profile).filter((id) => id !== condition.id);
  profile.rejectedConditionIds = (profile.rejectedConditionIds || []).filter((id) => id !== condition.id);
  persistState();
  renderAll();
});

byId('custom-condition-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const definitions = buildConditionDefinitions(courseStore, customConditions);
  const input = {
    label: byId('custom-condition-label').value,
    category: byId('custom-condition-category').value,
    description: byId('custom-condition-description').value,
  };
  const validation = validateCustomCondition(input, definitions);
  const status = byId('custom-condition-status');
  if (validation) {
    status.textContent = validation.message;
    byId(`custom-condition-${validation.field}`).focus();
    return;
  }
  const condition = {
    id: `custom:${Date.now().toString(36)}`,
    label: input.label.trim(),
    category: input.category,
    description: input.description.trim() || '這是你自行加入的選課條件。',
    source: 'custom',
  };
  customConditions.push(condition);
  const selectedIds = profileConditionIds(profile).filter((id) => id !== condition.id);
  profile.conditionIds = [...selectedIds, condition.id];
  profile.rejectedConditionIds = (profile.rejectedConditionIds || []).filter((id) => id !== condition.id);
  event.currentTarget.reset();
  status.textContent = `已新增「${condition.label}」並標記為符合。`;
  persistState();
  renderAll();
});

function syncInternshipForm() {
  byId('internship-target').value = String(internshipSettings.targetDays);
  byId('internship-start').value = internshipSettings.start;
  byId('internship-end').value = internshipSettings.end;
  byId('internship-mode').value = internshipSettings.mode;
  byId('internship-fixed-days').hidden = internshipSettings.mode !== 'fixed';
  document.querySelectorAll('[data-internship-day]').forEach((select) => {
    select.value = internshipSettings.fixedDays[select.dataset.internshipDay] || 'none';
  });
}

byId('internship-form').addEventListener('change', () => {
  const fixedDays = Object.fromEntries([...document.querySelectorAll('[data-internship-day]')]
    .map((select) => [select.dataset.internshipDay, select.value]));
  const candidate = {
    targetDays: Number(byId('internship-target').value),
    start: byId('internship-start').value,
    end: byId('internship-end').value,
    mode: byId('internship-mode').value,
    fixedDays,
  };
  const validation = validateInternshipSettings(candidate);
  if (validation) {
    byId('internship-status').textContent = validation.message;
    syncInternshipForm();
    byId(`internship-${validation.field}`).focus();
    return;
  }
  internshipSettings = candidate;
  byId('internship-status').textContent = candidate.mode === 'auto'
    ? '已自動優先保留完整工作日，再補半天。'
    : '已依指定星期保留；衝堂仍會顯示在課表上。';
  syncInternshipForm();
  persistState();
  renderAll();
});

const catalogList = byId('catalog-list');
function closeCatalogMenus(except = null) {
  catalogList.querySelectorAll('.catalog-more[open]').forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.catalog-more')) closeCatalogMenus();
});

catalogList.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const menu = event.target.closest('.catalog-more[open]');
    if (!menu) return;
    menu.open = false;
    menu.querySelector('.catalog-more-trigger')?.focus();
  }
});

catalogList.addEventListener('click', async (event) => {
  const moreTrigger = event.target.closest('.catalog-more-trigger');
  if (moreTrigger) {
    closeCatalogMenus(moreTrigger.closest('.catalog-more'));
    return;
  }
  const detailButton = event.target.closest('[data-details-course]');
  if (detailButton) {
    expandedCourseId = expandedCourseId === detailButton.dataset.detailsCourse
      ? null
      : detailButton.dataset.detailsCourse;
    renderCatalog();
    return;
  }
  const refreshButton = event.target.closest('[data-refresh-nccu-course]');
  if (refreshButton) {
    refreshButton.disabled = true;
    const previousText = refreshButton.textContent;
    refreshButton.textContent = '更新中…';
    try {
      const candidate = await refreshOfficialCandidateByCode(refreshButton.dataset.refreshNccuCourse);
      byId('catalog-status').textContent = `已更新「${candidate.title}」的官方資料。`;
    } catch {
      refreshButton.disabled = false;
      refreshButton.textContent = previousText;
      byId('catalog-status').textContent = '官方資料暫時無法更新，已保留目前資料。請稍後再試。';
    }
    return;
  }
  const lockButton = event.target.closest('[data-lock-course]');
  if (lockButton) {
    const course = courseStore.find((item) => item.id === lockButton.dataset.lockCourse);
    if (!course) return;
    const result = lockCandidateCourse(selected, lockedCourseIds, course, profile);
    selected = result.selected;
    lockedCourseIds = result.lockedCourseIds;
    persistState();
    renderAll();
    return;
  }
  const deleteButton = event.target.closest('[data-delete-course]');
  if (deleteButton) {
    const course = courseStore.find((item) => item.id === deleteButton.dataset.deleteCourse);
    if (!course) return;
    const warning = course.required
      ? `這是你標記為一定要修的課程。仍要刪除「${course.title}」嗎？`
      : `要從候選課程刪除「${course.title}」嗎？`;
    if (!window.confirm(warning)) return;
    capturePlannerUndo(`已刪除「${course.title}」`);
    const result = deleteCandidateCourse(courseStore, selected, lockedCourseIds, course.id);
    courseStore = result.courseStore;
    selected = result.selected;
    lockedCourseIds = result.lockedCourseIds;
    delete courseOptions[course.id];
    byId('catalog-status').textContent = `已刪除「${course.title}」。`;
    persistState();
    renderAll();
    return;
  }
  const openAddButton = event.target.closest('[data-open-add-panel]');
  if (openAddButton) {
    setWorkspaceTab('add');
    return;
  }
  const button = event.target.closest('[data-course-id]');
  if (!button) return;
  const course = courseStore.find((item) => item.id === button.dataset.courseId);
  const wasSelected = selected.some((item) => item.id === course.id);
  selected = wasSelected
    ? toggleCourse(selected, course, lockedCourseIds)
    : toggleSelectableCourse(selected, course, profile);
  persistState();
  renderAll();
  if (!wasSelected) revealPlacedCourse(course.id);
});

catalogList.addEventListener('change', (event) => {
  const optionSelect = event.target.closest('[data-course-section], [data-course-arrangement], [data-course-variant], [data-course-advisor]');
  if (optionSelect) {
    const courseId = optionSelect.dataset.courseSection
      || optionSelect.dataset.courseArrangement
      || optionSelect.dataset.courseVariant
      || optionSelect.dataset.courseAdvisor;
    const current = courseOptions[courseId] || {};
    let selection;
    if (optionSelect.dataset.courseSection) {
      selection = { sectionId: optionSelect.value, advisorId: null, arrangementId: null };
    } else if (optionSelect.dataset.courseArrangement) {
      selection = { ...current, arrangementId: optionSelect.value, advisorId: null };
    } else if (optionSelect.dataset.courseVariant) {
      selection = { variantId: optionSelect.value, advisorId: null };
    } else {
      selection = { ...current, advisorId: optionSelect.value, arrangementId: null };
    }
    courseOptions[courseId] = selection;
    selected = applyCourseOption(selected, courseId, selection);
    persistState();
    renderAll();
    return;
  }
  const select = event.target.closest('[data-attendance-course]');
  if (!select) return;
  selected = selected.map((course) => course.id === select.dataset.attendanceCourse
    ? { ...course, attendance: select.value }
    : course);
  persistState();
  renderAll();
});

byId('schedule-grid').addEventListener('click', removeFromSchedule);
byId('schedule-agenda').addEventListener('click', removeFromSchedule);
byId('async-lane').addEventListener('click', removeFromSchedule);
function removeFromSchedule(event) {
  const button = event.target.closest('[data-remove-course]');
  if (!button) return;
  const course = courseStore.find((item) => item.id === button.dataset.removeCourse);
  selected = toggleCourse(selected, course, lockedCourseIds);
  persistState();
  renderAll();
}

byId('catalog-search').addEventListener('input', renderCatalog);
byId('catalog-filter-toggle').addEventListener('click', () => {
  const toggle = byId('catalog-filter-toggle');
  const panel = byId('catalog-filter-panel');
  const expanded = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(expanded));
  panel.hidden = !expanded;
});
byId('catalog-filter-panel').addEventListener('change', (event) => {
  if (!event.target.matches('[data-catalog-status-filter], [data-catalog-day-filter], [data-catalog-daypart-filter]')) return;
  renderCatalog();
});
byId('clear-catalog-filters').addEventListener('click', () => {
  byId('catalog-filter-panel').querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  renderCatalog();
});
byId('clear-candidates').addEventListener('click', () => {
  if (!courseStore.length) {
    byId('catalog-status').textContent = '候選課程目前已經是空的。';
    return;
  }
  if (!window.confirm('確定清空全部候選課程嗎？已排入課表與鎖定的課程也會移除。')) return;
  capturePlannerUndo('已清空全部候選課程');
  ({ courseStore, selected, lockedCourseIds, courseOptions } = clearCandidateCatalog());
  byId('catalog-status').textContent = '已清空候選課程；你的選課條件與實習設定仍保留。';
  persistState();
  renderAll();
});
byId('clear-schedule').addEventListener('click', () => {
  capturePlannerUndo('已清空目前課表');
  const cleared = clearPlannerSelection();
  selected = cleared.selected;
  lockedCourseIds = cleared.lockedCourseIds;
  courseOptions = cleared.courseOptions;
  byId('planner-status').textContent = '已清空目前課表。';
  persistState();
  renderAll();
});
byId('export-wallpaper').addEventListener('click', exportScheduleWallpaper);

let nccuSearchResults = [];
let lastSuccessfulNccuQueryAt = null;

function renderNccuDataFreshness() {
  byId('nccu-data-freshness').textContent = lastSuccessfulNccuQueryAt
    ? `資料學期 115-1 · 最後成功查詢 ${lastSuccessfulNccuQueryAt.toLocaleString('zh-TW', { hour12: false })}`
    : '資料學期 115-1 · 尚未成功查詢';
}

function renderNccuSearchResults() {
  const results = byId('nccu-course-results');
  results.innerHTML = nccuSearchResults.map((course) => {
    const existing = courseStore.find((candidate) => candidate.sectionCode === course.courseCode);
    const outlineUrl = trustedOfficialSyllabusUrl(course)
      ? `<a href="${escapeHtml(trustedOfficialSyllabusUrl(course))}" target="_blank" rel="noopener noreferrer">查看官方課綱</a>`
      : '';
    const action = existing
      ? `<button class="button button-quiet" type="button" data-refresh-nccu-course="${escapeHtml(course.courseCode)}">更新官方資料</button>`
      : `<button class="button button-primary" type="button" data-add-nccu-course="${escapeHtml(course.courseCode)}">加入候選</button>`;
    return `<article class="nccu-course-result">
      <div class="nccu-course-result-main">
        <strong>${escapeHtml(course.title)}</strong>
        <small>${escapeHtml(course.courseCode)} · ${escapeHtml(course.teacher || '教師未定')} · ${course.credits} 學分 · ${escapeHtml(course.scheduleText || '時間未定')}</small>
        ${course.restrictionText ? `<p>限制：${escapeHtml(course.restrictionText)}</p>` : '<p>官方資料未列額外修課限制。</p>'}
        ${outlineUrl}
      </div>
      ${action}
    </article>`;
  }).join('');
}

async function refreshOfficialCandidateByCode(courseCode) {
  const officialCourse = nccuSearchResults.find((course) => course.courseCode === courseCode)
    || (await searchNccuCourses({ term: '115-1', keyword: courseCode }))
      .find((course) => course.courseCode === courseCode);
  const existingIndex = courseStore.findIndex((course) => course.sectionCode === officialCourse?.courseCode);
  if (!officialCourse || existingIndex < 0) throw new Error('official-course-not-found');

  const existingCourse = courseStore[existingIndex];
  const candidate = nccuCourseToCandidate(officialCourse, { checkedAt: new Date().toISOString() });
  courseStore = courseStore.map((course, index) => (
    index === existingIndex ? reconcileOfficialCandidate(existingCourse, candidate) : course
  ));
  selected = selected.map((course) => (
    course.id === existingCourse.id ? reconcileOfficialCandidate(course, candidate) : course
  ));
  lastSuccessfulNccuQueryAt = new Date();
  persistState();
  renderAll();
  renderNccuSearchResults();
  renderNccuDataFreshness();
  return candidate;
}

byId('nccu-course-search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const searchForm = event.currentTarget;
  const query = byId('nccu-course-query').value.trim();
  const status = byId('nccu-course-search-status');
  const submit = searchForm.querySelector('button[type="submit"]');
  if (!query) {
    status.textContent = '請輸入課名、教師或九碼課號。';
    byId('nccu-course-query').focus();
    return;
  }
  submit.disabled = true;
  searchForm.setAttribute('aria-busy', 'true');
  status.textContent = '正在查詢政大 115-1 課程庫…';
  try {
    nccuSearchResults = await searchNccuCourses({ term: '115-1', keyword: query });
    lastSuccessfulNccuQueryAt = new Date();
    renderNccuDataFreshness();
    status.textContent = nccuSearchResults.length
      ? `找到 ${nccuSearchResults.length} 門課。`
      : '找不到符合的課程，請改用較短的課名或教師姓名。';
    renderNccuSearchResults();
  } catch {
    status.textContent = '政大課程資料暫時無法查詢，請稍後重試。';
  } finally {
    submit.disabled = false;
    searchForm.removeAttribute('aria-busy');
  }
});

byId('nccu-course-results').addEventListener('click', async (event) => {
  const refreshButton = event.target.closest('[data-refresh-nccu-course]');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = '更新中…';
    try {
      const candidate = await refreshOfficialCandidateByCode(refreshButton.dataset.refreshNccuCourse);
      byId('nccu-course-search-status').textContent = `已更新「${candidate.title}」的官方資料。`;
    } catch {
      refreshButton.disabled = false;
      refreshButton.textContent = '重新更新';
      byId('nccu-course-search-status').textContent = '官方資料暫時無法更新，已保留目前資料。請稍後再試。';
    }
    return;
  }
  const button = event.target.closest('[data-add-nccu-course]');
  if (!button) return;
  const officialCourse = nccuSearchResults.find(
    (course) => course.courseCode === button.dataset.addNccuCourse,
  );
  if (!officialCourse || candidateIncludesCourseCode(courseStore, officialCourse.courseCode)) return;
  const addedAt = new Date().toISOString();
  const candidate = nccuCourseToCandidate(officialCourse, { checkedAt: addedAt });
  courseStore = [...courseStore, candidate];
  persistState();
  renderAll();
  renderNccuSearchResults();
  byId('nccu-course-search-status').textContent = `已將「${candidate.title}」加入候選課程。`;
});

let manualSequence = 1 + courseStore.filter((course) => course.source === 'manual').length;
byId('manual-form').innerHTML = `<form id="manual-course-form" class="manual-course-form" novalidate>
  <label>類型<select id="manual-item-type" name="itemType"><option value="course">課程</option><option value="club">社團</option><option value="organization">課外組織</option><option value="personal">個人行程</option></select></label>
  <label>名稱<input id="manual-title" name="title" autocomplete="off" required placeholder="例如：攝影社例會"></label>
  <label>學分<input id="manual-credits" name="credits" type="number" min="0" max="12" step="0.5" value="3" required></label>
  <label>上課方式<select id="manual-mode" name="mode"><option value="physical">實體／固定同步</option><option value="async">非同步</option></select></label>
  <label>星期<select id="manual-day" name="day">${[1, 2, 3, 4, 5, 6, 7].map((day) => `<option value="${day}">${dayLabels[day]}</option>`).join('')}</select></label>
  <label>開始<input id="manual-start" name="start" type="time" value="09:10"></label>
  <label>結束<input id="manual-end" name="end" type="time" value="12:00"></label>
  <button class="button button-primary form-wide" type="submit">建立並加入課表</button>
  <p id="manual-status" class="form-status form-wide" aria-live="polite"></p>
</form>`;

const manualForm = byId('manual-course-form');
const manualMode = byId('manual-mode');
const manualItemType = byId('manual-item-type');
function syncManualTimeFields() {
  const asynchronous = manualMode.value === 'async';
  const itemType = manualItemType.value;
  const creditInput = byId('manual-credits');
  creditInput.disabled = itemType !== 'course';
  ['manual-day', 'manual-start', 'manual-end'].forEach((id) => { byId(id).disabled = asynchronous; });
}
manualMode.addEventListener('change', syncManualTimeFields);
manualItemType.addEventListener('change', syncManualTimeFields);
manualForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = {
    title: byId('manual-title').value,
    itemType: byId('manual-item-type').value,
    credits: byId('manual-credits').value,
    mode: manualMode.value,
    day: byId('manual-day').value,
    start: byId('manual-start').value,
    end: byId('manual-end').value,
  };
  const validation = validateManualCourse(input);
  if (validation) {
    byId('manual-status').textContent = validation.message;
    byId(`manual-${validation.field}`).focus();
    return;
  }
  const manualCourse = createManualCourse(input, manualSequence);
  manualSequence += 1;
  courseStore.push(manualCourse);
  selected = [...selected, manualCourse];
  persistState();
  renderAll();
  manualForm.reset();
  byId('manual-credits').value = '3';
  byId('manual-start').value = '09:10';
  byId('manual-end').value = '12:00';
  syncManualTimeFields();
  byId('manual-status').textContent = `已加入「${manualCourse.title}」。`;
});

function previewRecommendedPlan(plan) {
  const planCourses = applyRecommendedPlan(plan, courseStore, selected, lockedCourseIds, profile);
  const conflicts = findConflicts(planCourses);
  const internshipPlan = calculateInternshipPlan(planCourses, internshipSettings);
  const eligibilityWarnings = planCourses.filter((course) => (
    evaluateEligibility(course, profile).status !== 'eligible'
  ));
  const optionWarnings = planCourses.filter((course) => (
    course.optionStatus === 'pending' || course.optionStatus === 'flexible'
  ));
  return {
    planCourses,
    conflicts,
    credits: planCourses.reduce((total, course) => total + Number(course.credits || 0), 0),
    internshipPlan,
    warningCount: conflicts.length + internshipPlan.conflicts.length
      + eligibilityWarnings.length + optionWarnings.length,
  };
}

function renderRouteWeekPreview(planCourses) {
  const loads = [1, 2, 3, 4, 5, 6, 7].map((day) => planCourses.reduce((total, course) => (
    total + meetingsForCourse(course).filter((meeting) => meeting.day === day).length
  ), 0));
  const peak = Math.max(1, ...loads);
  return `<div class="route-week-preview" role="img" aria-label="週一至週日課程密度">
    ${loads.map((load, index) => `<span aria-label="${escapeHtml(dayLabels[index + 1])} ${load} 個時段"><b>${escapeHtml(dayLabels[index + 1].replace('週', ''))}</b><i style="--route-load:${Math.round((load / peak) * 100)}%"></i></span>`).join('')}
  </div>`;
}

function renderRouteComparison(planCourses) {
  const currentIds = new Set(selected.map((course) => course.id));
  const routeIds = new Set(planCourses.map((course) => course.id));
  const kept = planCourses.filter((course) => currentIds.has(course.id)).length;
  const added = planCourses.filter((course) => !currentIds.has(course.id)).length;
  const removed = selected.filter((course) => !routeIds.has(course.id) && !lockedCourseIds.includes(course.id)).length;
  return `<section class="route-comparison" aria-label="與目前課表比較">
    <strong>與目前課表比較</strong>
    <dl><div><dt>保留</dt><dd>${kept}</dd></div><div><dt>新增</dt><dd>${added}</dd></div><div><dt>移除</dt><dd>${removed}</dd></div></dl>
    <p>這只是預覽，尚未變更目前課表。</p>
  </section>`;
}

function toggleRecommendedPlanPreview(planId) {
  previewedPlanId = previewedPlanId === planId ? null : planId;
  renderRecommendedPlans();
}

function renderRecommendedPlans() {
  const results = byId('ai-plan-results');
  if (!recommendedPlans.length) {
    results.innerHTML = recommendationShortfall
      ? `<p class="route-shortfall" role="status">${escapeHtml(recommendationShortfall)}</p>`
      : '';
    return;
  }
  const previewedPlans = recommendedPlans.map((plan) => ({
    plan,
    preview: previewRecommendedPlan(plan),
  }));
  const safePlans = previewedPlans.filter(({ preview }) => preview.conflicts.length === 0);
  const hiddenConflictCount = previewedPlans.length - safePlans.length;
  if (!safePlans.length) {
    results.innerHTML = '<p class="route-conflict" role="alert">目前沒有可安全套用的方案，請重新產生。</p>';
    return;
  }
  const hiddenNotice = hiddenConflictCount
    ? `<p class="form-status" role="status">已隱藏 ${hiddenConflictCount} 個衝堂方案。</p>`
    : '';
  const shortfallNotice = recommendationShortfall
    ? `<p class="route-shortfall" role="status">${escapeHtml(recommendationShortfall)}</p>`
    : '';
  results.innerHTML = shortfallNotice + hiddenNotice + safePlans.map(({ plan, preview }, index) => {
    const expanded = previewedPlanId === plan.id;
    return `<article class="ai-route-board" data-route-id="${escapeHtml(plan.id)}">
      <div class="route-index"><span>路線 ${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(plan.attendance || '彈性安排')}</b></div>
      <h3>${escapeHtml(plan.title)}</h3>
      <p class="route-strategy">${escapeHtml(plan.reason)}</p>
      <dl class="route-metrics"><div><dt>學分</dt><dd>${preview.credits}</dd></div><div><dt>可實習</dt><dd>${preview.internshipPlan.confirmedDays} 天${preview.internshipPlan.pendingDays ? `＋${preview.internshipPlan.pendingDays} 待確認` : ''}</dd></div><div><dt>提醒</dt><dd>${preview.warningCount}</dd></div></dl>
      ${renderRouteWeekPreview(preview.planCourses)}
      <ul class="ai-plan-courses">${preview.planCourses.map((course) => `<li><span>${escapeHtml(course.title)}</span><span class="route-course-flags">${plan.asyncCourseIds?.includes(course.id) ? '<b>非同步</b>' : ''}${lockedCourseIds.includes(course.id) ? '<b>鎖定保留</b>' : ''}</span></li>`).join('')}</ul>
      ${plan.tradeoffs?.length ? `<p class="ai-plan-tradeoffs">取捨：${escapeHtml(plan.tradeoffs.join('、'))}</p>` : ''}
      ${expanded ? renderRouteComparison(preview.planCourses) : ''}
      <div class="route-actions">
        <button class="button button-quiet" type="button" data-preview-ai-plan="${escapeHtml(plan.id)}" aria-expanded="${expanded}">${expanded ? '收起預覽' : '預覽'}</button>
        <button class="button button-primary" type="button" data-apply-ai-plan="${escapeHtml(plan.id)}">套用此方案</button>
      </div>
    </article>`;
  }).join('');
}

byId('ai-advisor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const status = byId('ai-advisor-status');
  const retryButton = byId('retry-ai-advisor');
  const apiKey = requireApiKeyForAi(status);
  if (!apiKey) return;
  retryButton.hidden = true;
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.textContent = '正在分析你的目標與候選課程…';
  try {
    const response = await fetch('/api/ai/recommend-plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        ...readSharedAiProfile(),
        internshipSettings,
        courses: courseStore.map((course) => {
          const effectiveCourse = selected.find((item) => item.id === course.id) || course;
          return {
            id: effectiveCourse.id,
            title: effectiveCourse.title,
            credits: effectiveCourse.credits,
            teacher: effectiveCourse.teacher,
            schedule: effectiveCourse.schedule,
            meetings: effectiveCourse.meetings,
            events: effectiveCourse.events,
            attendance: effectiveCourse.attendance,
            asyncAllowed: effectiveCourse.asyncAllowed,
            conditions: effectiveCourse.conditions,
            eligibility: evaluateEligibility(effectiveCourse, profile).status,
          };
        }),
        selectedCourseIds: selected.map((course) => course.id),
        lockedCourseIds,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw errorFromPayload(payload, '無法產生推薦，請稍後重試。');
    recommendedPlans = payload.plans || [];
    recommendationShortfall = payload.shortfallReason || '';
    status.textContent = payload.summary || (recommendedPlans.length ? '已產生可安全套用的推薦方案。' : recommendationShortfall);
    renderRecommendedPlans();
  } catch (error) {
    showAiError(status, retryButton, error);
  } finally {
    submit.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

byId('retry-ai-advisor').addEventListener('click', () => {
  byId('ai-advisor-form').requestSubmit();
});

byId('ai-plan-results').addEventListener('click', (event) => {
  const previewButton = event.target.closest('[data-preview-ai-plan]');
  if (previewButton) {
    toggleRecommendedPlanPreview(previewButton.dataset.previewAiPlan);
    return;
  }
  const button = event.target.closest('[data-apply-ai-plan]');
  if (!button) return;
  const plan = recommendedPlans.find((item) => item.id === button.dataset.applyAiPlan);
  if (!plan) return;
  const preview = previewRecommendedPlan(plan);
  if (preview.conflicts.length) {
    byId('ai-advisor-status').textContent = `「${plan.title}」有 ${preview.conflicts.length} 組衝堂，無法套用，請重新產生方案。`;
    return;
  }
  if (preview.warningCount && !window.confirm(`此方案有 ${preview.warningCount} 個待處理提醒，仍要套用嗎？`)) return;
  capturePlannerUndo(`已套用「${plan.title}」`);
  selected = preview.planCourses;
  persistState();
  renderAll();
  byId('ai-advisor-status').textContent = `已套用「${plan.title}」，所有鎖定課程均已保留。`;
});

byId('screenshot-handoff').innerHTML = `<div class="screenshot-handoff">
  <label>選擇備選清單截圖<input id="screenshot-input" type="file" accept="image/png,image/jpeg,image/webp"></label>
  <img id="screenshot-preview" class="screenshot-preview" alt="備選課程截圖預覽" hidden>
  <p class="privacy-note">截圖會以你的 Key 傳送給 Gemini 3.1 Flash-Lite，網站不會長期保存原始圖片。辨識後仍會核對政大 115-1 公開課程資料。</p>
  <button id="import-screenshot" class="button button-primary" type="button">開始辨識並匯入</button>
  <p id="screenshot-status" class="form-status" aria-live="polite"></p>
  <button id="retry-screenshot-import" class="button button-quiet" type="button" hidden>重試辨識</button>
  <div class="ai-import-layout">
    <section><h3>已匯入</h3><div id="imported-courses" class="import-result-list"></div></section>
    <section><h3>待確認</h3><div id="pending-courses" class="import-result-list"></div></section>
  </div>
</div>`;

let screenshotUrl;
byId('screenshot-input').addEventListener('change', (event) => {
  const [file] = event.target.files;
  const preview = byId('screenshot-preview');
  if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
  if (!file) {
    preview.hidden = true;
    return;
  }
  screenshotUrl = URL.createObjectURL(file);
  preview.src = screenshotUrl;
  preview.hidden = false;
  byId('screenshot-status').textContent = '截圖已就緒，尚未傳送。';
});

byId('retry-screenshot-import').addEventListener('click', () => {
  byId('import-screenshot').click();
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), { once: true });
    reader.addEventListener('error', () => reject(new Error('無法讀取截圖。')), { once: true });
    reader.readAsDataURL(file);
  });
}

function renderImportResults() {
  const imported = byId('imported-courses');
  const pending = byId('pending-courses');
  if (!imported || !pending) return;
  imported.innerHTML = lastImportedCourses.length
    ? lastImportedCourses.map((course) => `<article class="import-result"><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.sectionCode || '')} · ${escapeHtml(course.teacher || '教師未辨識')}</small></article>`).join('')
    : '<p class="empty">這次尚未匯入新課程。</p>';
  pending.innerHTML = pendingCourses.length
    ? pendingCourses.map((course, index) => `<article class="import-result">
        <strong>${escapeHtml(course.title || course.courseCode || '未辨識課程')}</strong>
        <small>${escapeHtml(course.courseCode || '無課號')} · ${escapeHtml(course.teacher || '教師未辨識')}</small>
        <p>${escapeHtml(course.reason)}</p>
        <button type="button" data-delete-pending="${index}">刪除</button>
      </article>`).join('')
    : '<p class="empty">沒有待確認項目。</p>';
}

byId('pending-courses').addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-pending]');
  if (!button) return;
  pendingCourses.splice(Number(button.dataset.deletePending), 1);
  persistState();
  renderImportResults();
});

byId('import-screenshot').addEventListener('click', async () => {
  const status = byId('screenshot-status');
  const retryButton = byId('retry-screenshot-import');
  const apiKey = requireApiKeyForAi(status);
  if (!apiKey) return;
  retryButton.hidden = true;
  const [file] = byId('screenshot-input').files;
  if (!file) {
    status.textContent = '請先選擇一張課程備選清單截圖。';
    byId('screenshot-input').focus();
    return;
  }
  const validation = validateScreenshotFile(file);
  if (validation) {
    status.textContent = validation.message;
    byId('screenshot-input').focus();
    return;
  }
  const button = byId('import-screenshot');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  status.textContent = '正在辨識並核對課程…';
  try {
    const imageDataUrl = await readFileAsDataUrl(file);
    const response = await fetch('/api/ai/import-courses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apiKey, imageDataUrl, term: '115-1' }),
    });
    const payload = await response.json();
    if (!response.ok) throw errorFromPayload(payload, '辨識失敗，請稍後重試。');
    const merged = mergeImportedCourses(courseStore, payload.importedCourses || []);
    courseStore = merged.courseStore;
    lastImportedCourses = (payload.importedCourses || []).filter((course) => !merged.duplicateIds.includes(course.id));
    pendingCourses = [...pendingCourses, ...(payload.pendingCourses || [])];
    const duplicateCount = merged.duplicateIds.length + (payload.duplicates?.length || 0);
    status.textContent = `新增 ${lastImportedCourses.length} 門；${duplicateCount} 門已存在；${payload.pendingCourses?.length || 0} 門待確認。`;
    persistState();
    renderAll();
    renderImportResults();
  } catch (error) {
    showAiError(status, retryButton, error);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

renderImportResults();
