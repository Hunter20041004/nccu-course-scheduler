export const STORAGE_KEY = 'nccu-course-planner:v3';

export function serializePlannerState(state) {
  return JSON.stringify({ version: 3, state });
}

export function parsePlannerState(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === 3 && parsed.state ? parsed.state : fallback;
  } catch {
    return fallback;
  }
}
