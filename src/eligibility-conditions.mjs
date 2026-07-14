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

function impactConsequence(rule, selected) {
  if (selected) return '符合後可直接選';
  return rule.enforcement === 'review'
    ? '沒有也能選，但需教師／系所確認'
    : '沒有時無法直接加入';
}

export function buildConditionImpacts(courses = [], definitions = [], profile = {}) {
  const selectedIds = new Set(profileConditionIds(profile));
  return definitions.map((definition) => {
    const selected = selectedIds.has(definition.id);
    const affectedCourses = courses.flatMap((course) => (
      rulesForCourse(course)
        .filter((rule) => rule.conditionId === definition.id)
        .map((rule) => ({
          courseId: course.id,
          title: course.title,
          enforcement: rule.enforcement,
          rationale: rule.rationale,
          consequence: impactConsequence(rule, selected),
        }))
    ));
    return {
      ...definition,
      selected,
      summary: affectedCourses.length
        ? `影響 ${affectedCourses.length} 門候選課`
        : '目前不影響候選課，可安全移除',
      affectedCourses,
    };
  });
}

export function validateCustomCondition(input = {}, existingDefinitions = []) {
  if (!input.label?.trim()) {
    return { field: 'label', message: '請輸入條件名稱。' };
  }
  const normalizedLabel = input.label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-Hant');
  const duplicate = existingDefinitions.some((definition) => (
    definition.label?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-Hant') === normalizedLabel
  ));
  if (duplicate) {
    return { field: 'label', message: '這項條件已經存在。' };
  }
  return null;
}
