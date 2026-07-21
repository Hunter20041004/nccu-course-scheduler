import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aiProfileCompletionLabel,
  countCompletedAiProfileFields,
} from '../src/shared-ai-profile.mjs';

test('counts only non-empty shared AI profile fields', () => {
  assert.equal(countCompletedAiProfileFields({
    profileText: '政大學生',
    futureDirection: '  ',
    semesterGoals: '',
    preferences: '週二週四集中',
  }), 2);
});

test('describes empty and partial shared AI profiles', () => {
  assert.equal(aiProfileCompletionLabel({}), '尚未填寫');
  assert.equal(aiProfileCompletionLabel({
    profileText: '會計系',
    preferences: '少考試',
  }), '已填 2／4 項');
});
