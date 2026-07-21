import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOfficialNotes } from '../src/nccu-course-notes.mjs';

test('keeps language and course classifications out of eligibility rules', () => {
  const classified = classifyOfficialNotes({
    courseCode: '703055001',
    restrictionText: '英語授課。；傳播類課程；本課程為112/113級群C課程；日文系擴大輔系課程',
  });

  assert.deepEqual(classified.eligibilityRules, []);
  assert.deepEqual(classified.deliveryNotes, ['英語授課']);
  assert.deepEqual(classified.programTags, [
    '傳播類課程',
    '本課程為112/113級群C課程',
    '日文系擴大輔系課程',
  ]);
});

test('separates TAICA delivery, event, and program notes without making a checkbox', () => {
  const classified = classifyOfficialNotes({
    courseCode: '070426001',
    restrictionText: '【臺灣大專院校人工智慧學程聯盟課程】1.TAICA主導課程，北科大韓秉軒老師授課。2.遠距上課每週四13:10-16:00，使用NTUCOOL平台。3.12/26共同展示交流期末成果。4.選課前務必詳閱教學大綱，需於本校選課、不可跨校選課。本課程對應AI自然語言學分學程。',
  });

  assert.deepEqual(classified.eligibilityRules, []);
  assert.equal(classified.deliveryNotes.length, 1);
  assert.match(classified.deliveryNotes[0], /遠距上課.*NTUCOOL/);
  assert.deepEqual(classified.examEvents, [{ date: '12/26', label: '共同展示交流期末成果' }]);
  assert.ok(classified.programTags.some((note) => note.includes('TAICA主導課程')));
  assert.ok(classified.programTags.some((note) => note.includes('AI自然語言學分學程')));
});

test('creates a concise required rule only for an explicit enrollment restriction', () => {
  const classified = classifyOfficialNotes({
    courseCode: '509041001',
    restrictionText: '僅限歐文系及雙主修學生修讀。',
  });

  assert.deepEqual(classified.eligibilityRules, [{
    conditionId: 'official-restriction:509041001',
    conditionLabel: '我是歐文系或雙主修學生',
    conditionDescription: '政大官方限制：僅限歐文系及雙主修學生修讀',
    enforcement: 'required',
    rationale: '僅限歐文系及雙主修學生修讀',
    source: 'nccu-official',
    confidence: 'high',
  }]);
});

test('keeps a direct department limit as a required rule', () => {
  const [rule] = classifyOfficialNotes({
    courseCode: '123456001',
    restrictionText: '限本系學生',
  }).eligibilityRules;

  assert.equal(rule.conditionLabel, '我符合：限本系學生');
  assert.equal(rule.enforcement, 'required');
});

test('summarizes alternative language prerequisites as one required rule', () => {
  const restrictionText = '須先修習學士班日文（一）、（二）其中一門，或曾在大學修習日文語文 4 學分以上，或通過日本語能力試驗 N3 以上，始得修習本課程';
  const [rule] = classifyOfficialNotes({
    courseCode: '651171001',
    restrictionText,
  }).eligibilityRules;

  assert.equal(rule.conditionLabel, '我符合本課程任一項日文先修資格');
  assert.equal(rule.rationale, restrictionText);
});
