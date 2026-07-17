# Sunbreak Critical Flow Verification

Verified on 2026-07-16 against `http://localhost:4173/` and a fresh origin at `http://127.0.0.1:4175/` from branch `feature/sunbreak-redesign`.

## Browser surfaces

- The user's Chrome through the bundled Chrome extension.
- Default desktop viewport and an explicit 390×844 mobile viewport.
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
- Chrome console: 0 errors and 0 warnings throughout the final pass.

## Deterministic and boundary evidence

- `npm test`: 166 unit tests and 75 rendered-page tests passed.
- `npm run lint`: passed.
- `npm run test:contract:nccu`: three live NCCU 115-1 contract tests passed.
- AI service tests cover missing/invalid keys, timeouts, retryable upstream errors, request IDs, hallucinated course IDs, conflicts, locked courses, asynchronous attendance, minimum credits, language-course requirements, and internship minimums.
- A real user API key was intentionally not submitted during browser QA; the UI and server contracts were exercised without exposing user secrets.
- `git diff --check`: passed.

## Browser-discovered repair

The compact viewport exposed a header More menu that stayed open after clearing the timetable and obscured the tool panel. The root cause was inconsistent menu lifecycle handling: file import closed the native `<details>` menu, but destructive and export actions did not. A failing rendered-page regression test was added first, then every menu action was made to close the shared header menu. The same Chrome scenario now shows no overlay.
