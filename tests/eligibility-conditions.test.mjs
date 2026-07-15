import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConditionDefinitions,
  buildConditionImpacts,
  profileConditionIds,
  rulesForCourse,
  validateCustomCondition,
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

test('explains the course impact of an unchecked required condition', () => {
  const courses = [{
    id: 'analytics',
    title: '商業分析',
    prerequisites: ['statistics'],
  }];
  const definitions = buildConditionDefinitions(courses);

  assert.deepEqual(buildConditionImpacts(courses, definitions, { conditionIds: [] }), [{
    id: 'prerequisite:statistics',
    label: '修過統計學 3 學分',
    category: 'prerequisite',
    description: '部分量化課程將統計學 3 學分列為先修門檻。',
    source: 'course',
    selected: false,
    summary: '影響 1 門候選課',
    affectedCourses: [{
      courseId: 'analytics',
      title: '商業分析',
      enforcement: 'required',
      rationale: '須先具備 statistics。',
      consequence: '沒有時無法直接加入',
    }],
  }]);
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

test('uses labels and explanations supplied by an imported official restriction', () => {
  const definitions = buildConditionDefinitions([{
    id: 'ai-509041001',
    eligibilityRules: [{
      conditionId: 'official-restriction:509041001',
      conditionLabel: '我是歐文系或雙主修學生',
      conditionDescription: '政大官方備註：僅限歐文系及雙主修學生修讀。',
      enforcement: 'required',
      rationale: '僅限歐文系及雙主修學生修讀。',
    }],
  }]);

  assert.deepEqual(definitions[0], {
    id: 'official-restriction:509041001',
    label: '我是歐文系或雙主修學生',
    category: 'official-restriction',
    description: '政大官方備註：僅限歐文系及雙主修學生修讀。',
    source: 'course',
  });
});

test('rejects a custom condition without a name', () => {
  assert.deepEqual(validateCustomCondition({
    label: '   ',
    category: 'other',
    description: '',
  }, []), {
    field: 'label',
    message: '請輸入條件名稱。',
  });
});

test('rejects a custom condition whose normalized name already exists', () => {
  assert.deepEqual(validateCustomCondition({
    label: 'python 基礎',
    category: 'competency',
    description: '',
  }, [{ id: 'competency:python', label: ' Python   基礎 ' }]), {
    field: 'label',
    message: '這項條件已經存在。',
  });
});
