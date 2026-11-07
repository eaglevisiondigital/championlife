import test from 'node:test';import assert from 'node:assert/strict';
import {current,original,expected,expectedRouter,verifyActual,checkpointReader,runtimePaths,additions} from './source.mjs';
const alter=(p,b)=>x=>x===p?Buffer.from(b):current(x);
test('actual complete integration validated before immutable historical projection',()=>{const v=verifyActual();assert.equal(v.runtimePaths.length,4);const read=checkpointReader();for(const p of runtimePaths){assert.deepEqual(current(p),expected(p));assert.deepEqual(read(p),original(p));assert.notDeepEqual(current(p),original(p))}});
test('each integrated runtime rejects unreviewed bytes',()=>{for(const p of runtimePaths)assert.throws(()=>verifyActual(alter(p,Buffer.concat([current(p),Buffer.from('\n// drift')]))),/Exact actual source/)});
test('People current-actor fence, SQL, shared host and SDK config remain exact',()=>{for(const p of ['assets/js/outreach-people.js','assets/js/staff-workspace.js','assets/js/champion-life-auth.js','assets/js/supabase-config.js','supabase/bootstrap/automatic-rls.sql']){assert.deepEqual(current(p),original(p));assert.throws(()=>verifyActual(alter(p,Buffer.alloc(0))),/Exact actual source/)}});
test('historical source/build routers exact, cannot remove actual verification',()=>{for(const p of ['tools/staff-runtime-cycle14/source.mjs','tools/staff-runtime-cycle14/build.mjs','tools/staff-cycle9-integrity/integrity.mjs']){assert.deepEqual(current(p),expectedRouter(p));assert.throws(()=>verifyActual(alter(p,original(p))),/Exact actual source/)}});
test('original Staff workflow, timeout and strict assertion files cannot change',()=>{for(const p of ['.github/workflows/staff-runtime-cycle14.yml','tools/staff-runtime-cycle14/source.test.mjs','tools/staff-runtime-cycle14/independent.test.mjs','tools/staff-cycle8/modules-unload.test.mjs']){assert.deepEqual(current(p),original(p));assert.throws(()=>verifyActual(alter(p,Buffer.alloc(0))),/Exact actual source/)}});
test('changing runtime manifest hashes cannot approve source drift',()=>{const p='tools/staff-integration-cycle16/provenance.json',v=JSON.parse(current(p));v.runtime[runtimePaths[0]].composed='0'.repeat(64);assert.throws(()=>verifyActual(alter(p,JSON.stringify(v))),/Derived runtime provenance/)});
test('all new tests and workflow are included and bound to reviewed bytes',()=>{const p='tools/staff-integration-cycle16/provenance.json',v=JSON.parse(current(p));assert.equal(Object.keys(v.reviewedAdditions).length,additions.length-2);for(const path of ['.github/workflows/staff-integration-cycle16.yml','tools/comms-host-cycle16/remount.browser.mjs','tools/partner-staff-cycle16/journey.browser.mjs'])assert.throws(()=>verifyActual(alter(path,Buffer.alloc(0))),/Reviewed addition bytes/)});

test('modified source recipe and matching manifest digest cannot self-authorize',()=>{const p='tools/partner-staff-cycle16/source.mjs',m='tools/staff-integration-cycle16/provenance.json',v=JSON.parse(current(m));v.reviewedAdditions[p]='0'.repeat(64);assert.throws(()=>verifyActual(x=>x===m?Buffer.from(JSON.stringify(v)):x===p?Buffer.from('// changed recipe'):current(x)),/cannot be self-approved|Reviewed addition bytes/) });

// Exact-source fixture compatibility: no relaxed session or browser-error assertion.
import {verifySessionBytes,reviewedHostSession} from './session-source.mjs';
import {loadSource as pinnedSource} from '../staff-cycle7/source.mjs';
import {fileURLToPath} from 'node:url';
import {root} from './source.mjs';
test('fixture serves actual session derived from immutable97 and115 with only Partner route',()=>{
 assert.equal(pinnedSource('sharedSession'),original('assets/js/staff-session.js').toString());
 assert.equal(reviewedHostSession(fileURLToPath(root),pinnedSource('sharedSession')),current('assets/js/staff-session.js').toString());
});
test('fixture rejects old unadapted candidate and any additional session changes',()=>{
 const baseline=pinnedSource('sharedSession'),actual=current('assets/js/staff-session.js').toString();
 for(const bytes of [baseline,actual+'\n// unreviewed',actual.replace('unavailable','approved')])assert.throws(()=>verifySessionBytes(bytes,baseline),/Candidate session/);
 assert.throws(()=>verifySessionBytes(actual,baseline+'\n'),/Historical97/);
});
test('fixture rejects another root and preserves strict historical browser assertions',()=>{
 assert.throws(()=>reviewedHostSession(fileURLToPath(new URL('../',root)),pinnedSource('sharedSession')),/Host must be/);
 for(const p of ['tools/staff-cycle8/modules-source.mjs','tools/staff-cycle8/people-independent.browser.mjs','tools/staff-cycle8/modules.browser.mjs','tools/backend-tests/staff-session.browser.mjs']){
  assert.deepEqual(current(p),expectedRouter(p));
  assert.throws(()=>verifyActual(alter(p,original(p))),/Exact actual source/);
 }
 const path='tools/staff-cycle8/modules.browser.mjs',marker='  const unexpectedErrors=';
 assert.equal(current(path).toString().split(marker)[1].split('console.log(JSON.stringify({status:')[0],original(path).toString().split(marker)[1].split('console.log(JSON.stringify({status:')[0]);
});
