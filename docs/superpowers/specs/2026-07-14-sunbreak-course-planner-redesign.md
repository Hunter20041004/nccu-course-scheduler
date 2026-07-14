# Sunbreak Course Planner Redesign — Design Specification

**Date:** 2026-07-14  
**Status:** Approved for implementation  
**Branch:** `feature/sunbreak-redesign`  
**Working title:** Sunbreak／雨隙工作台

## 1. Purpose

Redesign the private NCCU course-planning website into a distinctive, compact scheduling tool that puts the official NCCU timetable first. The redesign must make course eligibility understandable and customizable, remove the redundant quick presets, and preserve all existing scheduling, internship, AI recommendation, screenshot import, locking, deletion, and custom-activity workflows.

The product is used by an NCCU student repeatedly during course planning. It must feel authored and memorable without slowing down high-frequency work.

## 2. Approved Direction

The approved direction is **A — 雨後日光工作台**, strengthened into the **Sunbreak／雨隙工作台** concept.

Reference principles are synthesized rather than copied:

- Prescience: warm editorial confidence, a recognizable purple identity, and floating explanatory annotations.
- RealPact: restrained flat surfaces, serif/sans contrast, and product imagery framed as the main artifact.
- Tsenta: high information density, immediate access to the real tool, and compact operational rows.
- Agentcard: decisive controls, strong selected states, and disciplined contrast.
- 6sense could not be inspected beyond its security-verification screen, so no visual detail from it is treated as a source.

SkillUI extraction establishes a shared 4px base grid across the usable references. Playwright CLI screenshots confirm that the references use one memorable compositional gesture while keeping controls conventional.

## 3. Product Principles

1. **The timetable is the product.** The first viewport opens directly to the schedule and course bank, not a marketing hero.
2. **Density with legibility.** At least ten candidate courses should be visible at once on a typical 1440×900 desktop viewport.
3. **Explain cause and effect.** Every qualification must say why it is being asked, which courses use it, and what happens when the student does not have it.
4. **Creativity must be functional.** Visual signatures explain placement, impact, or state; they are not decorative background effects.
5. **Good defaults, reversible actions.** The UI keeps familiar buttons and forms, confirms destructive actions, and preserves user data.
6. **No hidden eligibility assumptions.** A course is never marked blocked merely because a free-form note looks restrictive; only structured rules control the result.

## 4. Information Architecture

### 4.1 Desktop shell

The page is a viewport-oriented workbench:

- A compact application header contains the product name, semester, inline plan summary, and global actions.
- The main workbench uses a roughly 65/35 split.
- The left side is the official NCCU Monday–Sunday timetable, asynchronous lane, and actionable warnings.
- The right side is a workspace with five labeled tabs:
  - `候選課程`
  - `AI 推薦`
  - `選課條件`
  - `實習設定`
  - `匯入／新增`
- `候選課程` is the default tab and keeps click-to-add behavior.
- The former `快速方案` navigation and its three static presets are removed from the interface. AI recommendation is the only plan-generation workflow.

The timetable and workspace each have one scroll context at most. The page must not create nested scrolling that traps the pointer.

### 4.2 Tablet and mobile

- At widths below 1024px, the two workbench columns become labeled top-level tabs: `課表` and `工具`.
- The timetable remains the default and highest-priority view.
- On phones, the workspace opens as an in-document panel rather than relying on hover or drag-only gestures.
- Candidate rows and all controls retain at least a 44px interaction target.
- The NCCU grid may scroll horizontally inside its own bounded region, but the document body must not overflow horizontally.

## 5. Header and Summary

Remove the oversized hero copy, decorative weather illustration, floating orbs, grain layer, three summary cards, and repeated eyebrow labels.

Replace them with:

- `Sunbreak` wordmark plus `政大排課` product label.
- Semester indicator `115-1`.
- Inline metrics for selected credits, internship-equivalent days, and current warnings using tabular figures.
- Global actions `清空課表` and `恢復建議方案`, with the destructive action visually separated.
- A thin **sunline** below the header: a functional progress strip whose filled portion communicates internship target progress and whose label gives the exact value. Color is never the sole indicator.

## 6. Visual System

### 6.1 Physical scene

A student uses the planner beside a library window after rain, in soft daylight, trying to compare many courses quickly. The surface should be light, calm, and clear; the warmth comes from a small sunlight accent rather than a beige wash.

### 6.2 Color roles

Use semantic CSS tokens, preferably expressed in OKLCH with solid-color fallbacks:

- Canvas: neutral off-white with a very slight violet bias, not cream or mint.
- Surface: near-white.
- Primary ink: near-black with a restrained warm undertone.
- Muted ink: high-contrast rain gray.
- Primary action: royal blue.
- Selected/locked: iris violet.
- Positive/target reached: sunlight amber with text/icon reinforcement.
- Conditional/review: amber-brown.
- Destructive/unavailable: brick red.
- Rules and grid: cool gray-violet.

Mint green and sky blue are prohibited. Blue must read as royal/cobalt; violet must read as iris/plum.

### 6.3 Typography

- Display and product identity: a Traditional-Chinese-capable serif stack (`Noto Serif TC`, `Songti TC`, serif fallbacks).
- Interface, forms, and timetable: a Traditional-Chinese-capable sans stack (`Noto Sans TC`, `PingFang TC`, sans-serif fallbacks).
- Numbers in summaries and period labels use tabular numerals.
- Use a restrained type scale. No oversized landing-page headline remains.
- Body text is at least 14px on desktop and 16px in mobile form controls.

### 6.4 Shape and elevation

- Component radii use 4px, 8px, or 12px; panels never exceed 16px.
- Use borders and surface shifts for hierarchy. Avoid glassmorphism, backdrop blur, and wide ghost-card shadows.
- Full pills are reserved for compact statuses and tabs.
- Course rows are separated by rules, not individual floating cards.

### 6.5 Icons

- Use a consistent monochrome SVG stroke style or text labels.
- Do not use emoji as interface icons.
- Icon-only controls require an accessible name and 44px hit target.

## 7. Signature Interactions

### 7.1 Course placement trace

When a candidate course is added:

- The destination course block receives a brief 180–220ms sunlight highlight.
- The catalog row and destination share a temporary visual state so the placement is obvious.
- There is no long travel animation across the screen; repeated scheduling must remain fast.
- Reduced-motion mode uses an immediate border/color change only.

### 7.2 Course index rows

Candidate courses are compact index rows, not large cards.

Each row shows:

- Course title and teacher/course code where available.
- Credits, attendance mode, and eligibility status.
- Persistent actions: `詳細`, `鎖定`/`解除鎖定`, and `刪除`.
- Clicking the non-control portion toggles the course in the timetable.
- Selected and locked states use both text/icon and color.
- Details expand inline from the row and include official sections, schedule choices, course conditions, and eligibility rationale.

The row height and panel sizing must permit at least ten collapsed rows in a 1440×900 viewport.

### 7.3 AI route boards

The three AI recommendations are presented as strategy routes rather than generic equal cards:

- Each route has a title, one-sentence strategy, credits, internship outcome, trade-offs, and a compact timetable preview.
- `預覽` temporarily compares the route to the current plan without mutating saved state.
- `套用方案` remains the explicit mutation.
- Locked courses are visibly carried into every route.
- Loading, invalid response, timeout, and retry states remain actionable and accessible.

### 7.4 Qualification impact notes

Conditions use an annotated-list pattern inspired by explanatory callouts, not a card grid. Expanding a condition originates from its row and reveals a causal list of affected courses.

## 8. Customizable Eligibility Model

### 8.1 Student profile

The profile retains structured system attributes:

- Degree level.
- Year.

All program, department, identity, prior-course, competency, and other eligibility facts use a general collection of condition IDs rather than fixed `innovation` and `statistics` checkboxes.

### 8.2 Condition definition

A condition definition contains:

```js
{
  id: 'program:innovation',
  label: '創新創業學程資格',
  category: 'program',
  description: '部分課程在第一階段或全學期限定此學程學生。',
  source: 'course' // 'course' | 'custom'
}
```

Allowed categories are:

- `program` — 學程、微學程、輔系、雙主修。
- `department` — 系所或班級身分。
- `prerequisite` — 已修課程或學分門檻。
- `competency` — 語言、程式或其他能力條件。
- `identity` — 學制、年級之外的學生身分。
- `other` — 無法歸入以上類型的條件。

Users can add and delete custom condition definitions. Course-derived conditions remain visible while at least one candidate course references them, because hiding them would make eligibility unexplained. Users express that they do not have a condition by leaving it unchecked.

### 8.3 Course eligibility rules

A course may provide structured rules:

```js
{
  conditionId: 'prerequisite:statistics-3',
  enforcement: 'required', // 'required' | 'review'
  rationale: '課綱要求先修統計學至少 3 學分。'
}
```

- `required`: missing the condition blocks direct selection.
- `review`: missing or uncertain status keeps the course selectable but marks it `資格需確認`.
- Existing `programs`, `prerequisites`, `minYear`, `level`, `openToUndergradYear`, and `undergradReview` data are normalized into the same explanation layer for backward compatibility.
- Free-form `conditions` notes remain informational and do not silently become blocking rules.

### 8.4 Condition panel behavior

Each surfaced condition row shows:

- Checkbox/state: `我符合` or unchecked `我不具備／不確定`.
- Category and label.
- Plain-language reason for asking.
- Impact summary such as `影響 3 門候選課`.
- Expanded affected-course list. Each course names the consequence:
  - `符合後可直接選`
  - `沒有也能選，但需教師／系所確認`
  - `沒有時無法直接加入`
- A condition referenced by no current course says `目前不影響候選課，可安全移除`.

The panel provides `新增條件`, with visible labels for name, category, and explanatory note. Empty names and duplicate normalized names are rejected inline.

### 8.5 Eligibility labels

The catalog uses four exact top-level states:

- `條件符合`
- `資格需確認`
- `條件不符合`
- `本學期未開課`

Every non-eligible state has at least one visible textual reason. Color alone never communicates eligibility.

### 8.6 Persistence and migration

- Planner storage moves from schema version 3 to version 4.
- Version 3 profiles are migrated: `programs` and `prerequisites` become selected condition IDs.
- Existing selected courses, locks, custom activities, deleted candidates, AI-imported courses, course options, and internship settings are preserved.
- Corrupt or unknown future versions still return the safe fallback.

## 9. Existing Feature Preservation

The redesign must preserve:

- Monday–Sunday official NCCU period grid and period codes.
- Multi-meeting and multi-instructor course options.
- Asynchronous course lane and synchronous exams/events.
- Click-to-add candidate behavior.
- Course details, locking for any course, deletion for any candidate, and clear schedule.
- Automatic and fixed internship modes, half-days, and custom time range.
- Courses, clubs, organizations, and personal activity creation.
- Private screenshot import and review before merge.
- Groq-powered recommendations using the server-side secret and fixed model.
- No import of courses that are not open in the active semester.

## 10. Motion

- Button press feedback: 100–160ms, subtle scale no smaller than 0.97.
- Popovers/details: 150–220ms with strong ease-out and origin at the triggering row.
- Course placement highlight: 180–220ms.
- No animation on keyboard-triggered high-frequency navigation.
- Only transform, opacity, color, and border-color animate in normal interaction.
- All motion has a `prefers-reduced-motion` alternative.

## 11. Accessibility

- Text contrast meets WCAG AA: 4.5:1 for normal text and 3:1 for large text.
- Every interactive element is keyboard reachable in logical visual order.
- Focus rings are 2–4px and visible on every surface.
- Expanded state uses `aria-expanded` and an associated region.
- Tabs use appropriate tab semantics or equivalent labeled buttons with clear selected state.
- Status updates use non-focus-stealing `aria-live="polite"` regions.
- Forms have persistent labels, helper text, inline errors, and first-error focus when submitted.
- Destructive actions require confirmation and clearly name the affected item.

## 12. Responsive Acceptance Targets

Verify at:

- 1440×900 desktop.
- 1024×768 tablet landscape.
- 768×1024 tablet portrait.
- 375×812 phone.

There must be no clipped controls, body-level horizontal overflow, unreadable timetable labels, or content hidden under sticky UI.

## 13. Technical Boundaries

- Keep the existing dependency-light HTML/CSS/ES-module architecture.
- Do not add a frontend framework solely for the redesign.
- Keep Groq credentials server-side. Never commit or render secrets.
- Avoid external image dependencies; the product's own schedule and data are the visual centerpiece.
- Use CSS custom properties for the complete visual token system.
- Separate new eligibility normalization/impact logic from DOM rendering so it can be tested without a browser.

## 14. TDD and Boundary Verification

Implementation follows strict vertical Red → Green → Refactor slices:

1. Write one failing behavioral test.
2. Run it and confirm it fails for the missing behavior.
3. Implement the smallest production change.
4. Run the focused test and then the relevant suite.
5. Refactor only while green.
6. Commit a coherent, tested slice before moving to the next behavior.

Mock-only tests are insufficient at boundaries. Final verification must include:

- Full unit and rendered-bundle suite.
- A real local server and real built HTML.
- Playwright CLI interactions for all modified critical flows.
- Browser console and failed-request inspection.
- Desktop, tablet, mobile, keyboard, and reduced-motion checks.
- Existing live contract tests remain opt-in where external credentials or NCCU availability are required.

## 15. Acceptance Criteria

The feature is accepted when:

1. `main` remains unchanged and the work exists only on `feature/sunbreak-redesign`.
2. The first viewport is the operational schedule/workspace, with no oversized hero.
3. The quick preset UI is absent while AI recommendations remain available.
4. At least ten candidate rows are visible at 1440×900.
5. A user can add, select/unselect, and delete custom conditions.
6. Course-derived conditions explain why they appear and list affected courses and consequences.
7. Eligibility still correctly distinguishes eligible, conditional, blocked, and unavailable courses.
8. Version 3 saved data migrates without losing selections, locks, activities, deletions, options, imports, or internship settings.
9. Existing scheduling and AI/import flows continue to work.
10. The interface meets the visual, responsive, motion, keyboard, and contrast requirements in this document.
11. The final handoff reports exactly what changed and how the design was adjusted.
