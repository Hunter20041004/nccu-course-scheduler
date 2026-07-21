# Sunbreak Critical Flow Verification

Verified on 2026-07-21 against `http://127.0.0.1:4173/` from branch `feature/sunbreak-redesign`.

## Browser surfaces

- The user's Chrome through the bundled Chrome extension.
- Explicit 320, 375, 390, 640, 768, 1024, and 1440px responsive widths, including a 390×844 mobile viewport.
- A fresh origin for first-run behavior and a separate persisted origin for return-user behavior.

## Passed flows

- A first-time visitor starts with 0 candidates and 0 scheduled courses; the user's existing public-site planner data was not cleared or overwritten.
- All eight quick-tour steps spotlight a real visible target, including an empty candidate list on step 3.
- Live NCCU search for `人機互動` returned eight official 115-1 sections, showed the last successful query time, and exposed the official syllabus link.
- Importing `703055001 人機互動` created one candidate with `週四 234`, complete details, eligibility explanation, source, official sections, and syllabus action.
- Refreshing the existing built-in `703055001 人機互動` candidate replaced stale seed fields with current official data while preserving the selected course identity and lock state.
- After a full page reload, the refreshed candidate still reports `政大 115-1 課程庫`, retains the trusted `newdoc.nccu.edu.tw` syllabus link, and remains selected and locked.
- Candidate click added the course to the timetable; lock state, detail disclosure, and the compact More menu stayed synchronized.
- Clear schedule removed the selected course and lock; the 15-second undo restored both immediately.
- The desktop grid includes Monday through Sunday and all official NCCU periods without body-level horizontal overflow.
- A fresh 390×844 viewport defaults to the agenda, switches between schedule and tools, and has no body-level horizontal overflow.
- An existing course's full detail panel fits the 390px tool panel without clipping or horizontal overflow.
- Header More actions close their popover after use, so the menu no longer leaves a blank overlay on mobile.
- API setup explains BYOK, links to Google AI Studio, and states that the key is cleared on refresh or tab close.
- Phone-wallpaper export reports successful completion with a selected course.
- The header summary keeps confirmed and pending internship time readable without crossing into the warning cell at every tested width.
- The complete tutorial center opens with all nine chapters and closes normally.
- Candidate rows keep add-to-schedule, details, syllabus, lock, and delete actions separate from AI comparison; comparison selection now lives only inside `AI 功能 → AI 課綱比較`.
- The optional-profile link switches to the AI panel and focuses the first relevant field. Future direction, semester goals, and scheduling preferences are included in the generated comparison prompt when supplied; empty fields produce an explicitly objective-only prompt.
- A legacy built-in candidate without a saved syllabus link is repaired from its official nine-digit NCCU course code. The repaired official syllabus link survives a full reload and changes the candidate action from retry to `查看課綱`.
- The ChatGPT handoff reads two real official syllabi, renders a manual-copy recovery panel, opens `https://chatgpt.com/`, and never submits the prompt. A stalled clipboard permission falls back after 1.5 seconds instead of leaving a blank page indefinitely.
- The Gemini comparison action correctly opens the BYOK dialog when the current tab has no API key; no secret was entered during QA.
- Chrome console: 0 errors and 0 warnings throughout the final pass.

## Deterministic and boundary evidence

- `npm test`: 195 unit tests and 91 rendered-page tests passed.
- `npm run lint`: passed.
- `npm run test:contract:nccu`: six live NCCU 115-1 contract tests passed, including an end-to-end comparison prompt route that reads two official syllabi.
- AI service tests cover missing/invalid keys, timeouts, retryable upstream errors, request IDs, hallucinated course IDs, conflicts, locked courses, asynchronous attendance, minimum credits, language-course requirements, and internship minimums.
- A real user API key was intentionally not submitted during browser QA; the UI and server contracts were exercised without exposing user secrets.
- `git diff --check`: passed.

## Browser-discovered repair

The compact viewport exposed two header-summary overflows. The internship value had grown from a short day count into one unbreakable confirmed-plus-pending sentence, and 1024px still used the desktop inline label/value layout. Two failing rendered-page regression tests were added first. The value now wraps as two semantic phrases, and metric labels stack before the compact desktop width can overflow. Chrome geometry checks confirm no metric or body-level horizontal overflow at all seven tested widths.

The official-data refresh pass exposed a separate build-boundary defect: the new persistence helper existed in source but was missing from the browser bundle's planner-storage export list. The app therefore swallowed a runtime persistence error, so the refreshed syllabus appeared immediately but reverted to the seed candidate after reload. A storage round-trip regression and a rendered-bundle export contract were added first. The helper is now exported into the real browser bundle, and the Chrome reload flow confirms the official source, syllabus link, selection, and lock all survive.

The syllabus-comparison pass exposed three additional real-browser defects. Older built-in candidates could lack a stored syllabus URL even when NCCU had one, clipboard permission could stall the whole ChatGPT handoff, and a repaired seed URL originally disappeared on reload. Regression tests were added before each repair. Comparison now resolves a missing link by official course code with one transient retry, bounds the clipboard wait to 1.5 seconds, and persists repaired official sources through the existing verified-candidate storage path.

## 2026-07-21 — In-page AI comparison picker

Verified in the user's Chrome against `http://127.0.0.1:4173/` on local `main`.

### Desktop behavior

- Candidate rows contained zero legacy `[data-compare-course]` controls; all 23 comparison controls appeared only inside the AI comparison tool.
- Opening `AI 功能 → AI 課綱比較` showed the full searchable candidate list with course title, teacher, section code, credits, and NCCU schedule summary.
- Searching by teacher `高宏宇` narrowed 23 candidates to exactly `自然語言處理` without clearing its selection. Unit coverage additionally verifies title and section-code matching.
- At zero or one selected course, Gemini and ChatGPT actions were disabled. At two selected courses, both became enabled.
- Selecting five courses displayed `已選 5／5`, kept the five selected controls enabled, and disabled the remaining 18 controls. Removing one restored all unselected controls.
- `清除` returned the count to zero, unchecked every comparison course, disabled both comparison actions, and displayed a recovery instruction.
- Returning to the AI feature hub and reopening comparison preserved the two selected course IDs in memory.

### Compact behavior

- Tested with a 375×812 Chrome viewport override (360px document content width after browser chrome and scrollbar allocation).
- Switching from `課表` to `工具` displayed the comparison picker in flow with no document-level horizontal overflow.
- Picker and course-list bounds stayed inside the viewport; comparison actions collapsed to one full-width column.
- Long course names wrapped, two selected courses remained visible and enabled, and no layout overlap was observed.

### Console and automated evidence

- Chrome console: zero errors.
- `npm test`: 198 unit tests and 97 rendered-page tests passed.
- `npm run lint`: passed.
- `npm run test:contract:nccu`: six live NCCU 115-1 boundary tests passed.
- `git diff --check`: passed.

## 2026-07-21 — Shared AI profile

Verified in the user's Chrome against `http://127.0.0.1:4173/` on local `main`.

### Shared behavior

- `AI 排課推薦` opens the optional profile by default; entering self-introduction and future direction immediately changed the completion badge to `已填 2／4 項`.
- `AI 課綱比較` mounts the same profile section collapsed by default and retained both values. Adding a semester goal there changed the shared badge to `已填 3／4 項`.
- Returning to `AI 排課推薦` reopened the profile and retained all three values, confirming two-way sharing without duplicate form state.
- Selecting two comparison courses still enabled both `帶到 ChatGPT` and `AI 比較`, so the shared form did not regress the comparison picker.
- Reloading cleared all four profile fields as promised while the existing 23-course candidate bank remained visible.

### Compact behavior

- Tested with a 375×812 Chrome viewport override (360px content width before reload).
- The collapsed profile stayed within the viewport from x=21 to x=339; the document and viewport widths both remained 360px.
- After expansion, all four text areas stayed within x=34 to x=326 and the document had no horizontal overflow.

### Console and automated evidence

- Chrome console: zero errors.
- `npm test`: 200 unit tests and 101 rendered-page tests passed.
- `npm run lint`: passed.
- `npm run test:contract:nccu`: six live NCCU 115-1 boundary tests passed.
- `git diff --check`: passed.
