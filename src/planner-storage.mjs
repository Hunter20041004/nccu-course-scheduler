import { profileConditionIds } from './eligibility-conditions.mjs';

export const STORAGE_KEY = 'nccu-course-planner:v3';

export function serializePlannerState(state) {
  return JSON.stringify({ version: 4, state });
}

export function parsePlannerState(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 3 && parsed.state) {
      const legacyProfile = parsed.state.profile;
      const hasLegacyConditions = legacyProfile?.conditionIds?.length
        || legacyProfile?.programs?.length
        || legacyProfile?.prerequisites?.length;
      return {
        ...parsed.state,
        ...(legacyProfile ? {
          profile: hasLegacyConditions
            ? { ...legacyProfile, conditionIds: profileConditionIds(legacyProfile) }
            : legacyProfile,
        } : {}),
      };
    }
    return parsed?.version === 4 && parsed.state ? parsed.state : fallback;
  } catch {
    return fallback;
  }
}
