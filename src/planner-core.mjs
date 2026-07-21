import { formatNccuSchedule } from './nccu-periods.mjs';
import { profileConditionIds } from './eligibility-conditions.mjs';

export function evaluateEligibility(section, profile) {
  const reasons = [];
  const reviewReasons = [];
  const selectedConditionIds = new Set(profileConditionIds(profile));
  const rejectedConditionIds = new Set(profile.rejectedConditionIds || []);
  if (section.available === false) {
    return { status: 'unavailable', reasons: ['115-1 查無開課資料'] };
  }
  if (
    section.level === 'graduate'
    && profile.level === 'undergrad'
    && section.undergradReview
  ) {
    return {
      status: 'review',
      reasons: ['碩士班課程，學士生須確認選課資格與學分認列'],
    };
  }
  if (
    section.level === 'graduate'
    && profile.level === 'undergrad'
    && section.openToUndergradYear
    && profile.year >= section.openToUndergradYear
  ) {
    return {
      status: 'review',
      reasons: ['碩士班課程，課綱開放大三以上，需確認學分認列'],
    };
  }
  if (section.level === 'graduate' && profile.level === 'undergrad') {
    reasons.push('僅限碩、博士班');
  }
  if (section.minYear && profile.year < section.minYear) reasons.push(`限大${section.minYear}以上`);
  if (
    section.programs?.length
    && !section.programs.some((program) => (
      profile.programs?.includes(program) || selectedConditionIds.has(`program:${program}`)
    ))
  ) {
    reasons.push('學程限制');
  }
  (section.prerequisites || []).forEach((prerequisite) => {
    if (
      !profile.prerequisites?.includes(prerequisite)
      && !selectedConditionIds.has(`prerequisite:${prerequisite}`)
    ) reasons.push(`缺少先修：${prerequisite}`);
  });
  (section.eligibilityRules || []).forEach((rule) => {
    if (selectedConditionIds.has(rule.conditionId)) return;
    if (rule.enforcement === 'required' && rejectedConditionIds.has(rule.conditionId)) {
      reasons.push(rule.rationale);
      return;
    }
    reviewReasons.push(rule.rationale);
  });
  if (!reasons.length && reviewReasons.length) {
    return { status: 'review', reasons: reviewReasons };
  }
  return { status: reasons.length ? 'blocked' : 'eligible', reasons };
}

function overlaps(first, second) {
  return first.start < second.end && second.start < first.end;
}

function physicalMeetings(course) {
  if (course.attendance === 'async') return [];
  if (course.meetings?.length) return course.meetings;
  return course.schedule ? [course.schedule] : [];
}

export function candidateScheduleSummary(course = {}, labels = []) {
  if (course.attendance === 'async') return '非同步／時間彈性';
  const meetings = course.meetings?.length
    ? course.meetings
    : course.schedule ? [course.schedule] : [];
  const summaries = [...new Set(
    meetings.map((meeting) => formatNccuSchedule(meeting, labels)),
  )];
  if (summaries.length) return summaries.join('・');
  if (course.asyncAllowed) return '非同步／時間彈性';
  if (course.selectedVariantId) return '時間未定';
  if (course.variants?.length > 1) return '多時段可選';
  return '時間未定';
}

export function findConflicts(selected) {
  const conflicts = [];
  for (let index = 0; index < selected.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < selected.length; otherIndex += 1) {
      const first = selected[index];
      const second = selected[otherIndex];
      const weeklyOverlap = physicalMeetings(first).some((firstMeeting) => (
        physicalMeetings(second).some((secondMeeting) => (
          firstMeeting.day === secondMeeting.day && overlaps(firstMeeting, secondMeeting)
        ))
      ));
      if (weeklyOverlap) {
        conflicts.push({
          type: 'weekly',
          courseIds: [first.id, second.id],
          message: `${first.title} 與 ${second.title} 每週時段重疊`,
        });
      }
    }
  }
  selected.forEach((course) => {
    (course.events || []).forEach((event) => {
      selected.forEach((other) => {
        if (other.id !== course.id && physicalMeetings(other).some((meeting) => (
          meeting.day === event.day && overlaps(event, meeting)
        ))) {
          conflicts.push({
            type: 'event',
            courseIds: [course.id, other.id],
            message: `${course.title}的${event.label}與 ${other.title} 時段重疊`,
          });
        }
      });
    });
  });
  return conflicts;
}

export function calculateInternshipAvailability(selected) {
  const fullDays = [];
  const halfDays = [];
  const physical = selected.filter((course) => course.attendance !== 'async' && course.schedule);
  const morning = { start: 540, end: 780 };
  const afternoon = { start: 780, end: 1080 };

  for (let day = 1; day <= 5; day += 1) {
    const schedules = physical.filter((course) => course.schedule.day === day).map((course) => course.schedule);
    const morningOccupied = schedules.some((schedule) => overlaps(schedule, morning));
    const afternoonOccupied = schedules.some((schedule) => overlaps(schedule, afternoon));
    if (!morningOccupied && !afternoonOccupied) fullDays.push(day);
    else if (!morningOccupied || !afternoonOccupied) halfDays.push(day);
  }

  const equivalentDays = fullDays.length + (halfDays.length * 0.5);
  return { fullDays, halfDays, equivalentDays, meetsTarget: equivalentDays >= 2.5 };
}

export function clearPlannerSelection() {
  return { selected: [], lockedCourseIds: [], courseOptions: {} };
}

export function clearCandidateCatalog() {
  return { courseStore: [], selected: [], lockedCourseIds: [], courseOptions: {} };
}

export function toggleCourseLock(lockedCourseIds, courseId) {
  return lockedCourseIds.includes(courseId)
    ? lockedCourseIds.filter((id) => id !== courseId)
    : [...lockedCourseIds, courseId];
}

export function lockCandidateCourse(selected, lockedCourseIds, course, profile) {
  if (lockedCourseIds.includes(course.id)) {
    return {
      selected,
      lockedCourseIds: lockedCourseIds.filter((id) => id !== course.id),
    };
  }
  const nextSelected = selected.some((item) => item.id === course.id)
    ? selected
    : toggleSelectableCourse(selected, course, profile);
  if (!nextSelected.some((item) => item.id === course.id)) {
    return { selected, lockedCourseIds };
  }
  return { selected: nextSelected, lockedCourseIds: [...lockedCourseIds, course.id] };
}

export function toggleCourse(selected, course, lockedCourseIds = []) {
  const isSelected = selected.some((item) => item.id === course.id);
  if (isSelected && lockedCourseIds.includes(course.id)) return selected;
  if (!isSelected) return [...selected, { ...course, attendance: 'physical' }];
  return selected.filter((item) => item.id !== course.id);
}

export function toggleSelectableCourse(selected, course, profile) {
  const eligibility = evaluateEligibility(course, profile);
  if (eligibility.status === 'blocked' || eligibility.status === 'unavailable') return selected;
  if ((course.variants?.length || atomicSections(course).length) && !selected.some((item) => item.id === course.id)) {
    return [...selected, { ...resolveCourseOption(course), attendance: 'physical' }];
  }
  return toggleCourse(selected, course);
}

export function applyPreset(courses, presetId) {
  return courses
    .filter((course) => course.required || course.presets?.includes(presetId))
    .map((course) => ({
      ...course,
      attendance: course.presetAttendance?.[presetId] || 'physical',
    }));
}

function atomicSections(course) {
  return (course.sections || []).filter((section) => section && typeof section === 'object');
}

export function selectCourseSection(course, selection = {}) {
  const sections = atomicSections(course);
  if (!sections.length) return course;
  const sectionId = selection.sectionId || selection.variantId;
  const section = sections.find(({ id }) => id === sectionId);
  if (!section) {
    return {
      ...course,
      schedule: null,
      meetings: [],
      selectedSectionId: null,
      selectedVariantId: null,
      optionStatus: 'pending',
      optionMessage: '請選擇正式課號',
    };
  }

  const usesArrangements = Boolean(section.arrangements?.length);
  const choices = usesArrangements ? section.arrangements : (section.advisorOptions || []);
  const choiceId = usesArrangements
    ? (selection.arrangementId || selection.advisorId)
    : selection.advisorId;
  const choice = choices.find(({ id }) => id === choiceId);
  if (choices.length && !choice) {
    return {
      ...course,
      ...section,
      id: course.id,
      schedule: null,
      meetings: [],
      eligibilityRules: section.eligibilityRules ?? course.eligibilityRules ?? [],
      selectedSectionId: section.id,
      selectedVariantId: section.id,
      selectedAdvisorId: null,
      selectedArrangementId: null,
      optionStatus: 'pending',
      optionMessage: `請選擇${section.selectionLabel || (usesArrangements ? '時間安排' : '指導老師')}`,
    };
  }

  const source = choice || section;
  const schedule = source.schedule ?? section.schedule ?? null;
  const meetings = source.meetings ?? section.meetings ?? [];
  const unresolvedMessage = source.optionMessage || '時間尚未確認';
  return {
    ...course,
    ...section,
    ...source,
    id: course.id,
    schedule,
    meetings,
    eligibilityRules: source.eligibilityRules ?? section.eligibilityRules ?? course.eligibilityRules ?? [],
    selectedSectionId: section.id,
    selectedVariantId: section.id,
    selectedAdvisorId: usesArrangements ? null : (choice?.id || null),
    selectedArrangementId: usesArrangements ? (choice?.id || null) : null,
    optionStatus: schedule || meetings.length ? 'resolved' : 'flexible',
    optionMessage: schedule || meetings.length
      ? null
      : unresolvedMessage.startsWith('時間待確認') ? unresolvedMessage : `時間待確認：${unresolvedMessage}`,
  };
}

export function resolveCourseOption(course, selection = {}) {
  if (atomicSections(course).length) return selectCourseSection(course, selection);
  if (!course.variants?.length) return course;
  const variant = course.variants.find(({ id }) => id === selection.variantId);
  if (!variant) {
    return {
      ...course,
      schedule: null,
      optionStatus: 'pending',
      optionMessage: '請選擇正式課號',
    };
  }
  const advisor = variant.advisors?.find(({ id }) => id === selection.advisorId);
  if (variant.advisors?.length && !advisor) {
    return {
      ...course,
      ...variant,
      id: course.id,
      schedule: null,
      selectedVariantId: variant.id,
      selectedAdvisorId: null,
      optionStatus: 'pending',
      optionMessage: `請選擇${variant.selectionLabel || '指導老師'}`,
    };
  }
  const source = advisor || variant;
  return {
    ...course,
    ...variant,
    ...source,
    id: course.id,
    selectedVariantId: variant.id,
    selectedAdvisorId: advisor?.id || null,
    optionStatus: source.schedule ? 'resolved' : 'flexible',
    optionMessage: source.schedule ? null : (source.optionMessage || '時間尚未確認'),
  };
}

export function applyCourseOption(selected, courseId, selection) {
  return selected.map((course) => course.id === courseId
    ? { ...resolveCourseOption(course, selection), attendance: course.attendance }
    : course);
}

export function restoreOfficialCatalog(courseStore) {
  return courseStore.filter((course) => course.source !== 'manual');
}

export function deleteCandidateCourse(courseStore, selected, lockedCourseIds, courseId) {
  const deleted = courseStore.find((course) => course.id === courseId);
  if (!deleted) return { courseStore, selected, lockedCourseIds, deleted: null };
  return {
    courseStore: courseStore.filter((course) => course.id !== courseId),
    selected: selected.filter((course) => course.id !== courseId),
    lockedCourseIds: lockedCourseIds.filter((id) => id !== courseId),
    deleted,
  };
}

export function buildCandidateCatalog(officialCourses, manualCourses = [], deletedCourseIds = []) {
  const deleted = new Set(deletedCourseIds);
  return [
    ...officialCourses.filter((course) => !deleted.has(course.id)),
    ...manualCourses,
  ];
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function validateManualCourse(input) {
  if (!input.title?.trim()) return { field: 'title', message: '請輸入名稱。' };
  if (input.mode !== 'async' && timeToMinutes(input.end) <= timeToMinutes(input.start)) {
    return { field: 'end', message: '結束時間必須晚於開始時間。' };
  }
  return null;
}

export function createManualCourse(input, sequence) {
  const day = Number(input.day);
  const itemType = input.itemType || 'course';
  const dayLabels = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const manualSchedule = input.mode === 'async' ? null : {
    day,
    start: timeToMinutes(input.start),
    end: timeToMinutes(input.end),
    label: '',
  };
  if (manualSchedule) {
    manualSchedule.label = itemType === 'course'
      ? formatNccuSchedule(manualSchedule, dayLabels)
      : `${dayLabels[day]} ${input.start}–${input.end}`;
  }
  return {
    id: `manual-${sequence}`,
    title: input.title.trim(),
    itemType,
    credits: itemType === 'course' ? Number(input.credits) : 0,
    source: 'manual',
    attendance: input.mode,
    asyncAllowed: input.mode === 'async',
    required: false,
    available: true,
    schedule: manualSchedule,
    conditions: [itemType === 'course' ? '手動新增，尚未查證官方資料' : '自訂每週行程'],
  };
}
