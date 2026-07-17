import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPlannerTransfer,
  exportPlannerTransfer,
  previewPlannerTransfer,
} from '../src/planner-transfer.mjs';

test('exports only portable planner fields and omits sensitive data', () => {
  const exported = JSON.parse(exportPlannerTransfer({
    selectedIds: ['course-a'],
    attendance: { 'course-a': 'physical' },
    lockedCourseIds: ['course-a'],
    addedCourses: [{ id: 'course-a', title: '課程 A', credits: 3, apiKey: 'nested-secret' }],
    profile: { level: 'undergrad', year: 3, conditionIds: ['program:ai'] },
    internshipSettings: { targetDays: 2.5, start: '09:00', end: '18:00', mode: 'auto' },
    apiKey: 'secret',
    profileText: '私人自我介紹',
    screenshot: 'data:image/png;base64,secret',
    providerResponse: { raw: 'secret' },
    unknown: 'drop-me',
  }));

  assert.equal(exported.format, 'sunbreak-planner');
  assert.equal(exported.version, 1);
  assert.deepEqual(exported.state.selectedIds, ['course-a']);
  assert.deepEqual(exported.state.addedCourses, [{ id: 'course-a', title: '課程 A', credits: 3 }]);
  assert.doesNotMatch(JSON.stringify(exported), /secret|私人自我介紹|drop-me/);
});

test('rejects malformed transfer JSON without changing current planner data', () => {
  const current = { selectedIds: ['keep-me'] };
  const preview = previewPlannerTransfer('{bad json', current);

  assert.equal(preview.valid, false);
  assert.equal(preview.error.code, 'INVALID_JSON');
  assert.equal(applyPlannerTransfer(preview, current), current);
});

test('rejects an unrelated JSON document', () => {
  const preview = previewPlannerTransfer(JSON.stringify({ format: 'other', version: 1, state: {} }), {});
  assert.equal(preview.valid, false);
  assert.equal(preview.error.code, 'INVALID_FORMAT');
});

test('rejects an unsupported transfer version', () => {
  const preview = previewPlannerTransfer(JSON.stringify({
    format: 'sunbreak-planner', version: 99, state: {},
  }), {});
  assert.equal(preview.valid, false);
  assert.equal(preview.error.code, 'UNSUPPORTED_VERSION');
});

test('rejects invalid planner field types and unsafe ids', () => {
  const wrongType = previewPlannerTransfer(JSON.stringify({
    format: 'sunbreak-planner', version: 1, state: { selectedIds: 'course-a' },
  }), {});
  const unsafeId = previewPlannerTransfer(JSON.stringify({
    format: 'sunbreak-planner', version: 1, state: { selectedIds: ['<script>'] },
  }), {});

  assert.equal(wrongType.error.code, 'INVALID_STATE');
  assert.equal(unsafeId.error.code, 'INVALID_STATE');
});

test('previews added replaced and duplicate courses before replacing planner state', () => {
  const current = {
    selectedIds: ['course-a'],
    addedCourses: [{ id: 'course-a', title: '舊課程 A' }],
  };
  const raw = JSON.stringify({
    format: 'sunbreak-planner',
    version: 1,
    state: {
      selectedIds: ['course-c'],
      addedCourses: [
        { id: 'course-a', title: '更新課程 A' },
        { id: 'course-c', title: '新課程 C' },
        { id: 'course-c', title: '重複課程 C' },
      ],
      internshipSettings: { targetDays: 3, start: '09:00', end: '18:00', mode: 'auto' },
    },
  });

  const preview = previewPlannerTransfer(raw, current);

  assert.equal(preview.valid, true);
  assert.deepEqual(preview.summary, {
    addedCourses: 1,
    replacedCourses: 1,
    skippedCourses: 1,
    selectedCourses: 1,
    replacesSettings: true,
  });
  assert.deepEqual(preview.state.addedCourses.map(({ id, title }) => ({ id, title })), [
    { id: 'course-a', title: '更新課程 A' },
    { id: 'course-c', title: '新課程 C' },
  ]);
  assert.deepEqual(applyPlannerTransfer(preview, current), preview.state);
  assert.deepEqual(current.selectedIds, ['course-a']);
});
