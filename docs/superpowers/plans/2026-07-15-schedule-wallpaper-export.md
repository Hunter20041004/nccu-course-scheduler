# Schedule Wallpaper Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one-click export of the current schedule as a phone-wallpaper PNG.

**Architecture:** Add a schedule-panel button and a Canvas-based exporter inside the existing browser app. The exporter reads current planner state and renders a 1080×1920 image without mutating planner data.

**Tech Stack:** Plain HTML, CSS, browser Canvas, Node test runner, existing build script.

## Global Constraints

- TDD is mandatory: write one failing test first, then implement the minimum code, then verify.
- No new dependencies.
- Export must be client-side only.
- PNG size must be exactly 1080×1920.
- Download filename must include `nccu-schedule-wallpaper`.

---

### Task 1: Add export button and Canvas exporter

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `selected`, `internshipSettings`, `profile`, `calculateInternshipPlan`, `findConflicts`, `evaluateEligibility`, `meetingsForCourse`, `gridPlacement`, `NCCU_PERIODS`, `dayLabels`.
- Produces: `exportScheduleWallpaper()`, `renderScheduleWallpaper(canvas)`, and `downloadCanvasPng(canvas, filename)`.

- [ ] **Step 1: Write the failing rendered HTML test**

Add assertions that the app renders `id="export-wallpaper"`, wires it to `exportScheduleWallpaper`, creates a `1080×1920` canvas, exports `image/png`, and downloads a filename containing `nccu-schedule-wallpaper`.

- [ ] **Step 2: Run the rendered HTML test and confirm RED**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: FAIL because `export-wallpaper` and exporter functions do not exist yet.

- [ ] **Step 3: Implement the button and exporter**

Add the button near the schedule heading. Add Canvas drawing helpers and the click handler. Render a polished wallpaper with title, stats, timetable, selected courses, internship reservations, async items, and reminders.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `npm run verify`

Expected: all tests pass, lint passes, NCCU contract passes.

- [ ] **Step 6: Browser smoke test**

Run local app, click `匯出手機桌布`, and verify the generated canvas path reaches `toDataURL('image/png')` with `1080×1920` dimensions.

- [ ] **Step 7: Commit and deploy**

Commit implementation, save a Sites version, and deploy to the existing public site.
