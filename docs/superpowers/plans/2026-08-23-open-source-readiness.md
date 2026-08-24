# Open Source Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-public MIT repository easier and safer for outside contributors without changing application behavior.

**Architecture:** Treat contributor documentation and repository templates as tested release artifacts. Use Gitleaks v8.30.1 in a temporary directory for both the working tree and complete Git history, with full redaction and no report committed; add CI secret scanning only after the local method is calibrated with a known synthetic secret.

**Tech Stack:** Markdown, GitHub issue/PR templates, Node test runner, GitHub Actions, Gitleaks v8.30.1.

## Global Constraints

- Repository remains MIT licensed and `package.json` keeps `private: true` to prevent accidental npm publication.
- State clearly that this is not an official NCCU service and official systems/announcements are authoritative.
- Never print, paste, commit, or summarize an actual detected secret value.
- Calibrate secret detection with a known synthetic value before interpreting an empty scan as “no secrets”.
- Scan both the current directory and all Git history; neither source alone proves full coverage.
- Do not rewrite Git history automatically. If a real secret is found, stop release work, identify only type/path/commit, rotate it first, then ask before destructive history cleanup.
- Do not add runtime dependencies or change product UI.
- Do not stage the existing untracked `docs/history/` directory unless its ownership is resolved separately.

## File Map

- Create `CONTRIBUTING.md`: setup, TDD, official-evidence policy, PR workflow.
- Create `CODE_OF_CONDUCT.md`: Contributor Covenant-based conduct and reporting route.
- Create `.github/ISSUE_TEMPLATE/bug_report.yml`: reproducible bug intake without secrets.
- Create `.github/ISSUE_TEMPLATE/course_data_correction.yml`: course-code, semester, official-source correction intake.
- Create `.github/pull_request_template.md`: tests, evidence, privacy, screenshots checklist.
- Create `.github/workflows/secret-scan.yml`: pinned Gitleaks action on push/PR after calibration.
- Modify `README.md`: unofficial-service disclaimer, data currency, correction workflow.
- Modify `tests/release-docs.test.mjs`: document/template contracts.
- Modify `HANDOFF.md`: scan and release evidence.

---

### Task 1: Add contributor guidance under test

**Files:**
- Modify: `tests/release-docs.test.mjs`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write one failing documentation contract**

```js
test('documents contribution setup, TDD, and official course evidence', () => {
  const contributing = readText('CONTRIBUTING.md');
  for (const required of [
    'npm install', 'npm run verify', 'Red → Green → Refactor',
    '九碼課號', '官方課綱', '不要提交 API Key',
  ]) assert.match(contributing, new RegExp(required));
});
```

- [ ] **Step 2: Run and verify RED**

Run `node --test --test-name-pattern="documents contribution setup" tests/release-docs.test.mjs`. Expected: FAIL with `ENOENT` for `CONTRIBUTING.md`.

- [ ] **Step 3: Create the minimal complete guide**

Include: project scope; Node 22.13+ setup; branch naming; one-test-at-a-time TDD; `npm run verify`; official course corrections require semester, nine-digit code, direct public syllabus URL, exact claimed behavior, and conflict/reminder implications; no keys or student data; PR review expectations.

- [ ] **Step 4: Verify GREEN and commit**

```bash
node --test tests/release-docs.test.mjs
git add CONTRIBUTING.md tests/release-docs.test.mjs
git commit -m "docs: add contribution guide"
```

---

### Task 2: Add community conduct policy under test

**Files:**
- Modify: `tests/release-docs.test.mjs`
- Create: `CODE_OF_CONDUCT.md`

- [ ] **Step 1: Write one failing test**

Assert the document contains `Contributor Covenant`, expected/unacceptable behavior, enforcement, and a private reporting route that does not require posting publicly.

- [ ] **Step 2: Run RED, create the policy, run GREEN**

Use Contributor Covenant 2.1 wording, attribute its source, and point enforcement to the repository maintainer/security-advisory route without inventing a new public email address.

- [ ] **Step 3: Commit**

```bash
git add CODE_OF_CONDUCT.md tests/release-docs.test.mjs
git commit -m "docs: add community code of conduct"
```

---

### Task 3: Add issue and pull-request templates one at a time

**Files:**
- Modify: `tests/release-docs.test.mjs`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/course_data_correction.yml`
- Create: `.github/pull_request_template.md`

For each template, perform its own RED → GREEN → commit slice.

- [ ] **Step 1: Bug-report template**

Test for fields covering reproduction, expected/actual result, browser/device, deployed URL, and a warning not to include API keys or private student data. Create valid GitHub issue-form YAML and commit `docs: add bug report template`.

- [ ] **Step 2: Course-data correction template**

Test for semester, nine-digit course code, direct official URL, quoted/paraphrased official evidence, expected schedule/attendance, and fixed exam/display obligations. Create valid YAML and commit `docs: add course correction template`.

- [ ] **Step 3: Pull-request template**

Test for summary, linked issue, Red/Green evidence, full verification, official sources, privacy, desktop/mobile screenshots when UI changes, and limitations. Create the Markdown template and commit `docs: add pull request checklist`.

---

### Task 4: Clarify public-project boundaries in README

**Files:**
- Modify: `tests/release-docs.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write one failing README contract**

Assert the first screen contains `非政大官方服務`, the limitations identify official registration/department notices as authoritative, and a maintenance section tells contributors how to report a course-data correction with semester, code, and official syllabus.

- [ ] **Step 2: Run RED**

Run only the new named test. Expected: FAIL on missing disclaimer/maintenance wording.

- [ ] **Step 3: Add concise README copy**

Place the disclaimer immediately below the demo links. Add `## 課程資料更正` near Limitations; link to `CONTRIBUTING.md` and the course-correction issue template. Explain that verified semester-specific corrections are intentionally not generalized across terms.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/release-docs.test.mjs
git add README.md tests/release-docs.test.mjs
git commit -m "docs: clarify unofficial project and data maintenance"
```

---

### Task 5: Calibrate and run local secret scans safely

**Files:**
- Modify: `HANDOFF.md`
- Create only in a temporary directory: Gitleaks binary, synthetic calibration repo, redacted reports.

- [ ] **Step 1: Download the pinned scanner outside the repository**

Create a `mktemp -d` directory. Download Gitleaks v8.30.1 for Darwin arm64 from its official GitHub release, verify the downloaded archive checksum against the release checksum file, and run `gitleaks version`. Do not install a package globally.

- [ ] **Step 2: Calibrate with a known synthetic answer**

In a separate temporary Git repo, commit a synthetic test token matching a documented Gitleaks test pattern. Run both:

```bash
gitleaks dir --redact=100 --no-banner --report-format=json --report-path=<temp>/dir.json <calibration-repo>
gitleaks git --redact=100 --no-banner --report-format=json --report-path=<temp>/git.json <calibration-repo>
```

Expected: both commands return findings, and both JSON reports contain at least one record while the console/report does not expose the full synthetic value. Remove the entire calibration directory afterward.

- [ ] **Step 3: Scan the project working tree**

Run `gitleaks dir` with `--redact=100`, a temp report path, and the repository root. Record only exit code, finding count, rule IDs, and file paths. Never print the `Secret` field.

- [ ] **Step 4: Scan complete Git history**

Run `gitleaks git --log-opts="--all"` with full redaction and a temp report. Record only exit code, finding count, rule IDs, paths, and abbreviated commits.

- [ ] **Step 5: Apply the decision gate**

If either project scan finds a credible secret: stop; do not commit/push; report type/path/commit only and recommend rotation before any history rewrite. If both are clean: record the calibrated method, scanner version, coverage sources, and zero-finding counts in `HANDOFF.md`.

- [ ] **Step 6: Remove all scan artifacts and verify**

Delete the explicit temporary directory, confirm no report or binary is under the repository, and run `git status --short`. Commit only the `HANDOFF.md` evidence if clean.

---

### Task 6: Add continuous secret scanning

**Files:**
- Modify: `tests/release-docs.test.mjs`
- Create: `.github/workflows/secret-scan.yml`

- [ ] **Step 1: Write one failing workflow contract**

Assert the workflow runs on pushes and pull requests, checks out full history with `fetch-depth: 0`, pins an immutable Gitleaks action version or commit, and uses redacted output.

- [ ] **Step 2: Run RED**

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Create the minimal workflow**

Use `actions/checkout@v4` with `fetch-depth: 0` and the official Gitleaks action pinned to the v8.30.1-compatible immutable reference available at implementation time. Do not require a paid organization-only feature or repository secret.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/release-docs.test.mjs
git add .github/workflows/secret-scan.yml tests/release-docs.test.mjs
git commit -m "ci: scan repository history for secrets"
```

---

### Task 7: Full repository verification and publication

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Record the product-owner checkpoint**

Explain: contributor capability, outsider workflow, document/template structure, contribution data flow, why structured evidence is required, alternatives, security/cost, test/scan evidence, and remaining moderation/maintenance limits.

- [ ] **Step 2: Run fresh verification**

```bash
npm test
npm run lint
npm run test:contract:nccu
git diff --check
```

Expected: zero failures. Re-run both calibrated Gitleaks project scans after all new files exist.

- [ ] **Step 3: Review and push**

Apply `requesting-code-review`, resolve Critical/Important findings with test-first changes, then push `main`. Verify local `HEAD` equals `refs/heads/main` on origin.

- [ ] **Step 4: Verify public GitHub experience**

Open the repository as a public visitor. Verify README disclaimer, MIT license, contribution guide, conduct policy, issue forms, PR template, CI, Pages workflow, and secret-scan workflow are visible. Confirm no private scan artifact or secret value appears.

- [ ] **Step 5: Verify deployment remains healthy**

Because documentation changes trigger existing pipelines, verify GitHub Pages and the canonical Sites URL still return HTTP 200 and have no critical console/server errors. No new production URL may be created.

- [ ] **Step 6: Record and publish final evidence**

Update `HANDOFF.md` with test counts, scan counts/method, workflow result, remote equality, public visitor checks, deployed URLs, and limits. Commit, push, and verify remote equality again.
