export const STORAGE_KEY = 'nccu-course-planner:v2';

export function serializePlannerState(state) {
  return JSON.stringify({ version: 2, state });
}

export function parsePlannerState(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === 2 && parsed.state ? parsed.state : fallback;
  } catch {
    return fallback;
  }
}
