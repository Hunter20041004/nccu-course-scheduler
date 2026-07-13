import { toMinutes } from './nccu-periods.mjs';

export const DEFAULT_INTERNSHIP_SETTINGS = Object.freeze({
  targetDays: 2.5,
  start: '09:00',
  end: '18:00',
  mode: 'auto',
  fixedDays: {},
});

export function validateInternshipSettings(settings) {
  if (toMinutes(settings.end) - toMinutes(settings.start) < 120) {
    return {
      field: 'end',
      message: '實習結束時間必須晚於開始時間，且每日時段至少兩小時。',
    };
  }
  return null;
}

function overlaps(first, second) {
  return first.start < second.end && second.start < first.end;
}

function meetingsFor(course) {
  if (course.attendance === 'async') return [];
  if (course.meetings?.length) return course.meetings;
  return course.schedule ? [course.schedule] : [];
}

function dayWindows(settings, day) {
  const start = toMinutes(settings.start);
  const end = toMinutes(settings.end);
  const midpoint = start + ((end - start) / 2);
  return {
    full: { day, start, end, mode: 'full', value: 1 },
    morning: { day, start, end: midpoint - 30, mode: 'morning', value: 0.5 },
    afternoon: { day, start: midpoint + 30, end, mode: 'afternoon', value: 0.5 },
  };
}

function conflictsForWindow(selected, window) {
  return selected.flatMap((course) => meetingsFor(course)
    .filter((meeting) => meeting.day === window.day && overlaps(meeting, window))
    .map(() => ({ courseId: course.id, courseTitle: course.title, window })));
}

function automaticCandidates(selected, settings) {
  const full = [];
  const half = [];
  let availableDays = 0;
  for (let day = 1; day <= 5; day += 1) {
    const windows = dayWindows(settings, day);
    if (!conflictsForWindow(selected, windows.full).length) {
      full.push(windows.full);
      availableDays += 1;
      continue;
    }
    ['morning', 'afternoon'].forEach((mode) => {
      if (!conflictsForWindow(selected, windows[mode]).length) {
        half.push(windows[mode]);
        availableDays += 0.5;
      }
    });
  }
  return { availableDays, candidates: [...full, ...half] };
}

export function calculateInternshipPlan(selected, settings = DEFAULT_INTERNSHIP_SETTINGS) {
  if (settings.mode === 'fixed') {
    const displayWindows = Object.entries(settings.fixedDays || {})
      .filter(([, mode]) => mode && mode !== 'none')
      .map(([day, mode]) => dayWindows(settings, Number(day))[mode]);
    const conflicts = displayWindows.flatMap((window) => conflictsForWindow(selected, window));
    const conflictingWindows = new Set(conflicts.map(({ window }) => window));
    const availableDays = displayWindows.reduce((total, window) => (
      total + (conflictingWindows.has(window) ? 0 : window.value)
    ), 0);
    const tentative = selected.some((course) => (
      course.attendance !== 'async'
      && !course.schedule
      && !course.meetings?.length
    ));
    return {
      availableDays,
      suggestedWindows: [],
      displayWindows,
      conflicts,
      tentative,
      meetsTarget: availableDays >= settings.targetDays && !tentative,
    };
  }
  const { availableDays, candidates } = automaticCandidates(selected, settings);
  let planned = 0;
  const suggestedWindows = candidates.filter((window) => {
    if (planned >= settings.targetDays) return false;
    planned += window.value;
    return true;
  });
  const tentative = selected.some((course) => (
    course.attendance !== 'async'
    && !course.schedule
    && !course.meetings?.length
  ));
  return {
    availableDays,
    suggestedWindows,
    displayWindows: suggestedWindows,
    conflicts: [],
    tentative,
    meetsTarget: availableDays >= settings.targetDays && !tentative,
  };
}
