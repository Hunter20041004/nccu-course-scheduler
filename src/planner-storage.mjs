import { profileConditionIds } from './eligibility-conditions.mjs';
import { sanitizeOfficialEligibilityRules } from './nccu-course-adapter.mjs';
import { buildCandidateCatalog } from './planner-core.mjs';
import { officialSyllabusState } from './syllabus-state.mjs';

export const STORAGE_KEY = 'nccu-course-planner:v3';

export function createStartupCatalog(savedState, officialCourses) {
  if (!savedState) return [];
  const savedCourses = savedState.addedCourses || savedState.manualCourses || [];
  const officialIds = new Set(officialCourses.map((course) => course.id));
  const savedById = new Map(savedCourses.map((course) => [course.id, course]));
  const officialWithOverrides = officialCourses.map((course) => savedById.get(course.id) || course);
  const additions = savedCourses.filter((course) => !officialIds.has(course.id));
  return buildCandidateCatalog(
    officialWithOverrides,
    additions,
    savedState.deletedCourseIds,
  ).map(sanitizeOfficialEligibilityRules);
}

export function persistedCourseAdditions(courseStore, officialCourses) {
  const officialIds = new Set(officialCourses.map((course) => course.id));
  return courseStore.filter((course) => (
    !officialIds.has(course.id) || course.source === 'nccu-verified-import'
  ));
}

export function serializePlannerState(state) {
  return JSON.stringify({ version: 6, state: migratePlannerState(state) });
}

export function migratePlannerState(state) {
  if (!state || typeof state !== 'object') return state;
  const addedCourses = (state.addedCourses || []).map((course) => {
    if (course.source !== 'nccu-verified-import' || course.syllabus) return course;
    return {
      ...course,
      syllabus: officialSyllabusState({
        sourceUrl: course.sourceUrl,
        lookupStatus: course.sourceUrl ? 'success' : 'legacy',
        checkedAt: null,
      }),
    };
  });
  const courseOptions = Object.fromEntries(Object.entries(state.courseOptions || {}).map(([courseId, option]) => {
    if (!option?.variantId) return [courseId, option];
    const arrangementId = option.arrangementId
      || (option.variantId === '783006001' && option.advisorId ? option.advisorId : null);
    return [courseId, {
      sectionId: option.variantId,
      advisorId: arrangementId ? null : (option.advisorId || null),
      arrangementId,
    }];
  }));
  return {
    ...state,
    ...(Object.hasOwn(state, 'addedCourses') ? { addedCourses } : {}),
    ...(state.courseOptions ? { courseOptions } : {}),
  };
}

export function parsePlannerState(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 3 && parsed.state) {
      const legacyProfile = parsed.state.profile;
      const hasLegacyConditions = legacyProfile?.conditionIds?.length
        || legacyProfile?.programs?.length
        || legacyProfile?.prerequisites?.length;
      return migratePlannerState({
        ...parsed.state,
        ...(legacyProfile ? {
          profile: hasLegacyConditions
            ? { ...legacyProfile, conditionIds: profileConditionIds(legacyProfile) }
            : legacyProfile,
        } : {}),
      });
    }
    return [4, 5, 6].includes(parsed?.version) && parsed.state
      ? migratePlannerState(parsed.state)
      : fallback;
  } catch {
    return fallback;
  }
}
