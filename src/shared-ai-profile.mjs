export const AI_PROFILE_KEYS = [
  'profileText',
  'futureDirection',
  'semesterGoals',
  'preferences',
];

export function countCompletedAiProfileFields(profile = {}) {
  return AI_PROFILE_KEYS.filter((key) => String(profile[key] || '').trim()).length;
}

export function aiProfileCompletionLabel(profile = {}) {
  const count = countCompletedAiProfileFields(profile);
  return count ? `已填 ${count}／${AI_PROFILE_KEYS.length} 項` : '尚未填寫';
}
