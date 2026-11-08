// Actual Lessons 1–4 markup/runtime; fictional account, transport and timers only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from '../backend-tests/node_modules/jsdom/lib/api.js';
const root=new URL('../../',import.meta.url), read=p=>fs.readFileSync(new URL(p,root),'utf8');
const flush=()=>new Promise(r=>setTimeout(r,8));
async function fixture(lesson=1){
 const dom=new JSDOM(read(`getting-a-grip-${lesson}.html`).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://fictional.example.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 const errors=[];w.addEventListener('error',event=>errors.push(event.message));
 const A={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01'},B={...A,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'};
 let actor=A,holdSession=false,sessionWaiters=[],hold=false,holdLoad=false,holdSave=false,loadWaiters=[],saveWaiters=[],waiters=[],authCalls=0,callbacks=[],expiry=false; const saves=[],posts=[],prints=[],timers=new Map();let timer=0;
 w.setTimeout=(fn,ms)=>{const id=++timer;if(ms===1000)timers.set(id,fn);else if(ms===0)queueMicrotask(fn);return id};w.clearTimeout=id=>timers.delete(id);
 w.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>callbacks.push(f)}},getVerifiedUser:async()=>{authCalls++;const u=actor;if(hold)await new Promise((r,j)=>waiters.push([r,j]));return u},getSession:async()=>{if(holdSession)await new Promise(r=>sessionWaiters.push(r));return{user:actor,expires_at:Date.now()/1000+(expiry?-1:3600)}},loadLesson:async(_,id)=>{if(holdLoad)await new Promise(r=>loadWaiters.push(r));return{user:id===A.id?A:B,profile:{first_name:'Private A'},answers:[{question_number:1,answer:'PRIVATE ANSWER'}]}},saveLesson:async p=>{saves.push(p);if(holdSave)await new Promise(r=>saveWaiters.push(r));return{saved:true}}};
 w.fetch=async(url,options)=>{posts.push({url,body:options?.body});return{ok:true}};w.print=()=>prints.push(d.querySelector('[name=q1]')?.value);w.confirm=()=>true;
 d.querySelector('.grip-course-form').reportValidity=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.eval(read('assets/js/grip-course.js'));await flush();
 const form=d.querySelector('.grip-course-form'),button=d.querySelector('[data-grip-print]'),input=form.querySelector('[name=q1]');
 assert.equal(input.value,'PRIVATE ANSWER');
 return{w,d,form,button,input,saves,posts,prints,dom,dispose:async()=>{form.remove();await flush();assert.deepEqual(errors,[]);dom.window.close()},authCalls:()=>authCalls,holdLoad:()=>holdLoad=true,pendingLoad:()=>loadWaiters.length,releaseLoad:()=>{holdLoad=false;for(const r of loadWaiters.splice(0))r()},holdSave:()=>holdSave=true,pendingSave:()=>saveWaiters.length,releaseSave:()=>{holdSave=false;for(const r of saveWaiters.splice(0))r()},hold:()=>{hold=true},pending:()=>waiters.length,release:()=>{hold=false;for(const [r] of waiters.splice(0))r()},runSave:async()=>{for(const [id,fn]of[...timers]){timers.delete(id);await fn()}await flush()},switchTo:(u,notify=true)=>{actor=u==='B'?B:u==='A'?A:null;if(notify)callbacks.forEach(f=>f(actor?'SIGNED_IN':'SIGNED_OUT',{user:actor}))},expire:()=>expiry=true,releaseAt:(i,fail=false)=>{const [r,j]=waiters.splice(i,1)[0];fail?j(Error('Unavailable')):r()},holdSession:()=>holdSession=true,pendingSession:()=>sessionWaiters.length,releaseSession:()=>{holdSession=false;for(const r of sessionWaiters.splice(0))r()},anonymous:()=>actor={...A,is_anonymous:true},actor:()=>actor,storage:()=>w.localStorage.getItem(`championlife-grip-v2:${A.id}:getting-a-grip-on-the-basics:lesson:${lesson}`)};
}


for (const lesson of [1,2,3,4]) {
 test(`lesson ${lesson} verified blank draft survives reload with restored status`,async()=>{const f=await fixture(lesson);try{
  for(const name of ['q1','first-name','email'])f.form.elements.namedItem(name).value='';
  f.input.dispatchEvent(new f.w.Event('input',{bubbles:true}));await flush();
  const prior=f.storage();assert.equal(JSON.parse(prior).values.q1,'');
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow'));await flush();
  for(const name of ['q1','first-name','email'])assert.equal(f.form.elements.namedItem(name).value,'');
  assert.match(f.d.querySelector('[data-grip-save-status]').textContent,/Draft restored/);
  assert.equal(f.storage(),prior);assert.equal(f.saves.length,0);assert.equal(f.posts.length,0);
 }finally{await f.dispose()}});
 test(`lesson ${lesson} unavailable device deletion preserves displayed and stored answers`,async()=>{const f=await fixture(lesson);try{
  f.input.value='PRIVATE LOCAL DRAFT';f.input.dispatchEvent(new f.w.Event('input',{bubbles:true}));await flush();
  const prior=f.storage();f.w.Storage.prototype.removeItem=()=>{throw Error('storage blocked')};f.d.querySelector('[data-grip-clear]').click();await flush();
  assert.equal(f.storage(),prior);assert.equal(f.input.value,'PRIVATE LOCAL DRAFT');assert.equal(f.input.disabled,false);
  assert.match(f.d.querySelector('[data-grip-save-status]').textContent,/could not be cleared/);
  await f.runSave();assert.equal(f.saves.length,0);assert.equal(f.posts.length,0);
 }finally{await f.dispose()}});
}
for(const mode of ['partial','wrong-owner','wrong-course','wrong-lesson','invalid-value','malformed'])test(`reload ${mode} draft retains only owned valid fields and cloud fallback`,async()=>{const f=await fixture();try{
 const key='championlife-grip-v2:'+f.actor().id+':getting-a-grip-on-the-basics:lesson:1';
 const payload={owner:f.actor().id,course:'getting-a-grip-on-the-basics',lesson:'1',savedAt:new Date().toISOString(),values:{q2:'',q1:'LOCAL'}};
 if(mode==='partial')delete payload.values.q1;
 if(mode==='wrong-owner')payload.owner='other';if(mode==='wrong-course')payload.course='other';if(mode==='wrong-lesson')payload.lesson='2';if(mode==='invalid-value')payload.values.q1={private:'not a string'};
 f.w.localStorage.setItem(key,mode==='malformed'?'{':JSON.stringify(payload));
 f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow'));await flush();
 assert.equal(f.input.value,'PRIVATE ANSWER');assert.equal(f.input.disabled,false);assert.equal(f.saves.length,0);assert.equal(f.posts.length,0);
}finally{await f.dispose()}});
test('restored blank from A is not restored for verified B',async()=>{const f=await fixture();try{
 f.input.value='';f.input.dispatchEvent(new f.w.Event('input',{bubbles:true}));await flush();const prior=f.storage();f.switchTo('B');await flush();
 assert.equal(f.input.value,'PRIVATE ANSWER');assert.equal(f.storage(),prior);assert.match(f.d.querySelector('[data-grip-save-status]').textContent,/worksheet is ready/);
}finally{await f.dispose()}});
test('successful clear still removes device draft and reload uses existing cloud answer',async()=>{const f=await fixture();try{
 f.input.value='LOCAL';f.input.dispatchEvent(new f.w.Event('input',{bubbles:true}));await flush();f.d.querySelector('[data-grip-clear]').click();await flush();assert.equal(f.storage(),null);assert.equal(f.input.value,'');
 f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow'));await flush();assert.equal(f.input.value,'PRIVATE ANSWER');assert.equal(f.saves.length,0);
}finally{await f.dispose()}});

test('restored draft without usable timestamp reports device restoration truthfully',async()=>{const f=await fixture();try{
 const key='championlife-grip-v2:'+f.actor().id+':getting-a-grip-on-the-basics:lesson:1';
 f.w.localStorage.setItem(key,JSON.stringify({owner:f.actor().id,course:'getting-a-grip-on-the-basics',lesson:'1',values:{q1:''}}));
 f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow'));await flush();assert.equal(f.input.value,'');assert.equal(f.d.querySelector('[data-grip-save-status]').textContent,'Draft restored on this device');
}finally{await f.dispose()}});

test('successful clear does not claim nonexistent cloud answers',async()=>{const f=await fixture();try{
 f.w.ChampionLifeAuth.loadLesson=async()=>({user:f.actor(),answers:[],profile:{}});f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow'));await flush();assert.equal(f.input.value,'');
 f.input.value='DEVICE ONLY';f.input.dispatchEvent(new f.w.Event('input',{bubbles:true}));await flush();f.d.querySelector('[data-grip-clear]').click();await flush();
 assert.equal(f.storage(),null);assert.equal(f.input.value,'');assert.equal(f.saves.length,0);assert.equal(f.d.querySelector('[data-grip-save-status]').textContent,'Device draft cleared. Any cloud-saved answers remain unchanged.');
}finally{await f.dispose()}});

// Cycle23: submission uncertainty never proves a device copy or invites retry.
const unconfirmedSubmission='We could not confirm this lesson submission. Keep this page open to preserve your current answers; they may not be saved on this device.';
for(const lesson of[1,2,3,4])for(const mode of['quota-http','quota-unknown','older-copy-unknown','saved-unknown','quota-success'])test(`lesson ${lesson} ${mode} submission reports only established outcome`,async()=>{const f=await fixture(lesson);try{
 if(mode==='older-copy-unknown')f.w.localStorage.setItem('championlife-grip-v2:'+f.actor().id+':getting-a-grip-on-the-basics:lesson:'+lesson,JSON.stringify({owner:f.actor().id,course:'getting-a-grip-on-the-basics',lesson:String(lesson),values:{q1:'OLDER SAVED COPY'}}));
 const previous=f.storage();f.input.value='CURRENT PRIVATE ANSWER';
 if(mode.startsWith('quota')||mode==='older-copy-unknown')f.w.Storage.prototype.setItem=()=>{throw new f.w.DOMException('fictional quota denial','QuotaExceededError')};
 f.w.fetch=async(url,options)=>{f.posts.push({url,body:options.body});if(mode.endsWith('unknown'))throw new f.w.TypeError('fictional response lost after dispatch');return{ok:mode==='quota-success'}};
 f.form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal(f.posts.length,1);assert.equal(f.input.value,'CURRENT PRIVATE ANSWER');assert.equal(f.form.querySelector('[type=submit]').disabled,false);
 if(mode==='quota-success'){
  assert.equal(f.saves.length,1);assert.equal(f.saves[0].expectedUserId,f.actor().id);assert.match(f.d.querySelector('[data-grip-form-message]').textContent,/has been submitted and saved/);assert.equal(f.storage(),null);
 }else{
  assert.equal(f.saves.length,0);assert.equal(f.d.querySelector('[data-grip-form-message]').textContent,unconfirmedSubmission);
  assert.equal(f.d.querySelector('.grip-form-card').classList.contains('completed'),false);
  if(mode==='saved-unknown')assert.equal(JSON.parse(f.storage()).values.q1,'CURRENT PRIVATE ANSWER');else assert.equal(f.storage(),previous);
  await f.runSave();assert.equal(f.posts.length,1);assert.equal(f.saves.length,0);
 }
}finally{await f.dispose()}});
for(const transition of['account','logout','pagehide','removed-form'])test(`late submission rejection after ${transition} cannot publish old outcome or retry`,async()=>{const f=await fixture();try{
 let reject;f.w.fetch=async(url,options)=>{f.posts.push({url,body:options.body});return new Promise((_,fail)=>reject=fail)};
 f.input.value='PRIVATE A';f.form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(f.posts.length,1);
 if(transition==='account')f.switchTo('B');if(transition==='logout')f.switchTo(null);if(transition==='pagehide')f.w.dispatchEvent(new f.w.PageTransitionEvent('pagehide'));if(transition==='removed-form')f.form.remove();
 await flush();reject(new f.w.TypeError('fictional lost reply'));await flush();
 assert.notEqual(f.d.querySelector('[data-grip-form-message]')?.textContent,unconfirmedSubmission);assert.equal(f.posts.length,1);assert.equal(f.saves.length,0);
}finally{await f.dispose()}});
test('identity replacement before dispatch creates no POST or submission outcome',async()=>{const f=await fixture();try{
 f.hold();f.form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(f.pending(),1);f.switchTo('B',false);f.release();await flush();
 assert.equal(f.posts.length,0);assert.equal(f.saves.length,0);assert.equal(f.d.querySelector('[data-grip-form-message]').textContent,'');assert.equal(f.input.value,'');
}finally{await f.dispose()}});
