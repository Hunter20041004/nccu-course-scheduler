import { evaluateEligibility, resolveCourseOption } from './planner-core.mjs';

const SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateScreenshotFile(file) {
  if (!file || !SCREENSHOT_TYPES.has(file.type)) return { message: '請選擇 PNG、JPEG 或 WebP 截圖。' };
  if (file.size > 3_000_000) return { message: '截圖超過 3 MB，請裁切或壓縮後重試。' };
  return null;
}

export function mergeImportedCourses(courseStore, importedCourses) {
  const ids = new Set(courseStore.map((course) => course.id));
  const duplicateIds = [];
  const additions = [];
  importedCourses.forEach((course) => {
    if (ids.has(course.id)) duplicateIds.push(course.id);
    else {
      ids.add(course.id);
      additions.push(course);
    }
  });
  return { courseStore: [...courseStore, ...additions], duplicateIds };
}

export function applyRecommendedPlan(plan, courseStore, selected, lockedCourseIds, profile) {
  const priorById = new Map(selected.map((course) => [course.id, course]));
  const orderedIds = [...new Set([
    ...(plan?.courseIds || []),
    ...lockedCourseIds,
  ])];
  return orderedIds.flatMap((id) => {
    const course = courseStore.find((item) => item.id === id);
    if (!course) return [];
    const eligibility = evaluateEligibility(course, profile);
    if (!lockedCourseIds.includes(id) && ['blocked', 'unavailable'].includes(eligibility.status)) return [];
    const prior = priorById.get(id);
    const resolved = resolveCourseOption(course, prior ? {
      variantId: prior.selectedVariantId,
      advisorId: prior.selectedAdvisorId,
    } : {});
    return [{ ...resolved, attendance: prior?.attendance || 'physical' }];
  });
}
