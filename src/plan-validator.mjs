import { evaluateEligibility, findConflicts } from './planner-core.mjs';
import { calculateInternshipPlan } from './internship-planner.mjs';

const uniquePlanIds = (values) => [...new Set((values || []).filter(Boolean))];

export function validatePlan({
  plan = {},
  courses = [],
  lockedCourseIds = [],
  profile = {},
  minimumCredits = 0,
  internshipSettings = null,
  minimumInternshipDays = 0,
} = {}) {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const courseIds = uniquePlanIds([...(lockedCourseIds || []), ...(plan.courseIds || [])])
    .filter((id) => byId.has(id));
  const asyncCourseIds = uniquePlanIds(plan.asyncCourseIds || []).filter((id) => courseIds.includes(id));
  const selected = courseIds.map((id) => ({
    ...byId.get(id),
    attendance: asyncCourseIds.includes(id) ? 'async' : 'physical',
  }));
  const credits = selected.reduce((total, course) => total + Number(course.credits || 0), 0);
  const internship = internshipSettings ? calculateInternshipPlan(selected, internshipSettings) : null;
  const missingLockedCourseIds = uniquePlanIds(lockedCourseIds).filter((id) => !byId.has(id));
  const violations = missingLockedCourseIds.map((id) => ({
    code: 'missing-locked-course',
    message: `鎖定課程 ${id} 已不在候選課程中，無法產生完整方案。`,
    courseIds: [id],
  }));
  asyncCourseIds.forEach((id) => {
    const course = byId.get(id);
    if (course?.asyncAllowed) return;
    violations.push({
      code: 'invalid-async-course',
      message: `${course?.title || id} 不支援非同步上課。`,
      courseIds: [id],
    });
  });
  if (minimumCredits > 0 && credits < minimumCredits) {
    violations.push({
      code: 'minimum-credits',
      message: `方案只有 ${credits} 學分，未達最低 ${minimumCredits} 學分。`,
      courseIds,
    });
  }
  if (minimumInternshipDays > 0 && (!internship || internship.availableDays < minimumInternshipDays || internship.tentative)) {
    violations.push({
      code: 'minimum-internship-days',
      message: `方案只能確認 ${internship?.availableDays || 0} 天實習，未達最低 ${minimumInternshipDays} 天。`,
      courseIds,
    });
  }
  const warnings = [];
  selected.forEach((course) => {
    const eligibility = evaluateEligibility(course, profile);
    if (eligibility.status === 'review') {
      warnings.push({
        code: 'eligibility-review',
        message: `${course.title}：${eligibility.reasons.join('、')}`,
        courseIds: [course.id],
      });
      return;
    }
    if (!['blocked', 'unavailable'].includes(eligibility.status)) return;
    violations.push({
      code: eligibility.status === 'unavailable' ? 'unavailable-course' : 'blocked-course',
      message: `${course.title}：${eligibility.reasons.join('、')}`,
      courseIds: [course.id],
    });
  });
  violations.push(...findConflicts(selected).map((conflict) => ({
    code: conflict.type === 'event' ? 'event-conflict' : 'weekly-conflict',
    message: conflict.message,
    courseIds: conflict.courseIds,
  })));

  return {
    valid: violations.length === 0,
    courseIds,
    asyncCourseIds,
    credits,
    internship,
    violations,
    warnings,
  };
}
