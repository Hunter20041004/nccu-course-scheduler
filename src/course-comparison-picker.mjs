const comparisonText = (value) => String(value ?? '').trim().toLocaleLowerCase('zh-Hant');

export function filterComparisonCourses(courses = [], query = '') {
  const term = comparisonText(query);
  if (!term) return courses;
  return courses.filter((course) => [course.title, course.teacher, course.sectionCode, course.id]
    .some((value) => comparisonText(value).includes(term)));
}
