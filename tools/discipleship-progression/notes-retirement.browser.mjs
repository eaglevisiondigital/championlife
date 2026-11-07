// Independent Cycle17: actual lesson/runtime, fictional Auth, all HTTP intercepted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const source=fileURLToPath(new URL('../../',import.meta.url));
const runtime=readFileSync(source+'/assets/js/grip-notes.js','utf8');
const html=readFileSync(source+'/getting-a-grip-5.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const stage of['verify','session'])for(const removal of['field','wrapper','extracted']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://notes.example.test/getting-a-grip-5.html'?r.fulfill({body:html,contentType:'text/html'}):r.fulfill({status:204,body:''}));
  await page.addInitScript(()=>{
   const actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'fictional@example.test',email_confirmed_at:'2026-01-01'},key='championlife-grip-notes-v1:'+actor.id+':getting-a-grip-on-the-basics:lesson:5';
   let stage='',callbacks=[],calls=0;
   const hold=async kind=>{calls++;if(stage===kind){stage='';await new Promise(r=>window.resumeNotes=r)}};
   window.notesProbe={arm:s=>stage=s,key,actor,get calls(){return calls},callbacks,events:[]};for(const type of ['pageshow','pagehide','visibilitychange','storage'])addEventListener(type,()=>notesProbe.events.push({type,visibility:document.visibilityState}));
   window.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>callbacks.push(f)}},getVerifiedUser:async()=>{await hold('verify');return actor},getSession:async()=>{await hold('session');return{user:actor,expires_at:Date.now()/1000+600}}};
   localStorage.setItem(key,JSON.stringify({owner:actor.id,course:'getting-a-grip-on-the-basics',lesson:5,notes:'PRESERVED'}));localStorage.setItem('legacy-notes','UNOWNED');
  });
  await page.goto('https://notes.example.test/getting-a-grip-5.html');await page.addScriptTag({content:runtime});
  await page.waitForFunction(()=>document.querySelector('.note-box').value==='PRESERVED');
  await page.evaluate(()=>{const f=document.querySelector('.note-box');f.value='PRESERVED CURRENT';f.dispatchEvent(new Event('input'))});
  try { await page.waitForFunction(()=>JSON.parse(localStorage.getItem(notesProbe.key)).notes==='PRESERVED CURRENT'); } catch(error) { console.log('CURRENT_SAVE_DIAGNOSTIC '+JSON.stringify(await page.evaluate(()=>({value:document.querySelector('.note-box').value,disabled:document.querySelector('.note-box').disabled,status:document.querySelector('[data-grip-notes-status]').textContent,stored:localStorage.getItem(notesProbe.key),calls:notesProbe.calls,visibility:document.visibilityState,events:notesProbe.events}))));throw error; }
  eq(true,true,engine+'/'+stage+'/'+removal+' connected current save remains usable');
  await page.evaluate(stage=>{notesProbe.arm(stage);const f=document.querySelector('.note-box');f.value='RETIRED PRIVATE';f.dispatchEvent(new Event('input'))},stage);
  await page.waitForFunction(()=>typeof resumeNotes==='function');
  await page.evaluate(removal=>{
   window.oldNotes=document.querySelector('.note-box');window.oldStatus=document.querySelector('[data-grip-notes-status]');const wrapper=oldNotes.closest('.grip-notes-wrap');
   const node=removal==='field'?oldNotes:wrapper,parent=node.parentNode,next=node.nextSibling;node.remove();
   if(removal==='extracted'){parent.insertBefore(oldNotes,next);parent.insertBefore(wrapper,next);wrapper.append(oldNotes)}else parent.insertBefore(node,next);
   resumeNotes();
  },removal);
  await page.waitForFunction(()=>oldNotes.disabled||JSON.parse(localStorage.getItem(notesProbe.key)).notes==='RETIRED PRIVATE');
  const result=await page.evaluate(()=>({stored:JSON.parse(localStorage.getItem(notesProbe.key)).notes,value:oldNotes.value,disabled:oldNotes.disabled,status:oldStatus.textContent}));
  const label=engine+'/'+stage+'/'+removal;
   eq(result.stored,'PRESERVED CURRENT',label+' existing record preserved');eq(result.value,'',label+' private field cleared');eq(result.disabled,true,label+' permanently retired field disabled');eq(result.status.includes('Saved on this device'),false,label+' no stale save claim');
   const after=await page.evaluate(async()=>{const count=notesProbe.calls;dispatchEvent(new Event('pageshow'));notesProbe.callbacks.forEach(f=>f('SIGNED_IN',{user:notesProbe.actor}));await new Promise(r=>setTimeout(r,20));oldNotes.value='RETAINED HANDLER';oldNotes.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,20));return{addedCalls:notesProbe.calls-count,stored:JSON.parse(localStorage.getItem(notesProbe.key)).notes,value:oldNotes.value,legacy:localStorage.getItem('legacy-notes')}});
   eq(after.addedCalls,0,label+' retired callbacks cannot restart Auth');eq(after.stored,'PRESERVED CURRENT',label+' retained input cannot persist');eq(after.value,'',label+' retained input is cleared');eq(after.legacy,'UNOWNED',label+' unowned records preserved');
  eq(errors,[],label+' no page errors');await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({checks,source,runtimeSHA256:createHash('sha256').update(runtime).digest('hex'),genuineAuth:false,cloudWrites:0}));
