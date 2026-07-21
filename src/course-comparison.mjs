import { ContractError } from './ai-contracts.mjs';
import { trustedNccuUrl } from './nccu-url.mjs';

const COMPARISON_PROFILE_FIELDS = ['profileText', 'futureDirection', 'semesterGoals', 'preferences'];
const comparisonText = (value) => typeof value === 'string' ? value.trim() : '';

function normalizedMeeting(meeting) {
  return {
    day: Number(meeting?.day),
    start: Number(meeting?.start),
    end: Number(meeting?.end),
    label: comparisonText(meeting?.label),
  };
}

export function validateComparisonRequest(input) {
  if (!input || typeof input !== 'object') {
    throw new ContractError('課程比較需求格式不正確。', 400, 'INVALID_COMPARISON_REQUEST');
  }
  if (!Array.isArray(input.courses) || input.courses.length < 2 || input.courses.length > 5) {
    throw new ContractError('請選擇 2 至 5 門課進行比較。', 400, 'INVALID_COMPARISON_COUNT');
  }
  const seenIds = new Set();
  const courses = input.courses.map((course) => {
    const id = comparisonText(course?.id);
    const title = comparisonText(course?.title);
    if (!id || !title || seenIds.has(id)) {
      throw new ContractError('比較課程資料不完整或重複。', 400, 'INVALID_COMPARISON_COURSE');
    }
    seenIds.add(id);
    const rawSyllabusUrl = comparisonText(course.syllabusUrl);
    const syllabusUrl = rawSyllabusUrl ? trustedNccuUrl(rawSyllabusUrl) : '';
    if (rawSyllabusUrl && !syllabusUrl) {
      throw new ContractError('只允許比較政大官方課綱。', 400, 'UNTRUSTED_SYLLABUS_URL');
    }
    return {
      id,
      sectionCode: comparisonText(course.sectionCode),
      title,
      teacher: comparisonText(course.teacher),
      credits: Number.isFinite(Number(course.credits)) ? Number(course.credits) : 0,
      syllabusUrl,
      schedule: course.schedule || null,
      meetings: Array.isArray(course.meetings) ? course.meetings.map(normalizedMeeting) : [],
      conditions: Array.isArray(course.conditions) ? course.conditions.map(comparisonText).filter(Boolean) : [],
    };
  });
  const normalized = { courses };
  COMPARISON_PROFILE_FIELDS.forEach((field) => {
    normalized[field] = comparisonText(input[field]);
    if (normalized[field].length > 2_000) {
      throw new ContractError('每個個人化欄位最多 2,000 字。', 400, 'COMPARISON_PROFILE_TOO_LONG');
    }
  });
  return normalized;
}

export function profileContextState(input) {
  return COMPARISON_PROFILE_FIELDS.some((field) => comparisonText(input?.[field])) ? 'personalized' : 'objective';
}

export function buildChatGptComparisonPrompt(context) {
  const courseBlocks = context.courses.map((course, index) => [
    `## 課程 ${index + 1}：${course.title}`,
    `課號／識別碼：${course.id}`,
    `教師：${course.teacher || '未提供'}`,
    `學分：${course.credits || 0}`,
    `官方課綱：${course.syllabusUrl || '無可用連結'}`,
    course.syllabusText || '課綱文字目前無法取得',
  ].join('\n')).join('\n\n');
  const profileLines = [
    ['自我介紹', context.profileText],
    ['未來方向', context.futureDirection],
    ['學期目標', context.semesterGoals],
    ['排課偏好', context.preferences],
  ].filter(([, value]) => comparisonText(value)).map(([label, value]) => `${label}：${comparisonText(value)}`);
  const profileNote = profileLines.length
    ? `以下個人資料為選填內容，請另行提出個人化建議：\n${profileLines.join('\n')}`
    : '未提供個人目標，請只做客觀比較。';
  return `請比較以下政大課程，協助我判斷內容是否重複，以及衝堂時該如何取捨。\n\n${profileNote}\n\n${courseBlocks}\n\n請將「課綱事實」與「你的推論」分開，依序提供：共同主題、各課獨有內容、評量方式、預估負擔、適合的學生、取捨建議與資料限制。課綱沒有寫的內容請明確標示未知，不要自行補寫。`;
}

function parseComparisonJsonObject(content) {
  try {
    const source = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const value = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch {
    throw new ContractError('AI 課程比較格式不正確。', 502, 'INVALID_AI_RESPONSE');
  }
}

export function parseCourseComparison(content, allowedCourseIds) {
  const payload = parseComparisonJsonObject(content);
  const courses = Array.isArray(payload.courses) ? payload.courses : [];
  const recommendationIds = Array.isArray(payload.recommendation?.courseIds)
    ? payload.recommendation.courseIds.map(comparisonText).filter(Boolean)
    : [];
  const referencedIds = [
    ...courses.map((course) => comparisonText(course?.id)),
    ...recommendationIds,
  ];
  if (referencedIds.some((id) => !allowedCourseIds.has(id))) {
    throw new ContractError('AI 課程比較包含未知課程。', 502, 'INVALID_AI_RESPONSE');
  }
  const overlapScore = Number(payload.overlap?.score);
  const courseIds = courses.map((course) => comparisonText(course?.id));
  const courseIdSet = new Set(courseIds);
  const hasAllCourses = courseIdSet.size === allowedCourseIds.size
    && [...allowedCourseIds].every((id) => courseIdSet.has(id));
  const completeCourses = courses.every((course) => (
    comparisonText(course?.id)
    && comparisonText(course?.focus)
    && comparisonText(course?.uniqueValue)
    && comparisonText(course?.assessment)
    && comparisonText(course?.workload)
  ));
  const confidence = comparisonText(payload.recommendation?.confidence);
  if (
    !comparisonText(payload.summary)
    || !Number.isFinite(overlapScore)
    || overlapScore < 0
    || overlapScore > 100
    || !comparisonText(payload.overlap?.level)
    || !Array.isArray(payload.overlap?.sharedTopics)
    || !hasAllCourses
    || !completeCourses
    || !comparisonText(payload.recommendation?.reason)
    || !['low', 'medium', 'high'].includes(confidence)
    || typeof payload.personalized?.used !== 'boolean'
    || !Array.isArray(payload.limitations)
  ) {
    throw new ContractError('AI 課程比較格式不正確。', 502, 'INVALID_AI_RESPONSE');
  }
  return {
    summary: comparisonText(payload.summary),
    overlap: {
      score: overlapScore,
      level: comparisonText(payload.overlap.level),
      sharedTopics: payload.overlap.sharedTopics.map(comparisonText).filter(Boolean),
    },
    courses: courses.map((course) => ({
      id: comparisonText(course.id),
      focus: comparisonText(course.focus),
      uniqueValue: comparisonText(course.uniqueValue),
      assessment: comparisonText(course.assessment),
      workload: comparisonText(course.workload),
    })),
    recommendation: {
      courseIds: [...new Set(recommendationIds)],
      reason: comparisonText(payload.recommendation.reason),
      confidence,
    },
    personalized: {
      used: payload.personalized.used,
      reason: comparisonText(payload.personalized.reason),
    },
    limitations: payload.limitations.map(comparisonText).filter(Boolean),
  };
}
