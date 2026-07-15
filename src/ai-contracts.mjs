export class ContractError extends Error {
  constructor(message, status = 400, code = 'INVALID_REQUEST') {
    super(message);
    this.name = 'ContractError';
    this.status = status;
    this.code = code;
  }
}

const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/;

export function validateImportRequest(input) {
  const match = typeof input?.imageDataUrl === 'string' && input.imageDataUrl.match(IMAGE_PATTERN);
  if (!match) throw new ContractError('只接受 PNG、JPEG 或 WebP 截圖。');
  if (input.imageDataUrl.length > 4_000_000) {
    throw new ContractError('截圖超過 4 MB，請裁切或壓縮後重試。', 413, 'IMAGE_TOO_LARGE');
  }
  if (input.term !== '115-1') throw new ContractError('目前只支援 115-1。');
  return { imageDataUrl: input.imageDataUrl, term: input.term };
}

function parseJsonObject(content) {
  try {
    const source = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const value = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch {
    throw new ContractError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
  }
}

const text = (value) => typeof value === 'string' ? value.trim() : '';

export function parseRecognizedCourses(content) {
  const payload = parseJsonObject(content);
  if (!Array.isArray(payload.recognizedCourses) || payload.recognizedCourses.length > 50) {
    throw new ContractError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
  }
  const recognizedCourses = payload.recognizedCourses.map((course) => {
    const courseCode = text(course?.courseCode);
    const title = text(course?.title);
    if (!courseCode && !title) {
      throw new ContractError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
    }
    const numericCredits = course?.credits === null || course?.credits === ''
      ? null
      : Number(course?.credits);
    const numericConfidence = Number(course?.confidence);
    return {
      courseCode,
      title,
      teacher: text(course?.teacher),
      credits: Number.isFinite(numericCredits) ? numericCredits : null,
      scheduleText: text(course?.scheduleText),
      confidence: Number.isFinite(numericConfidence)
        ? Math.min(1, Math.max(0, numericConfidence))
        : 0,
    };
  });
  return { recognizedCourses };
}

const PROFILE_FIELDS = ['profileText', 'futureDirection', 'semesterGoals', 'preferences'];

export function validateRecommendationRequest(input) {
  if (!input || typeof input !== 'object') throw new ContractError('推薦需求格式不正確。');
  const normalized = {};
  PROFILE_FIELDS.forEach((field) => {
    normalized[field] = text(input[field]);
    if (normalized[field].length > 2_000) throw new ContractError('每個文字欄位最多 2,000 字。');
  });
  if (!Array.isArray(input.courses) || input.courses.length === 0 || input.courses.length > 100) {
    throw new ContractError('候選課程數量不正確。');
  }
  normalized.courses = input.courses.map((course) => {
    const id = text(course?.id);
    const title = text(course?.title);
    if (!id || !title) throw new ContractError('候選課程資料不完整。');
    return {
      id,
      title,
      credits: Number.isFinite(Number(course.credits)) ? Number(course.credits) : 0,
      teacher: text(course.teacher),
      schedule: course.schedule || null,
      meetings: Array.isArray(course.meetings) ? course.meetings : [],
      asyncAllowed: Boolean(course.asyncAllowed),
      conditions: Array.isArray(course.conditions) ? course.conditions.map(text).filter(Boolean) : [],
      eligibility: text(course.eligibility) || 'eligible',
    };
  });
  normalized.selectedCourseIds = Array.isArray(input.selectedCourseIds)
    ? input.selectedCourseIds.map(text).filter(Boolean)
    : [];
  normalized.lockedCourseIds = Array.isArray(input.lockedCourseIds)
    ? input.lockedCourseIds.map(text).filter(Boolean)
    : [];
  normalized.internshipSettings = input.internshipSettings && typeof input.internshipSettings === 'object'
    ? input.internshipSettings
    : {};
  return normalized;
}

export function parseRecommendedPlans(content, allowedCourseIds) {
  const payload = parseJsonObject(content);
  if (!Array.isArray(payload.plans) || payload.plans.length !== 3) {
    throw new ContractError('AI 必須回傳三個推薦方案。', 502, 'INVALID_AI_RESPONSE');
  }
  const planIds = new Set();
  const signatures = new Set();
  const plans = payload.plans.map((plan) => {
    const id = text(plan?.id);
    const title = text(plan?.title);
    const reason = text(plan?.reason);
    const courseIds = Array.isArray(plan?.courseIds) ? plan.courseIds.map(text).filter(Boolean) : [];
    const asyncCourseIds = Array.isArray(plan?.asyncCourseIds)
      ? [...new Set(plan.asyncCourseIds.map(text).filter(Boolean))]
      : [];
    if (!id || !title || !reason || !courseIds.length || planIds.has(id)) {
      throw new ContractError('AI 回覆格式不正確。', 502, 'INVALID_AI_RESPONSE');
    }
    const unknown = courseIds.find((courseId) => !allowedCourseIds.has(courseId));
    if (unknown) {
      throw new ContractError(`AI 回覆包含未知課程：${unknown}`, 502, 'INVALID_AI_RESPONSE');
    }
    const unknownAsync = asyncCourseIds.find((courseId) => !allowedCourseIds.has(courseId));
    if (unknownAsync) {
      throw new ContractError(`AI 回覆包含未知非同步課程：${unknownAsync}`, 502, 'INVALID_AI_RESPONSE');
    }
    planIds.add(id);
    const signature = [...new Set(courseIds)].sort().join('|');
    if (signatures.has(signature)) {
      throw new ContractError('AI 推薦方案內容必須互有差異。', 502, 'INVALID_AI_RESPONSE');
    }
    signatures.add(signature);
    return {
      id,
      title,
      reason,
      courseIds: [...new Set(courseIds)],
      asyncCourseIds,
      attendance: text(plan.attendance),
      tradeoffs: Array.isArray(plan.tradeoffs) ? plan.tradeoffs.map(text).filter(Boolean) : [],
    };
  });
  return { summary: text(payload.summary), plans };
}
