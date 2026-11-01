import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mountChurchOutreachSummaryView} from './church-outreach-summary-view.mjs';

const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const USER='10000000-0000-4000-8000-000000000001';
const BUSER='20000000-0000-4000-8000-000000000002';
const A='30000000-0000-4000-8000-000000000003';
const B='40000000-0000-4000-8000-000000000004';
const COUNTS={households:2,adults:3,minors:2,attendees:5,checked_in:1};
const gate=()=>{let release;return{promise:new Promise(r=>release=r),release}};
function fixture(){
 const dom=new JSDOM('<!doctype html><main><div id="outreach-summary"></div></main>',{url:'https://synthetic.invalid/staff-home.html'});
 const {document}=dom.window,root=document.getElementById('outreach-summary'),calls=[];
 let allowed=[A],active=true,authUser=USER,sessionUser=USER,confirmed=true,handler=null,authState=null;
 const auth={client:{
  auth:{
   getUser:async()=>({data:{user:{id:authUser,email_confirmed_at:confirmed?'2026-01-01T00:00:00Z':null,is_anonymous:false}}}),
   onAuthStateChange:listener=>{authState=listener;return{data:{subscription:{unsubscribe(){authState=null}}}}}
  },
  rpc:async(name,params)=>{calls.push({name,params});
   if(handler)return handler(name,params);
   if(params.p_action==='context')return{data:{capabilities:params.p_campaign===A?['registration.view']:[]}};
   return{data:{summary:COUNTS,registrations:[{email:'private@example.invalid',notes:'private'}],contribution_amount:400}};
  }
 },getSession:async()=>({user:{id:sessionUser},access_token:'fictional-token'})};
 const view=mountChurchOutreachSummaryView({root,auth,workspace:{active:()=>active},
  eventTarget:dom.window,getAllowedCampaigns:()=>allowed});
 return{dom,root,view,calls,auth,
  setAllowed:v=>{allowed=v},setUser:v=>{authUser=v},setSession:v=>{sessionUser=v},
  setConfirmed:v=>{confirmed=v},setActive:v=>{active=v},setHandler:v=>{handler=v},
  authEvent:type=>authState?.(type,{user:{id:authUser}}),
  event:type=>dom.window.dispatchEvent(new dom.window.Event(type)),
  text:()=>root.textContent,
  totals:()=>Array.from(root.querySelectorAll('[data-summary-metric]')).map(x=>x.textContent)
 };
}
test('no campaign: accessible empty view with no requests or member details',()=>{
 const f=fixture();
 assert.equal(f.calls.length,0);assert.equal(f.root.querySelector('section')?.getAttribute('aria-label'),'Campaign registration summary');
 assert.equal(f.root.querySelector('[role=status]')?.getAttribute('aria-live'),'polite');
 assert.equal(f.root.querySelector('dl').hidden,true);
 assert.equal(f.root.querySelector('button').disabled,true);
 f.view.close();
});

test('renders five whitelisted totals, never a private roster or financial detail',async()=>{
 const f=fixture();f.view.select(A);await f.view.refresh();
 assert.deepEqual(f.totals(),['2','3','2','5','1']);
 assert.deepEqual(f.calls.map(x=>x.params.p_action),['context','list','context']);
 assert.equal(f.root.querySelector('dl').hidden,false);
 assert.equal(f.root.querySelector('button').disabled,false);
 assert.ok(!f.text().includes('private@example.invalid'));
 assert.ok(!f.text().includes('400'));
 f.view.close();
});

test('foreign or malformed selected campaign never reaches provider RPC',()=>{
 const f=fixture();
 for(const bad of [B,'',A+'\n','wrong',null]){
  assert.throws(()=>f.view.select(bad),{code:'CAMPAIGN_NOT_ALLOWED'});
  assert.equal(f.root.querySelector('dl').hidden,true);
 }
 assert.equal(f.calls.length,0);
 f.view.close();
});

test('server campaign denial clears the summary and displays only a safe generic status',async()=>{
 const f=fixture();f.setAllowed([A,B]);f.view.select(B);
 await assert.rejects(f.view.refresh(),{code:'SUMMARY_UNAVAILABLE'});
 assert.equal(f.totals().length,0);
 assert.equal(f.root.querySelector('dl').hidden,true);
 assert.ok(!f.text().includes('42501'));
 f.view.close();
});

test('unconfirmed authentication cannot cause source RPC or visible totals',async()=>{
 const f=fixture();f.setConfirmed(false);f.view.select(A);
 await assert.rejects(f.view.refresh(),{code:'SUMMARY_UNAVAILABLE'});
 assert.equal(f.calls.length,0);
 assert.equal(f.totals().length,0);
 f.view.close();
});

test('sign-out event hides totals synchronously, no retained private snapshot',async()=>{
 const f=fixture();f.view.select(A);await f.view.refresh();
 f.authEvent('SIGNED_OUT');
 assert.equal(f.totals().length,0);
 assert.equal(f.root.querySelector('dl').hidden,true);
 await assert.rejects(f.view.refresh(),{code:'SUMMARY_UNAVAILABLE'});
 f.view.close();
});

test('account change on the next refresh cannot reuse old campaign result',async()=>{
 const f=fixture();f.view.select(A);await f.view.refresh();
 f.setUser(BUSER);
 await assert.rejects(f.view.refresh(),{code:'SUMMARY_UNAVAILABLE'});
 assert.equal(f.totals().length,0);
 f.view.close();
});

test('new campaign selection clears A immediately and late A response cannot restore it',async()=>{
 const f=fixture(),slow=gate();
 f.setAllowed([A,B]);
 f.setHandler(async(_name,p)=>{
  if(p.p_campaign===A)return slow.promise;
  if(p.p_action==='context')return{data:{capabilities:['registration.view']}};
  return{data:{summary:{households:1,adults:1,minors:0,attendees:1,checked_in:0}}};
 });
 f.view.select(A);const old=f.view.refresh();
 await new Promise(r=>setImmediate(r));f.view.select(B);
 assert.equal(f.totals().length,0);
 await f.view.refresh();
 slow.release({data:{capabilities:['registration.view']}});
 await assert.rejects(old,{code:'SUMMARY_UNAVAILABLE'});
 assert.deepEqual(f.totals(),['1','1','0','1','0']);
 f.view.close();
});

test('server revocation after list never displays fetched private payload',async()=>{
 const f=fixture();let calls=0;
 f.setHandler(async(_name,p)=>{
  if(++calls===3)return{error:{code:'42501'},status:403};
  return p.p_action==='context'?{data:{capabilities:['registration.view']}}:
   {data:{summary:COUNTS,registrations:[{email:'private@example.invalid'}]}};
 });
 f.view.select(A);
 await assert.rejects(f.view.refresh(),{code:'SUMMARY_UNAVAILABLE'});
 assert.equal(f.totals().length,0);assert.ok(!f.text().includes('private'));
 f.view.close();
});

test('protected-clear, pagehide and close remove the entire renderer and discard queued responses',async()=>{
 for(const eventName of ['staff-protected-clear','pagehide']){
  const f=fixture(),slow=gate();f.setHandler(async()=>slow.promise);
  f.view.select(A);const pending=f.view.refresh();
  await new Promise(r=>setImmediate(r));
  f.event(eventName);
  slow.release({data:{capabilities:['registration.view']}});
  await assert.rejects(pending,{code:'SUMMARY_UNAVAILABLE'});
  assert.equal(f.root.querySelector('dl').hidden,true);
  assert.equal(f.totals().length,0);
  f.view.close();
  assert.equal(f.root.children.length,0);
 }
});

test('refresh button uses current verified scope and ignores rejection details',async()=>{
 const f=fixture();f.view.select(A);
 const action=f.root.querySelector('button');action.click();
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(f.totals(),['2','3','2','5','1']);
 assert.equal(action.disabled,false);
 f.setHandler(async()=>{throw Error('provider secret disclosure')});
 action.click();
 await new Promise(r=>setImmediate(r));
 assert.equal(f.totals().length,0);assert.ok(!f.text().includes('provider secret'));
 f.view.close();
});

test('no public controls for payment, member export, role grant or unsafe HTML injection',()=>{
 const f=fixture();
 assert.equal(f.root.querySelector('script'),null);
 assert.equal(f.root.querySelector('input'),null);
 assert.deepEqual(Object.keys(f.view).sort(),['close','refresh','revoke','select']);
 f.view.close();
});

test('compromised campaign UI hint containing trailing LF/CRLF is not accepted',()=>{
 for(const suffix of ['\n','\r\n']){
  const f=fixture(),malformed=A+suffix;
  f.setAllowed([malformed]);
  assert.throws(()=>f.view.select(malformed),{code:'CAMPAIGN_NOT_ALLOWED'});
  assert.equal(f.calls.length,0);
  f.view.close();
 }
});
