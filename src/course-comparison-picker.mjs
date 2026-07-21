const comparisonText = (value) => String(value ?? '').trim().toLocaleLowerCase('zh-Hant');

export function filterComparisonCourses(courses = [], query = '') {
  const term = comparisonText(query);
  if (!term) return courses;
  return courses.filter((course) => [course.title, course.teacher, course.sectionCode, course.id]
    .some((value) => comparisonText(value).includes(term)));
}

export function toggleComparisonCourse(ids, courseId, checked, max = 5) {
  const current = [...new Set(ids)];
  if (!checked) return { ids: current.filter((id) => id !== courseId), limitReached: false };
  if (current.includes(courseId)) return { ids: current, limitReached: false };
  if (current.length >= max) return { ids: current, limitReached: true };
  return { ids: [...current, courseId], limitReached: false };
}

export function reconcileComparisonCourseIds(ids, courses) {
  const availableIds = new Set(courses.map(({ id }) => id));
  return [...new Set(ids)].filter((id) => availableIds.has(id));
}
