import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSyllabusText, fetchOfficialSyllabus } from '../src/nccu-syllabus.mjs';

test('extracts meaningful syllabus text without scripts, styles, or markup', () => {
  const html = `<!doctype html><html><head><style>.hidden{display:none}</style></head><body>
    <script>window.secret = 'do not keep';</script>
    <h2>課程簡介</h2><p>人機互動 &amp; 使用者體驗</p>
    <h2>評量方式</h2><p>專題&nbsp;40%</p>
  </body></html>`;

  assert.equal(
    extractSyllabusText(html),
    '課程簡介\n人機互動 & 使用者體驗\n評量方式\n專題 40%',
  );
});

test('fetches only a trusted official NCCU syllabus and returns cleaned text', async () => {
  let requestedUrl;
  const result = await fetchOfficialSyllabus({
    url: 'https://newdoc.nccu.edu.tw/teaschm/example.html',
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response('<h1>課程名稱</h1><p>人機互動</p>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });

  assert.equal(requestedUrl, 'https://newdoc.nccu.edu.tw/teaschm/example.html');
  assert.deepEqual(result, {
    url: 'https://newdoc.nccu.edu.tw/teaschm/example.html',
    text: '課程名稱\n人機互動',
  });
});
