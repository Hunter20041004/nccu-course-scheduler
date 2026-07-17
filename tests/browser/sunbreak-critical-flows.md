# Sunbreak Critical Flow Verification

Verified on 2026-07-17 against `http://127.0.0.1:4173/` from branch `feature/sunbreak-redesign`.

## Browser surfaces

- The user's Chrome through the bundled Chrome extension.
- Explicit 320, 375, 390, 640, 768, 1024, and 1440px responsive widths, including a 390×844 mobile viewport.
- A fresh origin for first-run behavior and a separate persisted origin for return-user behavior.

## Passed flows

- A first-time visitor starts with 0 candidates and 0 scheduled courses; the user's existing public-site planner data was not cleared or overwritten.
- All eight quick-tour steps spotlight a real visible target, including an empty candidate list on step 3.
- Live NCCU search for `人機互動` returned eight official 115-1 sections, showed the last successful query time, and exposed the official syllabus link.
- Importing `703055001 人機互動` created one candidate with `週四 234`, complete details, eligibility explanation, source, official sections, and syllabus action.
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
- Chrome console: 0 errors and 0 warnings throughout the final pass.

## Deterministic and boundary evidence

- `npm test`: 167 unit tests and 76 rendered-page tests passed.
- `npm run lint`: passed.
- `npm run test:contract:nccu`: three live NCCU 115-1 contract tests passed.
- AI service tests cover missing/invalid keys, timeouts, retryable upstream errors, request IDs, hallucinated course IDs, conflicts, locked courses, asynchronous attendance, minimum credits, language-course requirements, and internship minimums.
- A real user API key was intentionally not submitted during browser QA; the UI and server contracts were exercised without exposing user secrets.
- `git diff --check`: passed.

## Browser-discovered repair

The compact viewport exposed two header-summary overflows. The internship value had grown from a short day count into one unbreakable confirmed-plus-pending sentence, and 1024px still used the desktop inline label/value layout. Two failing rendered-page regression tests were added first. The value now wraps as two semantic phrases, and metric labels stack before the compact desktop width can overflow. Chrome geometry checks confirm no metric or body-level horizontal overflow at all seven tested widths.
