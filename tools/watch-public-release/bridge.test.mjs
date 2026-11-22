import test from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig,publicSchedule,serviceKind,inFallbackWindow,discoveryReceipt,bookletFor} from '../../worship/public-bridge.mjs';
const at=s=>Date.parse(s);
test('production worship remains Central, with current gathering after its start',()=>{
 assert.equal(publicConfig.organization,null);assert.equal(publicConfig.personalNotes,false);
 assert.equal(publicSchedule(publicConfig,at('2026-11-22T16:10:00Z')).state,'pre-live');
 assert.equal(publicSchedule(publicConfig,at('2026-11-22T16:30:00Z')).gathering.key,'sunday-worship');
 assert.equal(publicSchedule(publicConfig,at('2026-11-22T18:00:00Z')).gathering.key,'sunday-worship');
 assert.equal(publicSchedule(publicConfig,at('2026-11-19T00:30:00Z')).gathering.key,'wednesday-worship');
 assert.equal(publicConfig.schedule.some(s=>s.key==='morning-prayer'&&s.days.includes(1)),true);
 assert.equal(publicConfig.schedule.some(s=>s.key==='sunday-prayer'&&s.hour===7&&s.days.includes(0)),true);
});
test('channel fallback is confined to original production service windows',()=>{
 for(const value of ['2026-11-22T16:30:00Z','2026-11-22T19:00:00Z','2026-11-19T00:30:00Z','2026-11-19T03:00:00Z'])assert.equal(inFallbackWindow(at(value)),true,value);
 for(const value of ['2026-11-22T16:29:00Z','2026-11-22T19:01:00Z','2026-11-19T00:29:00Z','2026-11-19T03:01:00Z','2026-11-21T16:30:00Z'])assert.equal(inFallbackWindow(at(value)),false,value);
});
test('prayer cannot inherit Sunday or manually selected worship booklet',()=>{
 const prayer=serviceKind(at('2026-11-22T13:00:00Z'));
 assert.equal(prayer,'sunday-prayer');assert.equal(bookletFor(prayer,'sunday-worship'),null);
 assert.equal(bookletFor(serviceKind(at('2026-11-24T12:30:00Z')),'wednesday-worship'),null);
 assert.equal(bookletFor(serviceKind(at('2026-11-22T16:30:00Z'),'?gathering=prayer'),'sunday-worship'),null);
 assert.equal(bookletFor('sunday-worship').date,'2026-11-15');assert.equal(bookletFor('wednesday-worship').date,'2026-11-18');
 assert.equal(bookletFor('sunday-worship','invalid'),null);
});
test('bounded existing discovery data never becomes arbitrary embed authority',()=>{
 const r=discoveryReceipt({live:true,videoId:'abcdefghijk'},123);
 assert.equal(r.checkedAt,123);assert.equal(r.identity,'abcdefghijk');assert.equal(r.url,'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(discoveryReceipt({live:false,videoId:null}).identity,null);
 for(const d of [null,{}, {live:true,videoId:'https://evil.example'}, {live:'true',videoId:'abcdefghijk'},{live:false,videoId:'abcdefghijk'},{live:false,videoId:null,error:'status-check-failed'}])assert.throws(()=>discoveryReceipt(d));
});
