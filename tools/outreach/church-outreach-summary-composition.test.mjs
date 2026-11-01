import test from 'node:test';
import assert from 'node:assert/strict';
import {createChurchOutreachSummaryComposition} from './church-outreach-summary-composition.mjs';

const U='00000000-0000-4000-8000-000000000011';
const V='00000000-0000-4000-8000-000000000022';
const A='00000000-0000-4000-8000-000000000033';
const B='00000000-0000-4000-8000-000000000044';
const counts={households:2,attendees:5,adults:3,minors:2,checked_in:1};
const gate=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve}};
function fixture(){
 let user={verified:true,userId:U,sessionId:'fictional-session-1',generation:1};
 const events=new Map(),messages=[],calls=[],outputs=[];
 let reply=async(_name,p)=>{
  if(p.p_action==='context')return {data:{capabilities:p.p_campaign===A?['registration.view']:[]}};
  return {data:{summary:counts,registrations:[{email:'private@example.invalid'}],payment:{amount:500}}};
 };
 const subscribeEvent=(name,listener)=>{events.set(name,listener);return()=>events.delete(name)};
 const component=createChurchOutreachSummaryComposition({
  getVerifiedSession:async()=>user,rpc:async(...args)=>{calls.push(args);return reply(...args)},
  subscribeEvent,onSnapshot:result=>outputs.push(result)
 });
 return{component,calls,outputs,events,setSession:value=>user=value,setReply:fn=>reply=fn,
  signal:name=>{const listener=events.get(name);messages.push(name);listener?.()},
  messages};
}
test('composes trusted PR63 RPC read through PR65 lifecycle and emits aggregate-only snapshot',async()=>{
 const f=fixture();f.component.select(A);
 const result=await f.component.refresh();
 assert.deepEqual(result.counts,counts);
 assert.deepEqual(Object.keys(result).sort(),['campaignId','counts','kind']);
 assert.deepEqual(f.calls.map(x=>x[1].p_action),['context','list','context']);
 assert.ok(f.calls.every(x=>x[0]==='outreach_registration_workspace'&&x[1].p_campaign===A));
 assert.equal(JSON.stringify(f.outputs).includes('private@example.invalid'),false);
 assert.equal(JSON.stringify(f.outputs).includes('payment'),false);
 f.component.close();
});

test('server campaign denial stays authoritative despite consumer selection',async()=>{
 const f=fixture();f.component.select(B);
 await assert.rejects(f.component.refresh(),{code:'ACCESS_DENIED'});
 assert.equal(f.calls.length,1);
 assert.equal(f.component.snapshot(),null);
 f.component.close();
});

test('protected-clear event closes permanently and removes event listeners',async()=>{
 const f=fixture();f.component.select(A);await f.component.refresh();
 f.signal('staff-protected-clear');
 assert.equal(f.component.snapshot(),null);
 assert.equal(f.outputs.at(-1),null);
 assert.equal(f.events.size,0);
 assert.throws(()=>f.component.select(B),{code:'WORKSPACE_CLOSED'});
 await assert.rejects(f.component.refresh(),{code:'WORKSPACE_CLOSED'});
});

test('pagehide closes without remote logout and cannot reopen on focus',async()=>{
 const f=fixture();f.component.select(A);
 f.signal('pagehide');
 assert.throws(()=>f.component.select(A),{code:'WORKSPACE_CLOSED'});
 assert.equal(f.events.size,0);assert.equal(f.calls.length,0);
});

test('session switch during a pending context never emits stale data',async()=>{
 const f=fixture(),slow=gate();
 f.setReply(async(_name,p)=>p.p_action==='context'?slow.promise:{data:{summary:counts}});
 f.component.select(A);
 const pending=f.component.refresh();
 await new Promise(r=>setImmediate(r));
 f.setSession({verified:true,userId:V,sessionId:'fictional-session-2',generation:2});
 slow.resolve({data:{capabilities:['registration.view']}});
 await assert.rejects(pending,{code:'STALE_SCOPE'});
 assert.equal(f.component.snapshot(),null);
 assert.equal(f.outputs.filter(Boolean).length,0);
 f.component.close();
});

test('old campaign response cannot overwrite new campaign result',async()=>{
 const f=fixture(),slow=gate();
 f.setReply(async(_name,p)=>{
  if(p.p_campaign===A)return slow.promise;
  return p.p_action==='context'?{data:{capabilities:['registration.view']}}:{data:{summary:counts}};
 });
 f.component.select(A);const old=f.component.refresh();
 await new Promise(r=>setImmediate(r));
 f.component.select(B);const current=await f.component.refresh();
 slow.resolve({data:{capabilities:['registration.view']}});
 await assert.rejects(old,{code:'STALE_SCOPE'});
 assert.equal(f.component.snapshot(),current);
 assert.equal(current.campaignId,B);
 f.component.close();
});

test('unverified Auth principal never calls an RPC',async()=>{
 const f=fixture();f.setSession({verified:false,userId:U,sessionId:'x',generation:1});
 f.component.select(A);
 await assert.rejects(f.component.refresh(),{code:'UNAUTHENTICATED'});
 assert.equal(f.calls.length,0);f.component.close();
});

test('revocation after list is rejected even though initial context passed',async()=>{
 const f=fixture();let n=0;
 f.setReply(async(_name,p)=>{
  n++;if(n===3)return{error:{code:'42501',status:403}};
  return p.p_action==='context'?{data:{capabilities:['registration.view']}}:{data:{summary:counts}};
 });
 f.component.select(A);
 await assert.rejects(f.component.refresh(),{code:'ACCESS_DENIED'});
 assert.equal(n,3);
 assert.equal(f.outputs.filter(Boolean).length,0);f.component.close();
});

test('invalid count and extra records cannot leave the composed boundary',async()=>{
 const f=fixture();
 f.setReply(async(_name,p)=>p.p_action==='context'?{data:{capabilities:['registration.view']}}:
  {data:{summary:{...counts,adults:6},registrationRows:[{email:'secret@example.invalid'}]}});
 f.component.select(A);
 await assert.rejects(f.component.refresh(),{code:'INVALID_SUMMARY'});
 assert.equal(f.component.snapshot(),null);
 assert.equal(f.outputs.filter(Boolean).length,0);f.component.close();
});

test('consumer-triggered revoke in successful callback prevents a stale return',async()=>{
 let component;const events=new Map(),out=[];
 const subscribeEvent=(name,fn)=>{events.set(name,fn);return()=>events.delete(name)};
 component=createChurchOutreachSummaryComposition({
  getVerifiedSession:async()=>({verified:true,userId:U,sessionId:'fictional',generation:1}),
  rpc:async(_name,p)=>p.p_action==='context'?{data:{capabilities:['registration.view']}}:{data:{summary:counts}},
  onSnapshot:datum=>{out.push(datum);if(datum)component.revoke()},subscribeEvent
 });
 component.select(A);
 await assert.rejects(component.refresh(),{code:'STALE_SCOPE'});
 assert.equal(component.snapshot(),null);
 assert.equal(out.at(-1),null);
 component.close();
});

test('cleanup detaches event handlers and exposes only read-only operations',()=>{
 const f=fixture();
 assert.deepEqual(Object.keys(f.component).sort(),['close','refresh','revoke','select','snapshot']);
 f.component.close();assert.equal(f.events.size,0);
 f.component.close();assert.equal(f.events.size,0);
});
