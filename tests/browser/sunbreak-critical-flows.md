# Sunbreak Critical Flow Verification

Verified on 2026-07-14 against `http://127.0.0.1:4173/` from branch `feature/sunbreak-redesign`.

## Browser surfaces

- Playwright CLI using Chrome.
- The user's Chrome through the bundled Chrome extension.
- Viewports: 1440×900, 1024×768, 768×1024, and 375×812.

## Passed flows

- Desktop shows the official NCCU grid and at least 10 fully visible candidate rows.
- Candidate click adds a course and reveals its destination in the timetable.
- `人工智慧實務專題` supports section selection followed by advisor/time selection.
- Course details, lock/unlock, deletion dismissal, deletion confirmation, clear schedule, and restore plan work.
- All five workspace tabs expose the correct panel.
- Custom conditions add, toggle, delete, and persist; course-derived eligibility conditions toggle.
- Automatic and fixed internship modes update the grid; custom target and time range work.
- A Sunday personal activity can be created and survives reload.
- Missing screenshot validation, local preview, mocked private recognition, review result, and catalog merge work.
- Mocked AI recommendation returns exactly three strategy routes; preview is non-mutating and apply changes the schedule.
- Compact screens switch between schedule and tools without body-level horizontal overflow.
- Keyboard focus is visible and reduced-motion styles are applied.
- Chrome search for `智慧人機互動` narrows to one result; clicking it adds one official grid block.
- Chrome console: 0 errors, 0 warnings. Local static and mocked API requests succeeded.

## Contract evidence

- `npm test`: 75 unit/integration tests and 35 rendered-page tests passed.
- `npm run lint`: passed.
- `npm run test:contract:nccu`: live NCCU endpoint contract passed.
- `npm run test:contract:groq`: two live tests skipped because `GROQ_API_KEY` was intentionally not injected into the local shell; UI and server contracts were exercised with deterministic mocked responses.
- `git diff --check`: passed.

## Browser-discovered repair

The first browser run exposed a missing `/favicon.ico` request. A failing rendered-page test was added first, then the app received an inline SVG favicon. A clean browser session now reports no console errors.
