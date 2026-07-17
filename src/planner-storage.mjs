import { profileConditionIds } from './eligibility-conditions.mjs';
import { sanitizeOfficialEligibilityRules } from './nccu-course-adapter.mjs';
import { buildCandidateCatalog } from './planner-core.mjs';

export const STORAGE_KEY = 'nccu-course-planner:v3';

export function createStartupCatalog(savedState, officialCourses) {
  if (!savedState) return [];
  return buildCandidateCatalog(
    officialCourses,
    savedState.addedCourses || savedState.manualCourses,
    savedState.deletedCourseIds,
  ).map(sanitizeOfficialEligibilityRules);
}

export function serializePlannerState(state) {
  return JSON.stringify({ version: 5, state: migratePlannerState(state) });
}

export function migratePlannerState(state) {
  if (!state || typeof state !== 'object') return state;
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
    return [4, 5].includes(parsed?.version) && parsed.state
      ? migratePlannerState(parsed.state)
      : fallback;
  } catch {
    return fallback;
  }
}
