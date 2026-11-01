import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installStaffOutreachSummary} from './church-outreach-summary-entry.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const A='10000000-0000-4000-8000-000000000001',USER='30000000-0000-4000-8000-000000000003';
const flush=()=>new Promise(r=>setImmediate(r));
function fixture({active=false,mode='outreach',syncSignout=false}={}){
 const dom=new JSDOM(`<!doctype html><body data-staff-workspace="home"><button id="staff-logout">Logout</button><div id="staff-context"><select aria-label="Ministry context"><option>${mode}</option></select><select aria-label="Outreach campaign"><option value="${A}">Huntsville</option></select></div><main id="staff-main" hidden></main></body>`);
 const win=dom.window,doc=win.document,calls=[],listeners=new Set();let handler=null;
 win.StaffWorkspace={active:()=>active};
 win.ChampionLifeAuth={getSession:async()=>({user:{id:USER},access_token:'fictional'}),client:{auth:{
  getUser:async()=>({data:{user:{id:USER,email_confirmed_at:'2026-01-01'}}}),
  onAuthStateChange:fn=>{listeners.add(fn);if(syncSignout)fn('SIGNED_OUT');return{data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}}
 },rpc:async(name,p)=>{calls.push(p.p_action);if(handler)return handler(p);return p.p_action==='context'?{data:{capabilities:['registration.view']}}:{data:{summary:{households:1,adults:1,minors:0,attendees:1,checked_in:0}}}}}};
 if(active)doc.getElementById('staff-main').hidden=false;
 const entry=installStaffOutreachSummary({window:win});
 return{win,doc,entry,calls,listeners,emit:event=>{for(const fn of [...listeners])fn(event)},
  ready:()=>{active=true;doc.getElementById('staff-main').hidden=false},
  handler:fn=>{handler=fn},stop:()=>{active=false;doc.getElementById('staff-main').hidden=true},
  metrics:()=>doc.querySelectorAll('[data-summary-metric]').length,
  destroy:()=>{entry.close();dom.window.close()}};
}
test('waits for actual shell authorization then installs once using the existing principal',async()=>{
 const f=fixture(),auth=f.win.ChampionLifeAuth;
 assert.equal(f.entry.state(),'waiting');assert.equal(f.calls.length,0);assert.equal(f.metrics(),0);
 f.ready();await flush();await flush();
 assert.equal(f.entry.state(),'ready');assert.equal(f.metrics(),5);
 assert.deepEqual(f.calls,['context','list','context']);assert.equal(f.win.ChampionLifeAuth,auth);
 assert.equal(installStaffOutreachSummary({window:f.win}),f.entry);
 assert.equal(f.doc.querySelectorAll('[data-staff-outreach-summary]').length,1);
 await f.entry.refresh();assert.equal(f.calls.length,6);f.destroy();
});
for(const mode of ['church','partners','unknown'])test(mode+' absent module never installs or fetches',async()=>{
 const f=fixture({active:true,mode});await flush();assert.equal(f.entry.state(),'waiting');
 assert.equal(f.calls.length,0);assert.equal(f.metrics(),0);f.destroy();
});
for(const event of ['staff-protected-clear','staff-access-denied','pagehide'])test(event+' before readiness prevents late mounting',async()=>{
 const f=fixture();f.win.dispatchEvent(new f.win.Event(event));f.ready();await flush();
 assert.equal(f.entry.state(),'closed');assert.equal(f.calls.length,0);assert.equal(f.listeners.size,0);
 assert.equal(installStaffOutreachSummary({window:f.win}),f.entry);f.destroy();
});
for(const method of ['close','logout','change','hide','signout'])test(method+' interrupts initial pending response and prevents later RPC/render',async()=>{
 const f=fixture();let release;
 f.handler(()=>new Promise(r=>{release=r}));f.ready();await flush();
 assert.equal(f.entry.state(),'mounting');assert.deepEqual(f.calls,['context']);
 if(method==='close')f.entry.close();
 if(method==='logout')f.doc.getElementById('staff-logout').click();
 if(method==='change')f.doc.querySelector('select').dispatchEvent(new f.win.Event('change',{bubbles:true}));
 if(method==='hide'){f.stop();await flush()}
 if(method==='signout')f.emit('SIGNED_OUT');
 assert.equal(f.entry.state(),'closed');assert.equal(f.metrics(),0);
 release({data:{capabilities:['registration.view']}});await flush();await flush();
 assert.deepEqual(f.calls,['context']);assert.equal(f.metrics(),0);assert.equal(f.listeners.size,0);
 await assert.rejects(f.entry.refresh(),{code:'SUMMARY_NOT_READY'});f.destroy();
});
test('synchronous provider signout while registering leaves no listener or view',()=>{
 const f=fixture({active:true,syncSignout:true});assert.equal(f.entry.state(),'closed');
 assert.equal(f.calls.length,0);assert.equal(f.listeners.size,0);f.destroy();
});
test('server denial disposes the installation; retry requires a fresh shell document',async()=>{
 const f=fixture({active:true});await flush();await flush();assert.equal(f.metrics(),5);
 f.handler(async()=>({error:{code:'42501'},status:403}));
 await assert.rejects(f.entry.refresh(),{code:'SUMMARY_UNAVAILABLE'});
 assert.equal(f.entry.state(),'closed');assert.equal(f.metrics(),0);assert.equal(f.listeners.size,0);
 const before=f.calls.length;await assert.rejects(f.entry.refresh());assert.equal(f.calls.length,before);f.destroy();
});
test('detached refresh handler cannot fetch after teardown',async()=>{
 const f=fixture({active:true});await flush();await flush();
 const button=f.doc.querySelector('[data-staff-outreach-summary] button');f.entry.close();
 const before=f.calls.length;button.dispatchEvent(new f.win.Event('click'));await flush();
 assert.equal(f.calls.length,before);assert.equal(f.metrics(),0);f.destroy();
});
