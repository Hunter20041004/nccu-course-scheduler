# Schedule Wallpaper Export Design

## Goal

Add a one-click export that turns the current completed timetable into a polished phone-wallpaper PNG.

## User experience

- Add a visible `匯出手機桌布` button in the schedule panel controls.
- Clicking the button downloads a PNG named `nccu-schedule-wallpaper-115-1.png`.
- The PNG is `1080×1920`, optimized for phone wallpaper use rather than a raw webpage screenshot.
- The exported image includes:
  - title and term;
  - selected credits;
  - internship availability;
  - weekly NCCU timetable from Monday to Sunday;
  - selected physical/synchronous courses;
  - internship reservations;
  - asynchronous or time-undetermined courses;
  - reminders such as conflicts, eligibility warnings, and special events.

## Visual direction

Use the existing Sunbreak / 雨後日光 palette: warm white canvas, ink text, muted gray, sun gold, blue, and violet. The image should feel like a calm desk card or lock-screen planner: readable, high-contrast, not decorative-heavy.

## Technical approach

- Use browser Canvas only. No server calls, no extra dependencies, no external image service.
- Keep the current app state as the source of truth: `selected`, `internshipSettings`, `profile`, existing timetable helpers, and existing conflict/eligibility functions.
- Generate the wallpaper entirely client-side, create a PNG data URL, and trigger a browser download.

## Non-goals

- No PDF export.
- No multi-template picker.
- No cloud storage.
- No upload or sharing flow.
