function courseMeetings(course) {
  if (course.attendance === 'async') return [];
  if (course.meetings?.length) return course.meetings;
  return course.schedule ? [course.schedule] : [];
}

export function buildScheduleAgenda(courses = []) {
  const byDay = new Map();
  const flexible = [];

  courses.forEach((course) => {
    const meetings = courseMeetings(course);
    if (!meetings.length) {
      flexible.push({
        courseId: course.id,
        title: course.title,
        reason: course.attendance === 'async' ? '非同步' : '時間未定',
      });
      return;
    }
    meetings.forEach((meeting) => {
      if (!byDay.has(meeting.day)) byDay.set(meeting.day, []);
      byDay.get(meeting.day).push({
        courseId: course.id,
        title: course.title,
        sectionCode: course.sectionCode || '',
        start: meeting.start,
        end: meeting.end,
        label: meeting.label || '',
      });
    });
  });

  return {
    days: [...byDay.entries()]
      .sort(([first], [second]) => first - second)
      .map(([day, items]) => ({
        day,
        items: items.sort((first, second) => first.start - second.start || first.end - second.end),
      })),
    flexible,
  };
}
