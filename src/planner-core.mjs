import { formatNccuSchedule } from './nccu-periods.mjs';

export function evaluateEligibility(section, profile) {
  const reasons = [];
  if (section.available === false) {
    return { status: 'unavailable', reasons: ['115-1 查無開課資料'] };
  }
  if (
    section.level === 'graduate'
    && profile.level === 'undergrad'
    && section.openToUndergradYear
    && profile.year >= section.openToUndergradYear
  ) {
    return {
      status: 'conditional',
      reasons: ['碩士班課程，課綱開放大三以上，需確認學分認列'],
    };
  }
  if (section.level === 'graduate' && profile.level === 'undergrad') {
    reasons.push('僅限碩、博士班');
  }
  if (section.minYear && profile.year < section.minYear) reasons.push(`限大${section.minYear}以上`);
  if (
    section.programs?.length
    && !section.programs.some((program) => profile.programs.includes(program))
  ) {
    reasons.push('學程限制');
  }
  (section.prerequisites || []).forEach((prerequisite) => {
    if (!profile.prerequisites.includes(prerequisite)) reasons.push(`缺少先修：${prerequisite}`);
  });
  return { status: reasons.length ? 'blocked' : 'eligible', reasons };
}

function overlaps(first, second) {
  return first.start < second.end && second.start < first.end;
}

export function findConflicts(selected) {
  const conflicts = [];
  for (let index = 0; index < selected.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < selected.length; otherIndex += 1) {
      const first = selected[index];
      const second = selected[otherIndex];
      if (
        first.attendance !== 'async'
        && second.attendance !== 'async'
        && first.schedule?.day === second.schedule?.day
        && overlaps(first.schedule, second.schedule)
      ) {
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
        if (
          other.id !== course.id
          && other.attendance !== 'async'
          && other.schedule?.day === event.day
          && overlaps(event, other.schedule)
        ) {
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

export function toggleCourse(selected, course) {
  const isSelected = selected.some((item) => item.id === course.id);
  if (isSelected && course.required) return selected;
  if (!isSelected) return [...selected, { ...course, attendance: 'physical' }];
  return selected.filter((item) => item.id !== course.id);
}

export function toggleSelectableCourse(selected, course, profile) {
  const eligibility = evaluateEligibility(course, profile);
  if (eligibility.status === 'blocked' || eligibility.status === 'unavailable') return selected;
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

export function resolveCourseOption(course, selection = {}) {
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
      schedule: null,
      optionStatus: 'pending',
      optionMessage: '請選擇指導老師',
    };
  }
  const source = advisor || variant;
  return {
    ...course,
    ...variant,
    ...source,
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

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function validateManualCourse(input) {
  if (!input.title?.trim()) return { field: 'title', message: '請輸入課程名稱。' };
  if (input.mode !== 'async' && timeToMinutes(input.end) <= timeToMinutes(input.start)) {
    return { field: 'end', message: '結束時間必須晚於開始時間。' };
  }
  return null;
}

export function createManualCourse(input, sequence) {
  const day = Number(input.day);
  const dayLabels = ['', '週一', '週二', '週三', '週四', '週五', '週六'];
  const manualSchedule = input.mode === 'async' ? null : {
    day,
    start: timeToMinutes(input.start),
    end: timeToMinutes(input.end),
    label: '',
  };
  if (manualSchedule) manualSchedule.label = formatNccuSchedule(manualSchedule, dayLabels);
  return {
    id: `manual-${sequence}`,
    title: input.title.trim(),
    credits: Number(input.credits),
    source: 'manual',
    attendance: input.mode,
    asyncAllowed: input.mode === 'async',
    required: false,
    available: true,
    schedule: manualSchedule,
    conditions: ['手動新增，尚未查證官方資料'],
  };
}
