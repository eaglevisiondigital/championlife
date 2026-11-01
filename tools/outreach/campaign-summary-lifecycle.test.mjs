import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignSummaryLifecycle} from './campaign-summary-lifecycle.mjs';

const A='10000000-0000-4000-8000-000000000001';
const B='20000000-0000-4000-8000-000000000002';
const counts={households:2,attendees:5,adults:3,minors:2,checked_in:1};
const summary=id=>({campaignId:id,kind:'event-registration-summary',counts,
  registrations:[{name:'do-not-emit',email:'hidden@example.invalid'}],
  finance:{account:'do-not-emit'},notes:'do-not-emit'});
function gate(){let release;return{promise:new Promise(resolve=>release=resolve),release}}
function fixture(){
 const emitted=[],calls=[],invalidations=[];
 let read=async id=>summary(id);
 const reader={read:async id=>{calls.push(id);return read(id)},invalidate:()=>invalidations.push(true)};
 const lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:x=>emitted.push(x)});
 return{lifecycle,emitted,calls,invalidations,change:fn=>read=fn};
}

test('reads selected campaign, emits only frozen aggregate counts, no private fields',async()=>{
 const f=fixture();f.lifecycle.select(A);
 const dto=await f.lifecycle.refresh();
 assert.deepEqual(Object.keys(dto).sort(),['campaignId','counts','kind']);
 assert.deepEqual(dto.counts,counts);assert.equal(f.lifecycle.snapshot(),dto);
 assert.deepEqual(f.calls,[A]);
 assert.equal(JSON.stringify(f.emitted).includes('do-not-emit'),false);
 assert.throws(()=>{dto.counts.households=20},TypeError);
 assert.throws(()=>{dto.counts.hidden='bad'},TypeError);
});

test('selecting a second campaign clears first before reading the second',async()=>{
 const f=fixture();f.lifecycle.select(A);await f.lifecycle.refresh();
 f.lifecycle.select(B);
 assert.equal(f.lifecycle.snapshot(),null);
 assert.equal(f.emitted.at(-1),null);
 const newer=await f.lifecycle.refresh();
 assert.equal(newer.campaignId,B);assert.deepEqual(f.calls,[A,B]);
});

test('invalid campaign rejects without RPC or retention of previous summary',async()=>{
 const f=fixture();f.lifecycle.select(A);await f.lifecycle.refresh();
 for(const bad of ['',A+'\n','abc',null]){
  assert.throws(()=>f.lifecycle.select(bad),{code:'INVALID_CAMPAIGN'});
  assert.equal(f.lifecycle.snapshot(),null);
 }
 assert.deepEqual(f.calls,[A]);
});

test('on permission denial, clears all state and returns only a safe error code',async()=>{
 const f=fixture();f.lifecycle.select(A);
 f.change(async()=>{throw Object.assign(new Error('private grant detail'),{code:'ACCESS_DENIED'})});
 await assert.rejects(f.lifecycle.refresh(),{code:'ACCESS_DENIED',message:'ACCESS_DENIED'});
 assert.equal(f.lifecycle.snapshot(),null);assert.equal(f.emitted.at(-1),null);
 await assert.rejects(f.lifecycle.refresh(),{code:'INVALID_CAMPAIGN'});
});

test('raw provider error detail is sanitized',async()=>{
 const f=fixture();f.lifecycle.select(A);
 f.change(async()=>{throw Error('private SQL and session token')});
 await assert.rejects(f.lifecycle.refresh(),{code:'REQUEST_FAILED',message:'REQUEST_FAILED'});
 assert.ok(!JSON.stringify(f.emitted).includes('private'));
});

test('late A response cannot replace selected B summary',async()=>{
 const f=fixture(),slow=gate();f.change(async id=>id===A?slow.promise:summary(id));
 f.lifecycle.select(A);const old=f.lifecycle.refresh();
 await new Promise(r=>setImmediate(r));
 f.lifecycle.select(B);const fresh=await f.lifecycle.refresh();
 slow.release(summary(A));
 await assert.rejects(old,{code:'STALE_SCOPE'});
 assert.equal(f.lifecycle.snapshot(),fresh);
 assert.equal(f.emitted.at(-1),fresh);
});

test('older rejection cannot clear newer campaign',async()=>{
 const f=fixture(),slow=gate();f.change(async id=>id===A?slow.promise:summary(id));
 f.lifecycle.select(A);const old=f.lifecycle.refresh();
 await new Promise(r=>setImmediate(r));f.lifecycle.select(B);
 const newer=await f.lifecycle.refresh();
 slow.release(Promise.reject(Object.assign(Error('denial'),{code:'ACCESS_DENIED'})));
 await assert.rejects(old,{code:'STALE_SCOPE'});
 assert.equal(f.lifecycle.snapshot(),newer);
});

test('logout or workspace revocation clears immediately and discards pending read',async()=>{
 const f=fixture(),slow=gate();f.change(async()=>slow.promise);
 f.lifecycle.select(A);const old=f.lifecycle.refresh();
 await new Promise(r=>setImmediate(r));
 f.lifecycle.revoke();
 assert.equal(f.lifecycle.snapshot(),null);assert.equal(f.emitted.at(-1),null);
 slow.release(summary(A));
 await assert.rejects(old,{code:'STALE_SCOPE'});
 await assert.rejects(f.lifecycle.refresh(),{code:'INVALID_CAMPAIGN'});
});

test('close is permanent and pending results are discarded',async()=>{
 const f=fixture(),slow=gate();f.change(async()=>slow.promise);
 f.lifecycle.select(A);const old=f.lifecycle.refresh();
 await new Promise(r=>setImmediate(r));f.lifecycle.close();
 slow.release(summary(A));
 await assert.rejects(old,{code:'STALE_SCOPE'});
 assert.equal(f.lifecycle.snapshot(),null);
 assert.throws(()=>f.lifecycle.select(B),{code:'WORKSPACE_CLOSED'});
 await assert.rejects(f.lifecycle.refresh(),{code:'WORKSPACE_CLOSED'});
});

test('reentrant revocation in UI callback prevents returning a stale visible result',async()=>{
 const emissions=[],reader={read:async id=>summary(id),invalidate(){}};
 let lifecycle;
 lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot:dto=>{
  emissions.push(dto);
  if(dto)lifecycle.revoke();
 }});
 lifecycle.select(A);
 await assert.rejects(lifecycle.refresh(),{code:'STALE_SCOPE'});
 assert.equal(lifecycle.snapshot(),null);
 assert.equal(emissions.at(-1),null);
});

test('malformed and inconsistent counts are not emitted',async()=>{
 for(const invalid of [
  {...counts,adults:4},{...counts,checked_in:6},{...counts,households:-1},
  {...counts,attendees:'5'},{...counts,minors:1.5},{...counts,adults:Infinity},
  {...counts,attendees:Number.MAX_SAFE_INTEGER+1}
 ]){
  const f=fixture();f.lifecycle.select(A);
  f.change(async id=>({...summary(id),counts:invalid}));
  await assert.rejects(f.lifecycle.refresh(),{code:'INVALID_SUMMARY'});
  assert.equal(f.lifecycle.snapshot(),null);
  assert.ok(f.emitted.every(x=>x===null));
 }
});

test('wrong campaign and wrong summary kind cannot leave the boundary',async()=>{
 for(const malformed of [id=>({...summary(id),campaignId:B}),id=>({...summary(id),kind:'partner-finance'})]){
  const f=fixture();f.lifecycle.select(A);
  f.change(async id=>malformed(id));
  await assert.rejects(f.lifecycle.refresh(),{code:'INVALID_SUMMARY'});
  assert.equal(f.lifecycle.snapshot(),null);
 }
});

test('a second concurrent refresh invalidates the first even for the same campaign',async()=>{
 const f=fixture(),slow=gate();let n=0;
 f.change(async id=>++n===1?slow.promise:summary(id));
 f.lifecycle.select(A);
 const first=f.lifecycle.refresh();
 await new Promise(r=>setImmediate(r));
 const latest=await f.lifecycle.refresh();
 slow.release(summary(A));
 await assert.rejects(first,{code:'STALE_SCOPE'});
 assert.equal(f.lifecycle.snapshot(),latest);
});

test('boundary has no mutation, export or authorization-grant method',()=>{
 const f=fixture();
 assert.deepEqual(Object.keys(f.lifecycle).sort(),['close','refresh','revoke','select','snapshot']);
});
