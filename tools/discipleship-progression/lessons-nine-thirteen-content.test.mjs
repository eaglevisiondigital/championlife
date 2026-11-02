import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const text = path => read(path).toString('utf8');
const digest = path => createHash('sha256').update(read(path)).digest('hex');
const catalogPath = 'tools/discipleship-progression/lessons-nine-thirteen-content.json';
const catalog = JSON.parse(text(catalogPath));
const media = lesson => [...text(`getting-a-grip-${lesson}.html`).matchAll(/<iframe[^>]+src="https:\/\/www.youtube.com\/embed\/([^"]+)"[^>]+title="([^"]+)"/g)].map(([, id, title]) => ({ id, title }));
test('catalog pins original full workbook and is never an authority or completion grant', () => {
  assert.equal(digest(catalog.fullWorkbook.path), catalog.fullWorkbook.sha256);
  assert.equal(catalog.fullWorkbook.pageCount,119);
  assert.equal(catalog.purpose,'source-content-map-only');
  assert.equal(catalog.grantsViewingCredit,false);
  assert.equal(catalog.grantsCompletionCredit,false);
  assert.deepEqual(catalog.lessons.map(l => l.lesson),[9,10,11,12,13]);
  const allowlist=text('tools/site-build/public-files.json');
  assert.ok(!allowlist.includes(catalogPath));
  assert.ok(!allowlist.includes('docs/DISCIPLESHIP-LESSONS-9-13-CONTENT-MAP.md'));
});
for (const lesson of catalog.lessons) {
  test(`Lesson ${lesson.lesson}: exact PDF, mirror, section ranges and owner-bound notes preserved`, () => {
    assert.equal(digest(lesson.source),lesson.sha256);
    assert.equal(digest(lesson.mirror),lesson.sha256);
    assert.equal(lesson.pageCount,lesson.fullWorkbookPages[1]-lesson.fullWorkbookPages[0]+1);
    assert.deepEqual(lesson.printedPages,lesson.fullWorkbookPages.map(p => p+(lesson.lesson===9?6:7)));
    assert.equal(lesson.sections[0].startPage,1);
    assert.equal(lesson.sections.at(-1).endPage,lesson.pageCount);
    lesson.sections.forEach((section,index) => {
      assert.equal(section.label,String.fromCharCode(65+index));
      assert.ok(section.heading.length>5);
      assert.ok(section.startPage>=1 && section.endPage>=section.startPage && section.endPage<=lesson.pageCount);
      if(index) assert.equal(lesson.sections[index-1].endPage,section.startPage);
    });
    assert.deepEqual(media(lesson.lesson),lesson.videos);
    assert.equal(lesson.worksheetStatus,'mapped-not-implemented');
    assert.equal(lesson.trustedPlaybackStatus,'unconfigured');
    const html=text(`getting-a-grip-${lesson.lesson}.html`);
    assert.ok(html.includes(`data-grip-notes-lesson="${lesson.lesson}"`));
    assert.ok(html.includes('assets/js/grip-notes.js'));
    assert.ok(html.includes(`href="${lesson.source}"`));
    if(lesson.lesson>=11) {
      assert.deepEqual(lesson.videos,[]);
      assert.ok(html.includes('Video coming soon'));
    }
  });
}
for(const part of catalog.multipartMedia) test(`Lesson ${part.lesson}: exact listed multipart media, no invented durations or requirements`,()=>{
  assert.deepEqual(media(part.lesson),part.videos);
  assert.equal(part.videos.length,2);
  assert.equal(part.completionPolicy,'required-media-binding-unconfigured');
  assert.equal(part.minimumUniqueEligibleWatchPercent,95);
  assert.equal(part.durationsMs,null);
  assert.equal(part.requiredParts,null);
});
test('sensitive optional source instructions remain distinct from required learner answers',()=>{
  const l13=catalog.lessons.find(l=>l.lesson===13);
  assert.equal(l13.sections.find(s=>s.label==='F').kind,'optional-prayer-instruction');
  assert.equal(l13.sections.find(s=>s.label==='G').kind,'personal-application');
  assert.equal(l13.sections.find(s=>s.label==='H').kind,'group-exercise');
  assert.ok(catalog.lessons.every(l=>!Object.hasOwn(l,'requiredAnswerCount')));
});
