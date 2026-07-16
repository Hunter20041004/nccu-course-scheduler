# Schedule Wallpaper Export Design

## Goal

Add a one-click export that turns the current completed timetable into a polished phone-wallpaper PNG.

## User experience

- Add a visible `匯出手機桌布` button in the schedule panel controls.
- Clicking the button downloads a PNG named `nccu-schedule-wallpaper-115-1.png`.
- The PNG is `1170×2532`, a modern phone-wallpaper ratio with generous safe-area margins so the image is less likely to be cropped by lock-screen or home-screen placement.
- The exported image includes:
  - minimal title and term;
  - weekly NCCU timetable from Monday to Sunday;
  - selected physical/synchronous courses;
  - internship reservations;
  - asynchronous or time-undetermined courses;
  - reminders such as conflicts, eligibility warnings, and special events.
- The exported image must not include the three top metric cards (`已選學分`, `可實習`, `提醒`) or the bottom export timestamp.

## Visual direction

Use the existing Sunbreak / 雨後日光 palette with a light dreamcore treatment: warm white canvas, mist lavender, soft sun halo, ink text, muted gray, blue, and violet. The image should feel like a calm lock-screen planner floating in a gentle weather-card scene.

The dreamcore treatment must remain functional:

- keep all course titles, periods, and course codes readable;
- use soft gradients, glass panels, mist dividers, and subtle glow instead of heavy decoration;
- avoid mint green and bright sky blue;
- keep the timetable, asynchronous/time-undetermined card, and reminder card as the visual priority.

## Technical approach

- Use browser Canvas only. No server calls, no extra dependencies, no external image service.
- Keep the current app state as the source of truth: `selected`, `internshipSettings`, `profile`, existing timetable helpers, and existing conflict/eligibility functions.
- Generate the wallpaper entirely client-side, create a PNG data URL, and trigger a browser download.

## Non-goals

- No PDF export.
- No multi-template picker.
- No cloud storage.
- No upload or sharing flow.
