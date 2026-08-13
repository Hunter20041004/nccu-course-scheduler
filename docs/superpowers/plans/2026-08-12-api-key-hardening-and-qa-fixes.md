# API Key Hardening and QA Fixes Implementation Plan

> **For agentic workers:** Execute inline in this session. Every behavior change follows one vertical Red → Green → Refactor cycle before the next change.

**Goal:** Reduce the Gemini BYOK leakage surface with testable controls and fix the five production QA findings before the public release.

**Architecture:** Keep the approved BYOK architecture: the key lives only in a page-memory closure, travels in the JSON body to the same-origin Worker, and is forwarded to Gemini in the `x-goog-api-key` header. Add defense in depth at the page boundary (clear DOM/pagehide), Worker boundary (nonce CSP, security headers, response redaction), and portable-data boundary; keep validation in the existing pure domain modules so UI, storage restore, and tests share one rule.

**Tech Stack:** Node.js 22+, ES modules, native HTML/CSS/JavaScript, Node test runner, Sites Worker, playwright-cli.

## Global Constraints

- Do not introduce a runtime or development dependency.
- Never print, persist, commit, export, or ask the user to paste a real API key.
- Keep the existing Sunbreak visual system; only add semantic navigation and enlarge interaction areas.
- Preserve all pre-existing user changes in the main checkout.
- Use the existing canonical production URL and Sites project.

---

### Task 1: Worker and browser API-key defense in depth

**Files:**
- Modify: `tests/worker.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/bundle-syntax.test.mjs`
- Modify: `src/worker.mjs`
- Modify: `src/index.html`
- Modify: `src/app.mjs`
- Modify: `scripts/build.mjs`
- Modify: `SECURITY.md`

**Interfaces:**
- `createWorker({ createNonce })` produces nonce-protected HTML.
- Every Worker response removes the exact submitted key from success and error bodies.
- `pagehide` clears the in-memory session; API-key input is cleared before validation starts.

- [ ] **Step 1: Write one failing Worker test for response redaction**

```js
test('redacts the submitted key from successful and failed AI responses', async () => {
  // Stub a service that accidentally returns/throws the submitted test secret.
  // Assert the serialized response never contains that exact secret.
});
```

- [ ] **Step 2: Run `node --test --test-name-pattern="redacts the submitted key" tests/worker.test.mjs` and confirm the secret is currently present**
- [ ] **Step 3: Add a recursive exact-value redactor and use it for all AI route responses and the catch response**
- [ ] **Step 4: Re-run the same test and confirm it passes**
- [ ] **Step 5: Write one failing Worker test for a per-response CSP nonce and security headers**

```js
assert.match(response.headers.get('content-security-policy'), /script-src 'nonce-test_nonce'/);
assert.match(await response.text(), /<script[^>]+nonce="test_nonce"/);
assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
```

- [ ] **Step 6: Run the focused Worker test and confirm the CSP header is absent**
- [ ] **Step 7: Add `__CSP_NONCE__` to inline style/script, replace it per GET, and emit a restrictive CSP plus browser security headers**
- [ ] **Step 8: Re-run Worker and bundle tests; verify the built module script still parses**
- [ ] **Step 9: Write one failing rendered test for clearing the input before awaiting validation and clearing memory on `pagehide`**
- [ ] **Step 10: Run the focused rendered test and confirm the lifecycle controls are absent**
- [ ] **Step 11: Move the input value into the request variable, clear the DOM immediately, and add a `pagehide` memory clear listener**
- [ ] **Step 12: Re-run the rendered test and refactor only duplicated security-header construction**

### Task 2: Manual course credit validation

**Files:**
- Modify: `tests/planner-core.test.mjs`
- Modify: `src/planner-core.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `validateManualCourse(input)` rejects course credits that are blank, non-finite, below 0, above 12, or not in 0.5-credit increments; non-course activities still receive 0 credits.

- [ ] **Step 1: Add one failing contract test covering `13`, `-1`, `0.3`, blank, and valid `0`, `0.5`, `12` course credits**
- [ ] **Step 2: Run `node --test --test-name-pattern="manual course credits" tests/planner-core.test.mjs` and confirm invalid credits return `null` today**
- [ ] **Step 3: Add the minimal numeric/range/increment validation before time validation**
- [ ] **Step 4: Re-run the focused test and the existing manual-course tests; keep all green**
- [ ] **Step 5: Add a rendered interaction assertion that the form focuses `manual-credits` and shows the domain message**

### Task 3: Internship target validation

**Files:**
- Modify: `tests/internship-planner.test.mjs`
- Modify: `src/internship-planner.mjs`
- Modify: `tests/planner-transfer.test.mjs`
- Modify: `src/planner-transfer.mjs`

**Interfaces:**
- `validateInternshipSettings(settings)` rejects non-finite targets, targets outside 0–5, and targets not in 0.5-day increments.
- Imported planner files with invalid internship targets are rejected instead of silently contaminating progress.

- [ ] **Step 1: Add one failing target contract test for `6`, `-1`, `0.3`, `NaN`, and valid `0`, `2.5`, `5`**
- [ ] **Step 2: Run the focused internship test and confirm the invalid targets are accepted today**
- [ ] **Step 3: Add the minimal target validation while preserving the existing short-window error priority**
- [ ] **Step 4: Re-run the focused internship tests**
- [ ] **Step 5: Add one failing transfer test for an invalid target in imported JSON**
- [ ] **Step 6: Import the shared validator in `planner-transfer.mjs`, reject the invalid transfer, and re-run the transfer test**

### Task 4: Screenshot preflight ordering

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Screenshot import validates file presence/type/size before reading or requesting an API key.

- [ ] **Step 1: Strengthen the existing screenshot test so source order must be file → file validation → key gate**
- [ ] **Step 2: Run the focused rendered test and confirm it fails against the current key-first handler**
- [ ] **Step 3: Reorder the three preflight checks without changing the AI request payload**
- [ ] **Step 4: Re-run the focused rendered test and browser-check no-file/non-image behavior**

### Task 5: Semantic navigation

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/index.html`
- Modify: `src/styles.css`

**Interfaces:**
- One visually-hidden `<h1>` identifies the product.
- A first-focus skip link targets `<main id="main-content">` and becomes visible when focused.

- [ ] **Step 1: Add one failing rendered test for exactly one H1, one skip link, and a valid main target**
- [ ] **Step 2: Run the focused test and confirm H1/skip link are absent**
- [ ] **Step 3: Add semantic elements and focus-visible styling using existing Sunbreak tokens**
- [ ] **Step 4: Re-run the test and keyboard-check focus lands on main content**

### Task 6: 44px mobile interaction targets

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Schedule view buttons and asynchronous course buttons have at least 44px height and preserve the existing compact appearance.

- [ ] **Step 1: Add one failing CSS contract test for `min-height: 44px` on both control families**
- [ ] **Step 2: Run the focused rendered test and confirm current 36px values fail**
- [ ] **Step 3: Change only the interaction boxes to 44px and keep existing colors/type/spacing tokens**
- [ ] **Step 4: Re-run the focused test**

### Task 7: Product checkpoint, visual verification, release

**Files:**
- Modify: `SECURITY.md`
- Modify locally after merge: `HANDOFF.md` without overwriting the pre-existing unstaged content

- [ ] **Step 1: Correct Security Policy wording: Key necessarily passes through the same-origin Worker before Gemini and hosting/device/provider risks cannot be guaranteed away**
- [ ] **Step 2: Run `npm run verify`; require unit, rendered, lint, build, and NCCU live contract tests with zero failures**
- [ ] **Step 3: Start the local server and run two screenshot rounds at 1280×800 and 375×812; inspect hierarchy, whitespace, typography, color, alignment, responsive behavior, states, and motion**
- [ ] **Step 4: Run the browser leakage audit with a unique fake key: inspect URL, DOM after submit, LocalStorage, SessionStorage, cookies, IndexedDB names, export JSON, response body, console, pagehide/reload, and captured request destinations**
- [ ] **Step 5: Smoke-test Chrome, Firefox, and WebKit; verify no body overflow and no critical console/server errors**
- [ ] **Step 6: Commit the isolated branch, merge to `main`, run `npm run verify` again on `main`, push, and confirm the remote contains the commit**
- [ ] **Step 7: Deploy the existing Sites project, verify HTTP 200/security headers, then execute manual credit, internship, screenshot preflight, keyboard skip-link, touch-target, and API-key lifecycle flows on the canonical URL**
- [ ] **Step 8: Update `HANDOFF.md` current status while preserving the original checkout's pre-existing edits**
