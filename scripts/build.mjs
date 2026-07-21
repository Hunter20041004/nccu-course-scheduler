import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [
  template, styles, nccuPeriods, internshipPlanner, courseData, eligibilityConditions,
  nccuUrl, syllabusState, nccuCourseNotes, courseReconciler, plannerCore, planValidator, plannerStorage, plannerTransfer, plannerUndo, scheduleAgenda, apiKeySession, app,
  aiContracts, courseComparison, geminiClient, nccuCourseAdapter, nccuSyllabus, aiService, worker, aiPlanner, catalogFilters, courseComparisonPicker, sharedAiProfile,
] = await Promise.all([
  read('src/index.html'),
  read('src/styles.css'),
  read('src/nccu-periods.mjs'),
  read('src/internship-planner.mjs'),
  read('src/course-data.mjs'),
  read('src/eligibility-conditions.mjs'),
  read('src/nccu-url.mjs'),
  read('src/syllabus-state.mjs'),
  read('src/nccu-course-notes.mjs'),
  read('src/course-reconciler.mjs'),
  read('src/planner-core.mjs'),
  read('src/plan-validator.mjs'),
  read('src/planner-storage.mjs'),
  read('src/planner-transfer.mjs'),
  read('src/planner-undo.mjs'),
  read('src/schedule-agenda.mjs'),
  read('src/api-key-session.mjs'),
  read('src/app.mjs'),
  read('src/ai-contracts.mjs'),
  read('src/course-comparison.mjs'),
  read('src/gemini-client.mjs'),
  read('src/nccu-course-adapter.mjs'),
  read('src/nccu-syllabus.mjs'),
  read('src/ai-service.mjs'),
  read('src/worker.mjs'),
  read('src/ai-planner.mjs'),
  read('src/catalog-filters.mjs'),
  read('src/course-comparison-picker.mjs'),
  read('src/shared-ai-profile.mjs'),
]);

const stripModuleSyntax = (source) => source
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
  .replace(/^export\s+/gm, '');
const wrapModule = (source, namespace, exportNames) => {
  const exports = exportNames.join(', ');
  return `const ${namespace} = (() => {\n${stripModuleSyntax(source)}\nreturn { ${exports} };\n})();\nconst { ${exports} } = ${namespace};`;
};
const script = [
  wrapModule(nccuPeriods, '__nccuPeriods', [
    'toMinutes', 'NCCU_PERIODS', 'periodsForRange', 'formatNccuSchedule', 'gridPlacement',
  ]),
  wrapModule(internshipPlanner, '__internshipPlanner', [
    'DEFAULT_INTERNSHIP_SETTINGS', 'validateInternshipSettings', 'calculateInternshipPlan',
  ]),
  wrapModule(courseData, '__courseData', ['courses', 'dayLabels']),
  wrapModule(eligibilityConditions, '__eligibilityConditions', [
    'profileConditionIds', 'rulesForCourse', 'buildConditionDefinitions', 'buildConditionImpacts',
    'validateCustomCondition',
  ]),
  wrapModule(nccuUrl, '__nccuUrl', ['trustedNccuUrl']),
  wrapModule(syllabusState, '__syllabusState', ['officialSyllabusState']),
  wrapModule(nccuCourseNotes, '__nccuCourseNotes', ['classifyOfficialNotes']),
  wrapModule(courseReconciler, '__courseReconciler', ['reconcileOfficialCandidate']),
  wrapModule(plannerCore, '__plannerCore', [
    'evaluateEligibility', 'findConflicts', 'calculateInternshipAvailability', 'toggleCourse',
    'clearPlannerSelection', 'clearCandidateCatalog', 'toggleCourseLock', 'lockCandidateCourse',
    'toggleSelectableCourse', 'applyPreset', 'resolveCourseOption', 'applyCourseOption',
    'restoreOfficialCatalog', 'deleteCandidateCourse', 'buildCandidateCatalog',
    'validateManualCourse', 'createManualCourse', 'candidateScheduleSummary',
  ]),
  wrapModule(planValidator, '__planValidator', ['validatePlan']),
  wrapModule(nccuCourseAdapter, '__nccuCourseAdapter', [
    'buildNccuCourseUrl', 'normalizeNccuRows', 'searchNccuCourses',
    'meetingsFromNccuText', 'eligibilityRuleFromOfficialRestriction',
    'sanitizeOfficialEligibilityRules', 'trustedOfficialSyllabusUrl',
    'nccuCourseToCandidate', 'candidateIncludesCourseCode',
  ]),
  wrapModule(plannerStorage, '__plannerStorage', [
    'STORAGE_KEY', 'serializePlannerState', 'parsePlannerState', 'createStartupCatalog',
    'persistedCourseAdditions',
  ]),
  wrapModule(plannerTransfer, '__plannerTransfer', [
    'exportPlannerTransfer', 'previewPlannerTransfer', 'applyPlannerTransfer',
  ]),
  wrapModule(plannerUndo, '__plannerUndo', ['createPlannerUndo']),
  wrapModule(scheduleAgenda, '__scheduleAgenda', ['buildScheduleAgenda']),
  wrapModule(apiKeySession, '__apiKeySession', ['createApiKeySession', 'validateAndStoreApiKey']),
  wrapModule(catalogFilters, '__catalogFilters', [
    'CATALOG_DAYPARTS', 'filterCandidateCourses', 'countActiveCatalogFilters',
  ]),
  wrapModule(courseComparisonPicker, '__courseComparisonPicker', [
    'filterComparisonCourses', 'toggleComparisonCourse', 'reconcileComparisonCourseIds',
  ]),
  wrapModule(sharedAiProfile, '__sharedAiProfile', [
    'AI_PROFILE_KEYS', 'countCompletedAiProfileFields', 'aiProfileCompletionLabel',
  ]),
  wrapModule(aiPlanner, '__aiPlanner', [
    'validateScreenshotFile', 'mergeImportedCourses', 'applyRecommendedPlan',
  ]),
  `(() => {\n${stripModuleSyntax(app)}\n})();`,
].join('\n\n');

const html = template
  .replace('/*__STYLES__*/', styles)
  .replace('/*__SCRIPT__*/', script);

const outputDir = new URL('dist/server/', root);
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(new URL('dist/static/', root), { recursive: true });
await writeFile(new URL('dist/static/index.html', root), html);
await writeFile(new URL('dist/static/.nojekyll', root), '');
const serverScript = [
  stripModuleSyntax(nccuPeriods),
  stripModuleSyntax(courseData),
  stripModuleSyntax(eligibilityConditions),
  stripModuleSyntax(nccuUrl),
  stripModuleSyntax(syllabusState),
  stripModuleSyntax(nccuCourseNotes),
  stripModuleSyntax(aiContracts),
  stripModuleSyntax(courseComparison),
  stripModuleSyntax(geminiClient),
  stripModuleSyntax(nccuCourseAdapter),
  stripModuleSyntax(nccuSyllabus),
  stripModuleSyntax(plannerCore),
  stripModuleSyntax(planValidator),
  stripModuleSyntax(aiService),
  stripModuleSyntax(worker),
].join('\n\n');
await writeFile(new URL('index.js', outputDir), `const html = ${JSON.stringify(html)};\n${serverScript}\nexport default createWorker({ html, catalog: courses });\n`);
await mkdir(new URL('dist/.openai/', root), { recursive: true });
await writeFile(new URL('dist/.openai/hosting.json', root), await read('.openai/hosting.json'));
