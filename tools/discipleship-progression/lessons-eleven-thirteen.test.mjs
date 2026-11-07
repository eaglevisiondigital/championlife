import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
const map = JSON.parse(read('tools/discipleship-progression/lessons-nine-thirteen-content.json'));
const selected = [
  ["If we want to be great in God's kingdom, what must we do?", 1, 'B.1', 'Matthew 20:26,27'],
  ['What ministry has God called every believer to be involved in?', 1, 'C.1', '2 Corinthians 5:17-21'],
  ['In our life what are we to seek first?', 4, 'D.1', 'Matthew 6:33'],
  ['Who has received gifts?', 6, 'E.2', '1 Peter 4:10']
];

for (const [lesson, count] of [[11, 4], [12, 3], [13, 4]]) {
  const catalog = JSON.parse(read(`tools/discipleship-progression/lesson-${lesson}-content.json`));
  const chapter = map.lessons.find(row => row.lesson === lesson);
  const html = read(`getting-a-grip-${lesson}.html`);

  test(`lesson ${lesson}: approved chapter bytes, mirror, and exact selected content`, () => {
    assert.equal(catalog.source, chapter.source);
    assert.equal(catalog.sha256, chapter.sha256);
    assert.equal(hash(catalog.source), chapter.sha256);
    assert.equal(hash(chapter.mirror), chapter.sha256);
    assert.equal(catalog.responseGroups.length, count);
    assert.deepEqual(catalog.responseGroups.map(row => row.id), Array.from({ length: count }, (_, i) => i + 1));
    assert.equal(catalog.worksheet, `lesson-${lesson}-workbook-sections-v1`);
    if (lesson === 13) {
      assert.deepEqual(catalog.responseGroups.map(row => [row.prompt, row.page, row.sourceSection, row.scripture]), selected);
      assert.match(html, /selected Scripture study, not a complete transcription or grading rubric/);
    } else {
      assert.deepEqual(catalog.responseGroups.map(row => [row.prompt, row.page, row.sourceSection]), chapter.sections.slice(0, count).map(row => [row.heading, row.startPage, row.label]));
    }
  });

  test(`lesson ${lesson}: accessible exact fields start disabled and preserve identity-isolated notes`, () => {
    assert.equal((html.match(/data-grip-worksheet=/g) || []).length, 1);
    assert.match(html, new RegExp(`data-grip-worksheet="${lesson}"`));
    assert.match(html, /<fieldset disabled data-worksheet-fields>/);
    assert.equal((html.match(/data-worksheet-answer=/g) || []).length, count);
    for (const row of catalog.responseGroups) {
      assert.ok(html.includes(`<label for="worksheet-${lesson}-${row.id}">${row.id}. ${escape(row.prompt)}</label>`));
      assert.ok(html.includes(`${catalog.source}#page=${row.page}`));
      assert.ok(html.includes(`id="worksheet-${lesson}-${row.id}" data-worksheet-answer="${row.id}"`));
    }
    assert.match(html, new RegExp(`data-grip-notes-lesson="${lesson}"`));
    assert.match(html, /assets\/js\/grip-notes.js/);
    assert.match(html, /assets\/js\/grip-worksheet.js/);
    assert.match(html, /never imported into these answers automatically/);
    assert.match(html, /reloading replaces unsaved edits/);
    assert.match(html, /supabase-js-2\.118\.0\.js" integrity="sha384-UagCvVPT5XXA0Hx\+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT\+39j5VfRjdP5Tp"/);
    assert.doesNotMatch(html, /data-worksheet-answer="\d+"[^>]*\brequired\b/);
  });

  test(`lesson ${lesson}: missing video remains truthful and answers grant no authority`, () => {
    assert.equal(catalog.grantsViewingCredit, false);
    assert.equal(catalog.grantsCompletionCredit, false);
    assert.ok(html.includes(escape(catalog.excludedActivities)));
    assert.match(html, /Video coming soon/);
    assert.match(html, /Saving answers does not substitute for the required viewing/);
    assert.match(html, /not a grade, verified viewing, advancement or lesson completion/);
    assert.doesNotMatch(html, /youtube\.com\/embed|grip-course\.js|data-complete|complete_lesson/);
    assert.doesNotMatch(html, /Digital fill-in-the-blank questions and submission tools will be added/);
    for (const prompt of ['Make a list of your non-believing friends', 'Make a list of your new', 'How do I spend my money?', 'What percentage of my finances', 'Are you willing to be a laborer?', 'What changes could you make?']) {
      assert.ok(!html.includes(prompt), `excluded sensitive prompt: ${prompt}`);
    }
  });
}
