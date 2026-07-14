const byId = (id) => document.getElementById(id);
const defaultProfile = {
  level: 'undergrad',
  year: 3,
  programs: ['innovation'],
  prerequisites: [],
};

let profile = { ...defaultProfile };
let courseStore = [...courses];
let selected = applyPreset(courseStore, 'concentrated');
let courseOptions = {};
let lockedCourseIds = [];
let internshipSettings = { ...DEFAULT_INTERNSHIP_SETTINGS, fixedDays: {} };

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
    courseStore = buildCandidateCatalog(courses, saved.manualCourses, saved.deletedCourseIds);
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
    selected = applyPreset(courseStore, 'concentrated');
  }
}

function persistState() {
  try {
    const manualCourses = courseStore.filter((course) => course.source === 'manual');
    const retainedIds = new Set(courseStore.map((course) => course.id));
    const deletedCourseIds = courses
      .filter((course) => !retainedIds.has(course.id))
      .map((course) => course.id);
    localStorage.setItem(STORAGE_KEY, serializePlannerState({
      selectedIds: selected.map((course) => course.id),
      attendance: Object.fromEntries(selected.map((course) => [course.id, course.attendance])),
      courseOptions,
      lockedCourseIds,
      internshipSettings,
      profile,
      manualCourses,
      deletedCourseIds,
    }));
  } catch {
    // The planner still works when browser storage is unavailable.
  }
}

function eligibilityLabel(status) {
  return {
    eligible: '條件符合',
    conditional: '資格需確認',
    blocked: '目前不符',
    unavailable: '115-1 未開',
  }[status];
}

function renderStats() {
  const credits = selected.reduce((total, course) => total + Number(course.credits || 0), 0);
  const internshipPlan = calculateInternshipPlan(selected, internshipSettings);
  const conflicts = findConflicts(selected);
  const eligibilityWarnings = selected.filter((course) => evaluateEligibility(course, profile).status !== 'eligible');
  const specialEvents = selected.reduce((total, course) => total + (course.events || []).length, 0);
  const optionWarnings = selected.filter((course) => course.optionStatus === 'pending' || course.optionStatus === 'flexible').length;
  byId('credit-value').textContent = `${credits} 學分`;
  byId('internship-value').textContent = `${internshipPlan.tentative ? '暫估 ' : ''}${internshipPlan.availableDays} / ${internshipSettings.targetDays} 天`;
  byId('warning-value').textContent = String(conflicts.length + eligibilityWarnings.length + specialEvents + optionWarnings + internshipPlan.conflicts.length);
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
  return `<article class="grid-course ${stateClasses}" role="cell" style="--grid-column:${meeting.day + 1};--grid-row:${placement.rowStart};--row-span:${placement.rowSpan}">
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

  const asynchronous = selected.filter((course) => course.attendance === 'async' || !meetingsForCourse(course).length);
  byId('async-lane').innerHTML = asynchronous.length
    ? `<div class="async-list">${asynchronous.map((course) => `<button type="button" data-remove-course="${escapeHtml(course.id)}">${escapeHtml(course.title)} · ${course.attendance === 'async' ? '非同步' : '時間未定'}</button>`).join('')}</div>`
    : '<p class="empty">目前沒有非同步或時間未定課程</p>';
}

function renderWarnings() {
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
  byId('warning-list').innerHTML = items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="empty">目前沒有需要處理的提醒。</p>';
}

function renderCatalog() {
  const catalogList = byId('catalog-list');
  const query = byId('catalog-search').value.trim().toLowerCase();
  const filter = byId('catalog-filter').value;
  const visible = courseStore.filter((course) => {
    const eligibility = evaluateEligibility(course, profile);
    const selectedNow = selected.some((item) => item.id === course.id);
    const haystack = `${course.title} ${course.teacher} ${course.sectionCode}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (filter === 'selected' && !selectedNow) return false;
    if (filter === 'remote' && !course.asyncAllowed) return false;
    if (filter === 'conditional' && eligibility.status !== 'conditional') return false;
    return true;
  });
  byId('catalog-count').textContent = `${visible.length} / ${courseStore.length}`;
  catalogList.innerHTML = visible.map((course) => {
    const eligibility = evaluateEligibility(course, profile);
    const selectedNow = selected.some((item) => item.id === course.id);
    const selectedCourse = selected.find((item) => item.id === course.id);
    const locked = lockedCourseIds.includes(course.id);
    const blocked = eligibility.status === 'blocked' || eligibility.status === 'unavailable';
    const attendance = selectedNow && course.asyncAllowed
      ? `<label class="attendance-control">出席方式<select data-attendance-course="${escapeHtml(course.id)}"><option value="physical" ${selectedCourse.attendance !== 'async' ? 'selected' : ''}>實體／固定同步</option><option value="async" ${selectedCourse.attendance === 'async' ? 'selected' : ''}>非同步</option></select></label>`
      : '';
    const conditions = course.conditions || [];
    const sections = course.sections || [];
    const details = `<details class="course-details">
          <summary aria-label="查看 ${escapeHtml(course.title)} 的限制與班別">詳細</summary>
          <div class="course-details-card">
            ${conditions.length ? `<strong>選課條件</strong><ul class="course-conditions">${conditions.map((condition) => `<li>${escapeHtml(condition)}</li>`).join('')}</ul>` : ''}
            ${sections.length ? `<strong>官方班別</strong><ul class="course-sections">${sections.map((section) => `<li>${escapeHtml(section)}</li>`).join('')}</ul>` : ''}
            ${!conditions.length && !sections.length ? '<p>目前沒有額外限制。</p>' : ''}
          </div>
        </details>`;
    const selectedVariant = selectedCourse?.variants?.find(({ id }) => id === selectedCourse.selectedVariantId);
    const optionControls = selectedNow && course.variants?.length
      ? `<div class="course-option-controls">
          <label>正式課號<select data-course-variant="${escapeHtml(course.id)}">
            <option value="">請選擇</option>
            ${course.variants.map((variant) => `<option value="${escapeHtml(variant.id)}" ${selectedCourse?.selectedVariantId === variant.id ? 'selected' : ''}>${escapeHtml(variant.sectionCode || variant.id)} · ${escapeHtml(variant.teacher || '依指導老師')}</option>`).join('')}
          </select></label>
          ${selectedVariant?.advisors?.length ? `<label>指導老師與時段<select data-course-advisor="${escapeHtml(course.id)}">
            <option value="">請選擇</option>
            ${selectedVariant.advisors.map((advisor) => `<option value="${escapeHtml(advisor.id)}" ${selectedCourse.selectedAdvisorId === advisor.id ? 'selected' : ''}>${escapeHtml(advisor.teacher)} · ${escapeHtml(advisor.schedule?.label || '彈性時間')}</option>`).join('')}
          </select></label>` : ''}
          <p>${escapeHtml(selectedCourse?.optionMessage || '選定後會把對應時段放進左側課表。')}</p>
        </div>`
      : '';
    return `<article class="catalog-course ${selectedNow ? 'is-selected' : ''}">
      <button class="catalog-select" type="button" data-course-id="${escapeHtml(course.id)}" aria-pressed="${selectedNow}" ${blocked ? 'disabled' : ''}>
        <span class="catalog-main"><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.sectionCode || '—')} · ${escapeHtml(course.teacher || '—')}</small></span>
        <span class="catalog-meta"><b>${course.credits} 學分</b><small>${course.asyncAllowed ? '可非同步 · ' : ''}${eligibilityLabel(eligibility.status)}</small></span>
      </button>
      <div class="course-actions">
        ${details}
        <button class="catalog-lock ${locked ? 'is-active' : ''}" type="button" data-lock-course="${escapeHtml(course.id)}" aria-pressed="${locked}" aria-label="${locked ? '解鎖' : '鎖定'} ${escapeHtml(course.title)}">${locked ? '解鎖' : '鎖定'}</button>
        <button class="catalog-delete" type="button" data-delete-course="${escapeHtml(course.id)}" aria-label="刪除候選課程 ${escapeHtml(course.title)}">刪除</button>
      </div>
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
}

restoreState();
syncProfileForm();
syncInternshipForm();
renderAll();

function syncProfileForm() {
  byId('profile-level').value = profile.level;
  byId('profile-year').value = String(profile.year);
  byId('profile-innovation').checked = profile.programs.includes('innovation');
  byId('profile-statistics').checked = profile.prerequisites.includes('statistics');
}

byId('profile-form').addEventListener('change', () => {
  profile.level = byId('profile-level').value;
  profile.year = Number(byId('profile-year').value);
  profile.programs = byId('profile-innovation').checked ? ['innovation'] : [];
  profile.prerequisites = byId('profile-statistics').checked ? ['statistics'] : [];
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
catalogList.addEventListener('click', (event) => {
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
    const result = deleteCandidateCourse(courseStore, selected, lockedCourseIds, course.id);
    courseStore = result.courseStore;
    selected = result.selected;
    lockedCourseIds = result.lockedCourseIds;
    delete courseOptions[course.id];
    byId('catalog-status').textContent = `已刪除「${course.title}」；按「恢復建議方案」可找回官方課程。`;
    persistState();
    renderAll();
    return;
  }
  const button = event.target.closest('[data-course-id]');
  if (!button) return;
  const course = courseStore.find((item) => item.id === button.dataset.courseId);
  selected = selected.some((item) => item.id === course.id)
    ? toggleCourse(selected, course, lockedCourseIds)
    : toggleSelectableCourse(selected, course, profile);
  persistState();
  renderAll();
});

catalogList.addEventListener('change', (event) => {
  const optionSelect = event.target.closest('[data-course-variant], [data-course-advisor]');
  if (optionSelect) {
    const courseId = optionSelect.dataset.courseVariant || optionSelect.dataset.courseAdvisor;
    const current = courseOptions[courseId] || {};
    const selection = optionSelect.dataset.courseVariant
      ? { variantId: optionSelect.value, advisorId: null }
      : { ...current, advisorId: optionSelect.value };
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
byId('catalog-filter').addEventListener('change', renderCatalog);
byId('preset-picker').addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  selected = applyPreset(courseStore, button.dataset.preset);
  lockedCourseIds = [];
  persistState();
  renderAll();
});
byId('reset-plan').addEventListener('click', () => {
  courseStore = restoreOfficialCatalog(courses);
  selected = applyPreset(courseStore, 'concentrated');
  profile = { ...defaultProfile };
  courseOptions = {};
  lockedCourseIds = [];
  internshipSettings = { ...DEFAULT_INTERNSHIP_SETTINGS, fixedDays: {} };
  byId('catalog-status').textContent = '已恢復全部官方候選課程與建議方案。';
  syncProfileForm();
  syncInternshipForm();
  persistState();
  renderAll();
});
byId('clear-schedule').addEventListener('click', () => {
  const cleared = clearPlannerSelection();
  selected = cleared.selected;
  lockedCourseIds = cleared.lockedCourseIds;
  courseOptions = cleared.courseOptions;
  byId('planner-status').textContent = '已清空目前課表。';
  persistState();
  renderAll();
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

const CODEX_HANDOFF_PROMPT = '請辨識我附上的政大課程備選清單截圖，逐門查詢 115-1 官方課程資料、選課條件、時間、學分與遠距方式，再整理成可以加入排課網站的課程塊。';
byId('screenshot-handoff').innerHTML = `<div class="screenshot-handoff">
  <label>選擇備選清單截圖<input id="screenshot-input" type="file" accept="image/png,image/jpeg,image/webp"></label>
  <img id="screenshot-preview" class="screenshot-preview" alt="備選課程截圖預覽" hidden>
  <p>這個私人版本不會把截圖傳到伺服器。請把同一張圖附回目前的 Codex 任務，再貼上下方指令，我就能查官方資料並整理成課程塊。</p>
  <textarea id="handoff-prompt" rows="5" readonly>${CODEX_HANDOFF_PROMPT}</textarea>
  <button id="copy-codex-prompt" class="button button-primary" type="button">複製給 Codex 的指令</button>
  <p id="screenshot-status" class="form-status" aria-live="polite"></p>
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
  byId('screenshot-status').textContent = '截圖只在這台裝置預覽，尚未傳送。';
});

byId('copy-codex-prompt').addEventListener('click', async () => {
  const status = byId('screenshot-status');
  if (!byId('screenshot-input').files.length) {
    status.textContent = '請先選擇一張課程備選清單截圖。';
    byId('screenshot-input').focus();
    return;
  }
  try {
    await navigator.clipboard.writeText(CODEX_HANDOFF_PROMPT);
    status.textContent = '指令已複製；請把截圖附回目前的 Codex 任務。';
  } catch {
    byId('handoff-prompt').select();
    status.textContent = '瀏覽器未開放剪貼簿，請手動複製上方文字。';
  }
});
