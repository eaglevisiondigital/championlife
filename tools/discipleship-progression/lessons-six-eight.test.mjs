import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
for(const[l,n]of[[6,7],[7,7],[8,6]])test(`lesson ${l} exact source, groups, original notes/media and no completion claims`,()=>{
 const c=JSON.parse(read(`tools/discipleship-progression/lesson-${l}-content.json`)),h=read(`getting-a-grip-${l}.html`);assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+c.source,import.meta.url))).digest('hex'),c.sha256);assert.equal(c.responseGroups.length,n);assert.deepEqual(c.responseGroups.map(q=>q.id),Array.from({length:n},(_,i)=>i+1));
 for(const q of c.responseGroups){assert.ok(h.includes(q.prompt.replaceAll("'",'&#x27;')));assert.ok(h.includes(`${c.source}#page=${q.page}`));assert.ok(h.includes(`data-worksheet-answer="${q.id}"`))}
 assert.ok(h.includes('assets/js/grip-notes.js'));assert.ok(h.includes('never imported'));assert.ok(h.includes('not a grade, verified viewing, advancement or lesson completion'));assert.ok(h.includes('assets/js/grip-worksheet.js'));assert.ok(!h.includes('Digital fill-in-the-blank questions and submission tools will be added'));assert.ok(!h.includes('grip-course.js'));
 if(l===7){assert.ok(h.includes('intentionally not collected in the cloud'));assert.ok(!c.responseGroups.some(q=>q.prompt==='Personal Application'))}
});
