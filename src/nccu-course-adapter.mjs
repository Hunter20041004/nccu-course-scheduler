export class NccuLookupError extends Error {
  constructor(message = '政大課程資料暫時無法查詢。') {
    super(message);
    this.name = 'NccuLookupError';
  }
}

export function buildNccuCourseUrl({ term, keyword }) {
  const semester = String(term).replace('-', '');
  const query = `:sem=${semester} :curn=${String(keyword).trim()} `;
  return new URL(`/course/zh-TW/${encodeURIComponent(query)}/`, 'https://es.nccu.edu.tw');
}

export function normalizeNccuRows(rows, term) {
  if (!Array.isArray(rows)) throw new NccuLookupError();
  const [year, semester] = String(term).split('-');
  return rows
    .filter((row) => row?.y === year && row?.s === semester)
    .map((row) => ({
      courseCode: String(row.subNum || '').trim(),
      title: String(row.subNam || '').trim(),
      teacher: String(row.teaNam || '').trim(),
      credits: Number(row.subPoint),
      scheduleText: String(row.subTime || '').trim(),
      available: true,
      sourceUrl: String(row.teaSchmUrl || '').trim(),
    }))
    .filter((course) => course.courseCode && course.title && Number.isFinite(course.credits));
}

export async function searchNccuCourses({ term, keyword, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(buildNccuCourseUrl({ term, keyword }), {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error('NCCU response not ok');
    const rows = await response.json();
    return normalizeNccuRows(rows, term);
  } catch (error) {
    if (error instanceof NccuLookupError) throw error;
    throw new NccuLookupError();
  }
}
