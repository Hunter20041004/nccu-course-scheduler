const unique = (values) => [...new Set(values.filter(Boolean))];

const KNOWN_CONDITIONS = {
  'program:innovation': {
    label: '創新創業學程資格',
    category: 'program',
    description: '部分候選課程限定創新創業學程學生，或在第一階段優先開放。',
  },
  'prerequisite:statistics': {
    label: '修過統計學 3 學分',
    category: 'prerequisite',
    description: '部分量化課程將統計學 3 學分列為先修門檻。',
  },
};

export function profileConditionIds(profile = {}) {
  return unique([
    ...(profile.conditionIds || []),
    ...(profile.programs || []).map((program) => `program:${program}`),
    ...(profile.prerequisites || []).map((prerequisite) => `prerequisite:${prerequisite}`),
  ]);
}

export function rulesForCourse(course = {}) {
  return [
    ...(course.eligibilityRules || []),
    ...(course.programs || []).map((program) => ({
      conditionId: `program:${program}`,
      enforcement: 'required',
      rationale: `限具 ${program} 相關資格的學生。`,
    })),
    ...(course.prerequisites || []).map((prerequisite) => ({
      conditionId: `prerequisite:${prerequisite}`,
      enforcement: 'required',
      rationale: `須先具備 ${prerequisite}。`,
    })),
  ];
}

function fallbackDefinition(id) {
  const [category = 'other', rawLabel = id] = id.split(':', 2);
  return {
    label: rawLabel.replaceAll('-', ' '),
    category,
    description: '這項條件由候選課程的結構化選課限制產生。',
  };
}

export function buildConditionDefinitions(courses = [], customConditions = []) {
  const courseConditionIds = unique(courses.flatMap((course) => (
    rulesForCourse(course).map((rule) => rule.conditionId)
  )));
  const courseDefinitions = courseConditionIds.map((id) => ({
    id,
    ...(KNOWN_CONDITIONS[id] || fallbackDefinition(id)),
    source: 'course',
  }));
  const knownIds = new Set(courseConditionIds);
  return [
    ...courseDefinitions,
    ...customConditions.filter((condition) => !knownIds.has(condition.id)),
  ];
}
