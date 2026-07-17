import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../src/plan-validator.mjs';

const profile = {
  level: 'undergrad',
  year: 3,
  conditionIds: [],
  rejectedConditionIds: [],
};

test('rejects a route whose physical courses overlap every week', () => {
  const result = validatePlan({
    plan: { courseIds: ['a', 'b'], asyncCourseIds: [] },
    courses: [
      { id: 'a', title: '課程 A', credits: 3, schedule: { day: 2, start: 550, end: 720 } },
      { id: 'b', title: '課程 B', credits: 3, schedule: { day: 2, start: 610, end: 780 } },
    ],
    lockedCourseIds: [],
    profile,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['weekly-conflict']);
  assert.deepEqual(result.courseIds, ['a', 'b']);
});

test('rejects a route whose one-time exam overlaps another course', () => {
  const result = validatePlan({
    plan: { courseIds: ['exam-course', 'thursday-course'], asyncCourseIds: [] },
    courses: [
      {
        id: 'exam-course', title: '非同步課程', credits: 3, asyncAllowed: true,
        events: [{ label: '實體考試', day: 4, start: 790, end: 960 }],
      },
      {
        id: 'thursday-course', title: '週四課程', credits: 3,
        schedule: { day: 4, start: 790, end: 960 },
      },
    ],
    lockedCourseIds: [],
    profile,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['event-conflict']);
});

test('rejects a route when a locked course is missing from the candidate set', () => {
  const result = validatePlan({
    plan: { courseIds: ['available'], asyncCourseIds: [] },
    courses: [{ id: 'available', title: '可用課程', credits: 3 }],
    lockedCourseIds: ['deleted-locked-course'],
    profile,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['missing-locked-course']);
});

test('rejects a route containing a course the student explicitly cannot take', () => {
  const result = validatePlan({
    plan: { courseIds: ['restricted'], asyncCourseIds: [] },
    courses: [{
      id: 'restricted', title: '限制課程', credits: 3,
      eligibilityRules: [{
        conditionId: 'official:department',
        enforcement: 'required',
        rationale: '僅限本系學生修讀。',
      }],
    }],
    lockedCourseIds: [],
    profile: { ...profile, rejectedConditionIds: ['official:department'] },
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['blocked-course']);
});

test('rejects a route containing a course that is not open this term', () => {
  const result = validatePlan({
    plan: { courseIds: ['closed'], asyncCourseIds: [] },
    courses: [{ id: 'closed', title: '未開課程', credits: 3, available: false }],
    lockedCourseIds: [],
    profile,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['unavailable-course']);
});

test('keeps a reviewable course valid but requires a visible eligibility warning', () => {
  const result = validatePlan({
    plan: { courseIds: ['review'], asyncCourseIds: [] },
    courses: [{
      id: 'review', title: '待確認課程', credits: 3,
      eligibilityRules: [{
        conditionId: 'official:review',
        enforcement: 'required',
        rationale: '須向系所確認資格。',
      }],
    }],
    lockedCourseIds: [],
    profile,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings.map(({ code }) => code), ['eligibility-review']);
});

test('rejects asynchronous attendance for a course that does not allow it', () => {
  const result = validatePlan({
    plan: { courseIds: ['physical-only'], asyncCourseIds: ['physical-only'] },
    courses: [{ id: 'physical-only', title: '實體課', credits: 3, asyncAllowed: false }],
    lockedCourseIds: [],
    profile,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['invalid-async-course']);
});

test('rejects a route below the requested minimum credits', () => {
  const result = validatePlan({
    plan: { courseIds: ['a', 'b'], asyncCourseIds: [] },
    courses: [
      { id: 'a', title: '課程 A', credits: 3 },
      { id: 'b', title: '課程 B', credits: 3 },
    ],
    lockedCourseIds: [],
    profile,
    minimumCredits: 9,
  });

  assert.equal(result.credits, 6);
  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['minimum-credits']);
});

test('rejects a route that cannot preserve the requested internship days', () => {
  const courses = [1, 2, 3, 4].map((day) => ({
    id: `day-${day}`,
    title: `週${day}課程`,
    credits: 1,
    schedule: { day, start: 540, end: 1080 },
  }));
  const result = validatePlan({
    plan: { courseIds: courses.map(({ id }) => id), asyncCourseIds: [] },
    courses,
    lockedCourseIds: [],
    profile,
    internshipSettings: {
      targetDays: 2,
      start: '09:00',
      end: '18:00',
      mode: 'auto',
      fixedDays: {},
    },
    minimumInternshipDays: 2,
  });

  assert.equal(result.internship.availableDays, 1);
  assert.equal(result.valid, false);
  assert.deepEqual(result.violations.map(({ code }) => code), ['minimum-internship-days']);
});
