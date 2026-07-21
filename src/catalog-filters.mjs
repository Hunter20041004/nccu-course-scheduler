function fixedMeetings(course = {}) {
  if (course.attendance === 'async') return [];
  if (course.meetings?.length) return course.meetings;
  return course.schedule ? [course.schedule] : [];
}

export const CATALOG_DAYPARTS = Object.freeze({
  morning: Object.freeze({ start: 370, end: 720 }),
  afternoon: Object.freeze({ start: 730, end: 1080 }),
  evening: Object.freeze({ start: 1090, end: 1320 }),
});

export function countActiveCatalogFilters(filters = {}) {
  return ['statuses', 'weekdays', 'dayparts']
    .reduce((total, key) => total + new Set(filters[key] || []).size, 0);
}

function overlapsDaypart(meeting, daypart) {
  const window = CATALOG_DAYPARTS[daypart];
  if (!window) return false;
  return Number(meeting.start) < window.end && window.start < Number(meeting.end);
}

export function filterCandidateCourses(courses = [], filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  const statuses = new Set(filters.statuses || []);
  const selectedIds = new Set(filters.selectedIds || []);
  const eligibilityStatuses = filters.eligibilityStatuses || {};
  const attendanceByCourse = filters.attendanceByCourse || {};
  const weekdays = new Set((filters.weekdays || []).map(Number).filter(Number.isFinite));
  const requestedDayparts = new Set(filters.dayparts || []);
  const dayparts = new Set([...requestedDayparts].filter((value) => CATALOG_DAYPARTS[value]));
  const includesFlexible = requestedDayparts.has('flexible');
  return courses.filter((course) => {
    const haystack = `${course.title || ''} ${course.teacher || ''} ${course.sectionCode || ''}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    const statusMatches = !statuses.size
      || (statuses.has('selected') && selectedIds.has(course.id))
      || (statuses.has('remote') && (course.asyncAllowed || course.attendance === 'async'))
      || (statuses.has('review') && eligibilityStatuses[course.id] === 'review');
    if (!statusMatches) return false;
    if (!weekdays.size && !dayparts.size && !includesFlexible) return true;
    const meetings = fixedMeetings({
      ...course,
      attendance: attendanceByCourse[course.id] || course.attendance,
    });
    if (!weekdays.size && includesFlexible && !meetings.length) return true;
    return meetings.some((meeting) => {
      const weekdayMatches = !weekdays.size || weekdays.has(Number(meeting.day));
      const daypartMatches = !requestedDayparts.size
        || [...dayparts].some((daypart) => overlapsDaypart(meeting, daypart));
      return weekdayMatches && daypartMatches;
    });
  });
}
