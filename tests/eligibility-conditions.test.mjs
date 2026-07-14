import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConditionDefinitions,
  profileConditionIds,
  rulesForCourse,
} from '../src/eligibility-conditions.mjs';

test('normalizes legacy program and prerequisite facts into condition ids', () => {
  assert.deepEqual(profileConditionIds({
    programs: ['innovation'],
    prerequisites: ['statistics'],
  }), [
    'program:innovation',
    'prerequisite:statistics',
  ]);
});

test('normalizes legacy course programs and prerequisites into required rules', () => {
  assert.deepEqual(rulesForCourse({
    programs: ['innovation'],
    prerequisites: ['statistics'],
  }), [
    {
      conditionId: 'program:innovation',
      enforcement: 'required',
      rationale: '限具 innovation 相關資格的學生。',
    },
    {
      conditionId: 'prerequisite:statistics',
      enforcement: 'required',
      rationale: '須先具備 statistics。',
    },
  ]);
});

test('discovers course conditions before unique custom conditions with human labels', () => {
  const definitions = buildConditionDefinitions([
    { id: 'agentic', programs: ['innovation'] },
    { id: 'analytics', prerequisites: ['statistics'] },
  ], [
    {
      id: 'program:innovation',
      label: '重複資料',
      category: 'program',
      description: '不應蓋過課程定義',
      source: 'custom',
    },
    {
      id: 'competency:python',
      label: 'Python 基礎',
      category: 'competency',
      description: '我能閱讀 Python 程式',
      source: 'custom',
    },
  ]);

  assert.deepEqual(definitions.map(({ id, label, source }) => ({ id, label, source })), [
    { id: 'program:innovation', label: '創新創業學程資格', source: 'course' },
    { id: 'prerequisite:statistics', label: '修過統計學 3 學分', source: 'course' },
    { id: 'competency:python', label: 'Python 基礎', source: 'custom' },
  ]);
});
