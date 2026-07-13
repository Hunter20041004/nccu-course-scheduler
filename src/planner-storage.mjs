export const STORAGE_KEY = 'nccu-course-planner:v1';

export function serializePlannerState(state) {
  return JSON.stringify({ version: 1, state });
}

export function parsePlannerState(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === 1 && parsed.state ? parsed.state : fallback;
  } catch {
    return fallback;
  }
}
