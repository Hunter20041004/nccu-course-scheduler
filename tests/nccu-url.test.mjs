import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedNccuUrl } from '../src/nccu-url.mjs';

test('allows only HTTPS URLs on NCCU hosts', () => {
  assert.equal(
    trustedNccuUrl('https://newdoc.nccu.edu.tw/teaschm/1151/example.html'),
    'https://newdoc.nccu.edu.tw/teaschm/1151/example.html',
  );
  assert.equal(trustedNccuUrl('http://newdoc.nccu.edu.tw/example.html'), '');
  assert.equal(trustedNccuUrl('javascript:alert(1)'), '');
  assert.equal(trustedNccuUrl('https://nccu.edu.tw.example.com/example.html'), '');
});
