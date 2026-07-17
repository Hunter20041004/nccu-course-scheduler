const PORTABLE_STATE_FIELDS = [
  'selectedIds',
  'attendance',
  'courseOptions',
  'lockedCourseIds',
  'internshipSettings',
  'profile',
  'addedCourses',
  'customConditions',
  'deletedCourseIds',
];

const PORTABLE_COURSE_FIELDS = [
  'id', 'title', 'credits', 'sectionCode', 'teacher', 'available', 'required',
  'schedule', 'meetings', 'events', 'asyncAllowed', 'level', 'minYear',
  'openToUndergradYear', 'undergradReview', 'conditions', 'sections', 'variants',
  'eligibilityRules', 'scheduleNotes', 'deliveryNotes', 'examEvents', 'programTags',
  'informationNotes', 'source', 'sourceUrl', 'syllabusUrl', 'itemType', 'deliveryMode',
];

const SENSITIVE_KEY = /api.?key|profiletext|screenshot|image.?data|prompt|provider|rawresponse/i;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,120}$/;

function safeClone(value) {
  if (Array.isArray(value)) return value.map(safeClone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .map(([key, nested]) => [key, safeClone(nested)]));
}

function portableCourse(course) {
  return Object.fromEntries(PORTABLE_COURSE_FIELDS
    .filter((field) => course?.[field] !== undefined)
    .map((field) => [field, safeClone(course[field])]));
}

function portableState(state = {}) {
  const result = Object.fromEntries(PORTABLE_STATE_FIELDS
    .filter((field) => state[field] !== undefined)
    .map((field) => [field, safeClone(state[field])]));
  if (Array.isArray(state.addedCourses)) result.addedCourses = state.addedCourses.map(portableCourse);
  return result;
}

function invalidTransferState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return true;
  for (const field of ['selectedIds', 'lockedCourseIds', 'deletedCourseIds']) {
    if (state[field] !== undefined && !Array.isArray(state[field])) return true;
    if (state[field]?.some((id) => typeof id !== 'string' || !SAFE_ID.test(id))) return true;
  }
  if (state.addedCourses !== undefined && !Array.isArray(state.addedCourses)) return true;
  if (state.addedCourses?.some((course) => (
    !course || typeof course !== 'object'
    || typeof course.id !== 'string' || !SAFE_ID.test(course.id)
    || typeof course.title !== 'string' || !course.title.trim()
  ))) return true;
  for (const field of ['attendance', 'courseOptions', 'internshipSettings', 'profile']) {
    if (state[field] !== undefined && (!state[field] || typeof state[field] !== 'object' || Array.isArray(state[field]))) return true;
  }
  if (state.customConditions !== undefined && !Array.isArray(state.customConditions)) return true;
  return false;
}

export function exportPlannerTransfer(state) {
  return JSON.stringify({
    format: 'sunbreak-planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: portableState(state),
  }, null, 2);
}

export function previewPlannerTransfer(raw, currentState = {}) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { valid: false, error: { code: 'INVALID_JSON', message: '匯入檔不是有效的 JSON。' } };
  }
  if (payload?.format !== 'sunbreak-planner') {
    return { valid: false, error: { code: 'INVALID_FORMAT', message: '這不是 Sunbreak 排課資料檔。' } };
  }
  if (payload.version !== 1) {
    return { valid: false, error: { code: 'UNSUPPORTED_VERSION', message: '這個排課資料版本目前不支援。' } };
  }
  if (invalidTransferState(payload.state)) {
    return { valid: false, error: { code: 'INVALID_STATE', message: '排課資料欄位不完整或格式不安全。' } };
  }
  const seenCourseIds = new Set();
  let skippedCourses = 0;
  const addedCourses = (payload.state.addedCourses || []).filter((course) => {
    if (seenCourseIds.has(course.id)) {
      skippedCourses += 1;
      return false;
    }
    seenCourseIds.add(course.id);
    return true;
  });
  const currentCourseIds = new Set((currentState.addedCourses || []).map(({ id }) => id));
  const state = portableState({ ...payload.state, addedCourses });
  return {
    valid: true,
    state,
    summary: {
      addedCourses: addedCourses.filter(({ id }) => !currentCourseIds.has(id)).length,
      replacedCourses: addedCourses.filter(({ id }) => currentCourseIds.has(id)).length,
      skippedCourses,
      selectedCourses: state.selectedIds?.length || 0,
      replacesSettings: Boolean(state.internshipSettings || state.profile),
    },
  };
}

export function applyPlannerTransfer(preview, currentState) {
  return preview?.valid ? preview.state : currentState;
}
