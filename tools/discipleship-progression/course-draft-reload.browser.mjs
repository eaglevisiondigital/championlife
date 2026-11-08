// Actual lesson/runtime; fictional Auth and intercepted local transport. Never sends.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),server=http.createServer((q,r)=>{const f=path.join(root,new URL(q.url,'http://localhost').pathname);try{let b=fs.readFileSync(f);if(f.endsWith('.html'))b=Buffer.from(b.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));r.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream');r.end(b)}catch{r.statusCode=404;r.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label)};
try{for(const[name,engine]of[['chromium',chromium],['webkit',webkit]])for(const width of[390,1440]){const browser=await engine.launch({headless:true});try{
 for(const lesson of [1,2,3,4]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await page.addInitScript(()=>{if(window!==window.top)return;
 const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01'};const saves=[],posts=[];window.testDraft={saves,posts};
 window.ChampionLifeAuth={client:{auth:{onAuthStateChange:()=>{}}},getVerifiedUser:async()=>user,getSession:async()=>({user,expires_at:Date.now()/1000+3600}),loadLesson:async()=>({user,answers:[{question_number:1,answer:'CLOUD ORIGINAL'}],profile:{first_name:'Cloud name'}}),saveLesson:async x=>{saves.push(x);return{saved:true}}};window.fetch=async(url,options)=>{posts.push({url,body:options?.body});return{ok:true}};window.confirm=()=>true;
 });const boot=async()=>{await page.goto(origin+'/getting-a-grip-'+lesson+'.html');await page.addScriptTag({url:origin+'/assets/js/grip-course.js'});await page.waitForFunction(()=>!document.querySelector('[name=q1]').disabled)};
 await boot();ok(await page.inputValue('[name=q1]')==='CLOUD ORIGINAL',`${name}/${width}/${lesson} original cloud loaded`);
 await page.evaluate(()=>{const input=document.querySelector('[name=q1]');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForFunction(()=>document.querySelector('[data-grip-save-status]').textContent.startsWith('Saved locally'));
 await boot();ok(await page.inputValue('[name=q1]')==='',`${name}/${width}/${lesson} blank saved answer survives actual navigation`);ok((await page.textContent('[data-grip-save-status]')).startsWith('Draft restored'),`${name}/${width}/${lesson} restoration status truthful`);
 await page.evaluate(()=>{const input=document.querySelector('[name=q1]');input.value='LOCAL PRIVATE';input.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForFunction(()=>document.querySelector('[data-grip-save-status]').textContent.startsWith('Saved locally'));const prior=await page.evaluate(()=>JSON.stringify(localStorage));
 await page.evaluate(()=>{window.originalRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=()=>{throw Error('blocked')};document.querySelector('[data-grip-clear]').click()});await page.waitForFunction(()=>document.querySelector('[data-grip-save-status]').textContent.includes('could not be cleared'));
 ok(await page.inputValue('[name=q1]')==='LOCAL PRIVATE',`${name}/${width}/${lesson} deletion error retains display`);ok(await page.evaluate(()=>JSON.stringify(localStorage))===prior,`${name}/${width}/${lesson} deletion error retains draft`);
 await page.evaluate(()=>{Storage.prototype.removeItem=originalRemove;document.querySelector('[data-grip-clear]').click()});await page.waitForFunction(()=>document.querySelector('[data-grip-save-status]').textContent==='Device draft cleared. Any cloud-saved answers remain unchanged.');
 ok(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('championlife-grip-v2:')).length)===0,`${name}/${width}/${lesson} successful retry clears device draft`);await boot();ok(await page.inputValue('[name=q1]')==='CLOUD ORIGINAL',`${name}/${width}/${lesson} successful clear reload uses cloud`);
 ok(await page.evaluate(()=>testDraft.posts.length===0&&testDraft.saves.length===0),`${name}/${width}/${lesson} reload creates no cloud or submission write`);ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${width}/${lesson} responsive layout unchanged`);ok(errors.length===0,`${name}/${width}/${lesson} no page errors`);await page.close();
 }
 }finally{await browser.close()}}}finally{await new Promise(r=>server.close(r))}console.log(JSON.stringify({checks,genuineAuth:false,hostedWrites:0}));

// Cycle23 appends new cases without changing the accepted reload/clear checks.
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(new URL(origin).port),'127.0.0.1',resolve)});
const beforeSubmissionChecks=checks;
try{for(const[name,engine]of[['chromium',chromium],['webkit',webkit]])for(const width of[390,1440]){const browser=await engine.launch({headless:true});try{
 for(const lesson of[1,2,3,4])for(const mode of['http-denial','unknown-transport','positive-cloud-fallback','replaced-account']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  await page.addInitScript(({mode})=>{if(window!==window.top)return;
   const A={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01'},B={...A,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'};
   let actor=A;const callbacks=[],posts=[],saves=[];window.testSubmission={posts,saves,switchAccount:()=>{actor=B;callbacks.forEach(f=>f('SIGNED_IN',{user:B}))}};
   window.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>callbacks.push(f)}},getVerifiedUser:async()=>actor,getSession:async()=>({user:actor,expires_at:Date.now()/1000+3600}),loadLesson:async()=>({user:actor,answers:[],profile:{}}),saveLesson:async x=>{saves.push(x);return{saved:true}}};
   Storage.prototype.setItem=()=>{throw new DOMException('fictional quota denial','QuotaExceededError')};
   window.fetch=async(url,options)=>{posts.push({url,body:options?.body});if(mode==='replaced-account')return new Promise((_,reject)=>testSubmission.reject=reject);if(mode==='unknown-transport')throw new TypeError('fictional response lost after dispatch');return{ok:mode==='positive-cloud-fallback'}};
  },{mode});
  await page.goto(origin+'/getting-a-grip-'+lesson+'.html');await page.addScriptTag({url:origin+'/assets/js/grip-course.js'});await page.waitForFunction(()=>!document.querySelector('[name=q1]').disabled);
  await page.evaluate(()=>{const form=document.querySelector('.grip-course-form');form.reportValidity=()=>true;form.querySelector('[name=q1]').value='PRIVATE CURRENT ANSWER';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
  await page.waitForFunction(()=>testSubmission.posts.length===1);
  const tag=`${name}/${width}/${lesson}/${mode}`;
  if(mode==='replaced-account'){
   await page.evaluate(()=>{testSubmission.switchAccount();testSubmission.reject(new TypeError('fictional lost reply'))});await page.waitForFunction(()=>document.querySelector('[name=learner-id]').value==='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
   ok(await page.inputValue('[name=q1]')==='',tag+' old private values clear');ok(await page.textContent('[data-grip-form-message]')==='',tag+' late rejection publishes no prior outcome');
  }else{
   await page.waitForFunction(()=>document.querySelector('[data-grip-form-message]').textContent.length>0);
   const text=await page.textContent('[data-grip-form-message]');
   ok(mode==='positive-cloud-fallback'?/has been submitted and saved/.test(text):text==='We could not confirm this lesson submission. Keep this page open to preserve your current answers; they may not be saved on this device.',tag+' truthful result');
   ok(await page.inputValue('[name=q1]')==='PRIVATE CURRENT ANSWER',tag+' current answers retained');
  }
  ok(await page.evaluate(()=>testSubmission.posts.length)===1,tag+' one dispatched POST, no automatic retry');
  ok(await page.evaluate(()=>testSubmission.saves.length)===(mode==='positive-cloud-fallback'?1:0),tag+' cloud fallback unchanged');
  ok(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('championlife-grip-v2:')).length)===0,tag+' device storage denial recorded');
  ok(await page.isEnabled('.grip-course-form [type=submit]'),tag+' legitimate current editing remains enabled');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tag+' responsive layout unchanged');
  ok(errors.length===0,tag+' no page errors');await page.close();
 }
}finally{await browser.close()}}}finally{await new Promise(r=>server.close(r))}
console.log(JSON.stringify({checks,submissionChecks:checks-beforeSubmissionChecks,genuineAuth:false,hostedWrites:0}));
