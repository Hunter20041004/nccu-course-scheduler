# Rain After Sunlight Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the deployed scheduler UI and restyle it as an accessible “雨後日光” light-dreamcore course planner.

**Architecture:** Keep the dependency-free static Worker architecture. Change the build composer so each source module executes inside its own closure and only named exports are lifted into the shared bundle scope; keep application state and business logic unchanged. Apply the visual redesign through semantic CSS tokens and existing HTML structure.

**Tech Stack:** Static HTML, CSS, ES modules, Node.js build scripts, Node test runner, Sites private hosting, Chrome browser verification.

## Global Constraints

- Preserve all 24 course groups and exactly three required courses.
- Preserve the official NCCU Monday–Saturday 16-period grid and local-only persistence.
- Use `#F5F3EF`, `#D8D5D2`, `#FFAA55`, `#6879C9`, `#9180B5`, `#D94A48`, and `#454348` as semantic palette anchors.
- Do not use a blue-purple gradient background.
- Follow vertical TDD: one failing test, minimal implementation, green verification, refactor, then the next test.
- Final verification must use the deployed private URL in Chrome at desktop and 375px widths.

---

### Task 1: Isolate bundled module scopes

**Files:**
- Modify: `tests/bundle-syntax.test.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: source modules listed in `scripts/build.mjs`.
- Produces: `wrapModule(source, namespace, exportNames)` and a final inline ES module without duplicate top-level declarations.

- [ ] **Step 1: Write the failing ES-module parse test**

Add a test that builds the site, extracts the inline script, writes it as a temporary `.mjs`, runs `node --check`, and expects exit status `0`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern='ES module syntax' tests/bundle-syntax.test.mjs`

Expected: FAIL with `Identifier 'overlaps' has already been declared`.

- [ ] **Step 3: Implement minimal module scoping**

In `scripts/build.mjs`, wrap each library source in an IIFE, return its declared public exports, and destructure those exports after the closure. Append `app.mjs` after all library closures.

- [ ] **Step 4: Run the focused test and complete refactor**

Run: `node --test --test-name-pattern='ES module syntax' tests/bundle-syntax.test.mjs`

Expected: PASS. Then run `npm test` and keep all existing tests green.

- [ ] **Step 5: Commit**

Commit message: `Fix module scope collisions in browser bundle`.

### Task 2: Apply the rain-after-sunlight dreamcore system

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing semantic classes and data attributes in the schedule and catalog.
- Produces: `.dream-orb`, `.dream-grain`, rain-after-sunlight CSS tokens, course state styling, and reduced-motion behavior.

- [ ] **Step 1: Write the failing finished-page design contract**

Assert the built HTML contains all seven palette anchors, dream atmosphere layers, `prefers-reduced-motion`, the NCCU grid, and the catalog panel.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run build && node --test --test-name-pattern='rain-after-sunlight' tests/rendered-html.test.mjs`

Expected: FAIL because the dream atmosphere layers and palette are absent.

- [ ] **Step 3: Implement the minimal visual system**

Add decorative `aria-hidden="true"` atmosphere elements to `index.html`. Replace the existing green/beige CSS tokens and component colors with the approved palette; style panels as legible translucent mist surfaces, selected catalog rows in charcoal/orange, optional courses in fog purple, internship reservations in rain blue, and conflicts in red.

- [ ] **Step 4: Run the focused test and refactor responsive styles**

Run: `npm run build && node --test --test-name-pattern='rain-after-sunlight' tests/rendered-html.test.mjs`

Expected: PASS. Consolidate repeated shadows/radii into tokens, add 375px behavior and reduced-motion overrides, then rerun `npm test`.

- [ ] **Step 5: Commit**

Commit message: `Restyle scheduler with rain-after-sunlight dreamcore`.

### Task 3: Deploy and verify every core workflow in Chrome

**Files:**
- Modify only if a Chrome test exposes a regression, using a new failing automated test before each fix.

**Interfaces:**
- Consumes: private Sites deployment URL.
- Produces: a successful version deployment and evidence for every user-facing flow.

- [ ] **Step 1: Run the full local verification gate**

Run: `npm test && npm run lint && git diff --check`

Expected: all tests pass, lint exits `0`, and diff check is empty.

- [ ] **Step 2: Publish the exact verified commit privately**

Build, package, save, and deploy the same Git commit to the existing Sites project. Poll until deployment status is `succeeded`.

- [ ] **Step 3: Execute the desktop Chrome workflow checklist**

Verify: initial 24-course catalog and official grid; search; each filter; add/remove optional course; required-course lock; physical/async toggle; all three presets; eligibility settings; AI project section/advisor; internship target/time/mode/fixed-day/conflict display; manual course validation/addition; screenshot file preview and handoff validation; reset; reload persistence; no console errors.

- [ ] **Step 4: Execute the 375px Chrome workflow checklist**

Verify single-column order, horizontal schedule scrolling, visible controls, 44px targets, no page-level horizontal overflow, readable course blocks, and reduced-motion-safe styling.

- [ ] **Step 5: Deliver**

Keep the verified scheduler tab open as the deliverable and report the private URL plus exact automated and Chrome verification results.

