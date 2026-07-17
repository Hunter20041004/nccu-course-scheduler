function splitOfficialNotes(value) {
  return String(value || '')
    .split(/[；。\n]+/)
    .map((note) => note.trim())
    .filter(Boolean);
}

function requiredRule(courseCode, rationale, conditionLabel) {
  return {
    conditionId: `official-restriction:${courseCode}`,
    conditionLabel,
    conditionDescription: `政大官方限制：${rationale}`,
    enforcement: 'required',
    rationale,
    source: 'nccu-official',
    confidence: 'high',
  };
}

export function classifyOfficialNotes({ courseCode, restrictionText } = {}) {
  const result = {
    eligibilityRules: [],
    scheduleNotes: [],
    deliveryNotes: [],
    examEvents: [],
    programTags: [],
    informationNotes: [],
  };

  splitOfficialNotes(restrictionText).forEach((note) => {
    const normalized = note.replace(/^\d+\./, '').trim();
    const restrictedAudience = normalized.match(/^僅限(.+?)學生修讀$/)?.[1];
    if (restrictedAudience) {
      result.eligibilityRules.push(requiredRule(
        courseCode,
        normalized,
        `我是${restrictedAudience.replace('及雙主修', '或雙主修')}學生`,
      ));
      return;
    }
    if (/^限(?!制)[^。]+/.test(normalized)) {
      result.eligibilityRules.push(requiredRule(courseCode, normalized, `我符合：${normalized}`));
      return;
    }
    if (/(?:須|需).*(?:先修|修習|具備)/.test(normalized)) {
      const language = normalized.match(/(?:先修習|修習)[^，；]{0,30}(日文|英文|德文|法文)/)?.[1];
      result.eligibilityRules.push(requiredRule(
        courseCode,
        normalized,
        language && normalized.includes('或')
          ? `我符合本課程任一項${language}先修資格`
          : `我符合：${normalized}`,
      ));
      return;
    }
    const event = normalized.match(/^(\d{1,2}\/\d{1,2})(.+(?:考試|展示|成果).*)$/);
    if (event) {
      result.examEvents.push({ date: event[1], label: event[2].trim() });
      return;
    }
    if (/(?:英語|英文)授課|遠距上課|同步上課|非同步|NTUCOOL|Moodle/.test(normalized)) {
      result.deliveryNotes.push(normalized);
      return;
    }
    if (/(?:類課程|群[A-ZＡ-Ｚ]|擴大輔系課程|TAICA|人工智慧學程聯盟|學分學程)/.test(normalized)) {
      result.programTags.push(normalized);
      return;
    }
    result.informationNotes.push(normalized);
  });

  return result;
}
