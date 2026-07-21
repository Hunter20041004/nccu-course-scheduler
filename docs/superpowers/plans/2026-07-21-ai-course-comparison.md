# AI Course Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2–5 course syllabus comparison flow with Gemini personalization and a copy-to-ChatGPT fallback.

**Architecture:** A focused NCCU syllabus reader fetches and sanitizes trusted official HTML. A comparison contract validates requests and AI output, while the worker exposes one Key-protected comparison route and one Key-free prompt route. The existing catalog owns comparison selection; the AI panel renders objective and optional personalized results.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node test runner, Cloudflare-style Worker, Gemini JSON API.

## Global Constraints

- Follow vertical TDD: one failing behavior, minimal implementation, green verification, then refactor.
- Compare 2–5 candidate courses; never silently drop a selected course.
- Personal profile fields are optional and must be separated from objective findings.
- Only fetch trusted HTTPS NCCU syllabus URLs; never persist API Keys, full syllabi, or profile text on the server.
- Schedule conflicts remain deterministic and must not be delegated to AI.
- Preserve the existing light-dreamcore visual system and 44px minimum touch targets.

---

### Task 1: Official syllabus reader

**Files:** Create `src/nccu-syllabus.mjs`; create `tests/nccu-syllabus.test.mjs`; modify `tests/nccu-live-contract.test.mjs`; modify `package.json`.

**Interfaces:** Produces `extractSyllabusText(html)` and `fetchOfficialSyllabus({ url, fetchImpl })` returning `{ url, text }`.

- [ ] Write one failing unit test that strips scripts/styles/tags, decodes entities, keeps meaningful syllabus headings, and caps the result.
- [ ] Run the exact test and confirm the expected missing-export failure.
- [ ] Implement the minimum extractor and trusted NCCU fetch with response-size and timeout guards.
- [ ] Run the unit test to green, refactor names, then run it again.
- [ ] Add one live contract that fetches the official HCI syllabus and verifies the course name and description are present; run it against the real NCCU boundary.

### Task 2: Comparison request, output, and prompt contracts

**Files:** Modify `src/ai-contracts.mjs`; create `src/course-comparison.mjs`; create `tests/course-comparison.test.mjs`; modify `package.json`.

**Interfaces:** Produces `validateComparisonRequest(input)`, `parseCourseComparison(content, allowedIds)`, `profileContextState(input)`, and `buildChatGptComparisonPrompt(context)`.

- [ ] Write a failing test for 2–5 course validation, allowed official syllabus URLs, and optional profile fields.
- [ ] Implement only the validation needed for that test and run it green.
- [ ] Write a failing test that rejects unknown AI course IDs and invalid overlap scores; implement and run green.
- [ ] Write a failing test for an objective-only versus personalized ChatGPT prompt; implement and run green.
- [ ] Refactor shared normalization and rerun the focused tests.

### Task 3: Comparison service and Worker routes

**Files:** Modify `src/ai-service.mjs`, `src/worker.mjs`, `tests/ai-service.test.mjs`, `tests/worker.test.mjs`, `scripts/build.mjs`, and `package.json`.

**Interfaces:** Produces `prepareCourseComparison(input, deps)` and `compareCourseSyllabi(input, deps)`; exposes `POST /api/course-comparison/prompt` and `POST /api/ai/compare-courses`.

- [ ] Write a failing service test proving two official syllabi are fetched, optional profile state reaches the prompt, deterministic conflicts are returned, and Gemini uses `gemini-3.5-flash`.
- [ ] Implement the shared context preparation and Key-protected comparison call; run green.
- [ ] Write a failing service test proving fewer than two readable syllabi returns `INSUFFICIENT_SYLLABI` without an AI call; implement and run green.
- [ ] Write one failing Worker route test at a time: Key removal on AI comparison, no Key requirement for ChatGPT prompt, then safe retryable error shape. Implement each route after its red run.
- [ ] Add the new modules to the real browser/server build boundary and run bundle syntax tests.

### Task 4: Candidate selection and comparison tray

**Files:** Modify `src/index.html`, `src/app.mjs`, `src/styles.css`, and `tests/rendered-html.test.mjs`.

**Interfaces:** UI state `comparisonCourseIds`; renders independent compare checkboxes and `#course-comparison-tray` with clear, AI, ChatGPT, and profile-help actions.

- [ ] Write a failing rendered-bundle test for 2–5 selection controls, accessible labels, helper copy, and tray actions.
- [ ] Add the minimum markup, state, rendering, and event isolation; run the rendered test green.
- [ ] Write a failing rendered test for the five-course limit and status message; implement and run green.
- [ ] Add responsive, focus-visible, pressed, disabled, and sticky-safe CSS while preserving existing palette; rebuild and rerun focused tests.

### Task 5: Results and ChatGPT fallback

**Files:** Modify `src/index.html`, `src/app.mjs`, `src/styles.css`, `tests/rendered-html.test.mjs`, and `tests/browser/sunbreak-critical-flows.md`.

**Interfaces:** Renders `#ai-comparison-results`; `runAiComparison()`, `openChatGptComparison()`, and `renderCourseComparison(result)`.

- [ ] Write a failing rendered test for objective findings, deterministic conflicts, per-course differences, limitations, source links, and distinct optional personalization.
- [ ] Implement the comparison request, loading/error recovery, AI-tab navigation, and result rendering; run green.
- [ ] Write a failing rendered test for copy/open fallback plus manual-copy recovery; implement and run green.
- [ ] Add mobile single-column behavior, text wrapping, reduced-motion handling, and non-color status labels; run rendered tests green.

### Task 6: Tutorial, full verification, and browser acceptance

**Files:** Modify `src/index.html`, `src/app.mjs`, `tests/rendered-html.test.mjs`, and `tests/browser/sunbreak-critical-flows.md`.

**Interfaces:** Tutorial documents selection, optional personalization, official-source limitations, Key use, and ChatGPT fallback.

- [ ] Write a failing tutorial-render test, update the permanent help center and quick tour, then run green.
- [ ] Run `npm test`, `npm run lint`, and `npm run test:contract:nccu`; fix only observed failures and rerun full commands.
- [ ] Use Chrome to verify desktop and mobile widths: select/clear 2–5 courses, preserve normal catalog actions, compare with and without profile fields, trigger missing-Key recovery, and validate ChatGPT copy/open recovery.
- [ ] Record browser evidence in `tests/browser/sunbreak-critical-flows.md` and perform a final clean-status/diff review without touching `.impeccable/`.
