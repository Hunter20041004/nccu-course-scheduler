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
    courseStore = [...courses, ...(saved.manualCourses || [])];
    const attendance = saved.attendance || {};
    selected = (saved.selectedIds || [])
      .map((id) => courseStore.find((course) => course.id === id))
      .filter(Boolean)
      .map((course) => ({ ...course, attendance: attendance[course.id] || 'physical' }));
    courseStore.filter((course) => course.required).forEach((required) => {
      if (!selected.some((course) => course.id === required.id)) selected.push({ ...required, attendance: 'physical' });
    });
  } catch {
    selected = applyPreset(courseStore, 'concentrated');
  }
}

function persistState() {
  try {
    const manualCourses = courseStore.filter((course) => course.source === 'manual');
    localStorage.setItem(STORAGE_KEY, serializePlannerState({
      selectedIds: selected.map((course) => course.id),
      attendance: Object.fromEntries(selected.map((course) => [course.id, course.attendance])),
      profile,
      manualCourses,
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
  const availability = calculateInternshipAvailability(selected);
  const conflicts = findConflicts(selected);
  const eligibilityWarnings = selected.filter((course) => evaluateEligibility(course, profile).status !== 'eligible');
  const specialEvents = selected.reduce((total, course) => total + (course.events || []).length, 0);
  byId('credit-value').textContent = `${credits} 學分`;
  byId('internship-value').textContent = `${availability.equivalentDays} 天`;
  byId('warning-value').textContent = String(conflicts.length + eligibilityWarnings.length + specialEvents);
  document.querySelector('.status-pill').textContent = availability.meetsTarget ? '實習時間達標' : '實習時間不足';
}

function scheduleBlock(course) {
  const required = course.required;
  return `<div class="course-block ${required ? 'is-required' : ''}">
    <span>${escapeHtml(course.schedule?.label || '時間未定')}</span>
    <button type="button" data-remove-course="${escapeHtml(course.id)}" ${required ? 'disabled' : ''} aria-label="${required ? '必修固定' : '移除'} ${escapeHtml(course.title)}">
      <strong>${escapeHtml(course.title)}</strong><small>${required ? '必修固定' : '點擊移除'}</small>
    </button>
  </div>`;
}

function renderSchedule() {
  const physical = selected.filter((course) => course.attendance !== 'async' && course.schedule);
  byId('schedule-grid').innerHTML = [1, 2, 3, 4, 5, 6].map((day) => {
    const dayCourses = physical
      .filter((course) => course.schedule.day === day)
      .sort((first, second) => first.schedule.start - second.schedule.start);
    return `<section class="day" aria-label="${dayLabels[day]}"><h3>${dayLabels[day]}</h3><div class="day-courses">
      ${dayCourses.length ? dayCourses.map(scheduleBlock).join('') : '<p class="empty">沒有固定課程</p>'}
    </div></section>`;
  }).join('');

  const asynchronous = selected.filter((course) => course.attendance === 'async' || !course.schedule);
  byId('async-lane').innerHTML = asynchronous.length
    ? `<div class="async-list">${asynchronous.map((course) => `<button type="button" data-remove-course="${escapeHtml(course.id)}">${escapeHtml(course.title)} · ${course.attendance === 'async' ? '非同步' : '時間未定'}</button>`).join('')}</div>`
    : '<p class="empty">目前沒有非同步或時間未定課程</p>';
}

function renderWarnings() {
  const items = findConflicts(selected).map((conflict) => conflict.message);
  selected.forEach((course) => {
    const eligibility = evaluateEligibility(course, profile);
    if (eligibility.status !== 'eligible') items.push(`${course.title}：${eligibility.reasons.join('、')}`);
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
    const blocked = eligibility.status === 'blocked' || eligibility.status === 'unavailable';
    const attendance = selectedNow && course.asyncAllowed
      ? `<label class="attendance-control">出席方式<select data-attendance-course="${escapeHtml(course.id)}"><option value="physical" ${selectedCourse.attendance !== 'async' ? 'selected' : ''}>實體／固定同步</option><option value="async" ${selectedCourse.attendance === 'async' ? 'selected' : ''}>非同步</option></select></label>`
      : '';
    const sections = course.sections?.length
      ? `<details class="course-sections"><summary>查看 ${course.sections.length} 個班別</summary><ul>${course.sections.map((section) => `<li>${escapeHtml(section)}</li>`).join('')}</ul></details>`
      : '';
    return `<article class="catalog-course ${selectedNow ? 'is-selected' : ''}">
      <button type="button" data-course-id="${escapeHtml(course.id)}" aria-pressed="${selectedNow}" ${blocked || course.required ? 'disabled' : ''}>
        <span class="catalog-main"><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.sectionCode || '—')} · ${escapeHtml(course.teacher || '—')}</small></span>
        <span class="catalog-meta"><b>${course.credits} 學分</b><small>${course.asyncAllowed ? '可非同步 · ' : ''}${eligibilityLabel(eligibility.status)}</small></span>
      </button>
      <ul class="course-conditions">${(course.conditions || []).slice(0, 3).map((condition) => `<li>${escapeHtml(condition)}</li>`).join('')}</ul>
      ${sections}
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

const catalogList = byId('catalog-list');
catalogList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-course-id]');
  if (!button) return;
  const course = courseStore.find((item) => item.id === button.dataset.courseId);
  selected = toggleSelectableCourse(selected, course, profile);
  persistState();
  renderAll();
});

catalogList.addEventListener('change', (event) => {
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
  selected = toggleCourse(selected, course);
  persistState();
  renderAll();
}

byId('catalog-search').addEventListener('input', renderCatalog);
byId('catalog-filter').addEventListener('change', renderCatalog);
byId('preset-picker').addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  selected = applyPreset(courseStore, button.dataset.preset);
  persistState();
  renderAll();
});
byId('reset-plan').addEventListener('click', () => {
  selected = applyPreset(courseStore, 'concentrated');
  profile = { ...defaultProfile };
  syncProfileForm();
  persistState();
  renderAll();
});

let manualSequence = 1 + courseStore.filter((course) => course.source === 'manual').length;
byId('manual-form').innerHTML = `<form id="manual-course-form" class="manual-course-form" novalidate>
  <label class="form-wide">課程名稱<input id="manual-title" name="title" autocomplete="off" required placeholder="例如：服務設計"></label>
  <label>學分<input id="manual-credits" name="credits" type="number" min="0" max="12" step="0.5" value="3" required></label>
  <label>上課方式<select id="manual-mode" name="mode"><option value="physical">實體／固定同步</option><option value="async">非同步</option></select></label>
  <label>星期<select id="manual-day" name="day">${[1, 2, 3, 4, 5, 6].map((day) => `<option value="${day}">${dayLabels[day]}</option>`).join('')}</select></label>
  <label>開始<input id="manual-start" name="start" type="time" value="09:10"></label>
  <label>結束<input id="manual-end" name="end" type="time" value="12:00"></label>
  <button class="button button-primary form-wide" type="submit">建立並加入課表</button>
  <p id="manual-status" class="form-status form-wide" aria-live="polite"></p>
</form>`;

const manualForm = byId('manual-course-form');
const manualMode = byId('manual-mode');
function syncManualTimeFields() {
  const asynchronous = manualMode.value === 'async';
  ['manual-day', 'manual-start', 'manual-end'].forEach((id) => { byId(id).disabled = asynchronous; });
}
manualMode.addEventListener('change', syncManualTimeFields);
manualForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = {
    title: byId('manual-title').value,
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
