// Actual lesson HTML and worksheet runtime, fictional Auth/RPC only. No hosted traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://worksheet-retirement.test',reproduce=process.env.REPRODUCE_RETIREMENT==='1';
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label)};
for(const [name,type] of [['chromium',chromium],['webkit',webkit]])for(const width of [390,1440]){
 const browser=await type.launch({headless:true,...(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{})});
 try{const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.fulfill({status:200,body:''});try{let data=fs.readFileSync(path.join(root,url.pathname));if(url.pathname.endsWith('.html'))data=Buffer.from(data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));return route.fulfill({body:data,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(url.pathname)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}});
 await page.addInitScript(()=>{
 if(window.top!==window||!/^\/getting-a-grip-\d+\.html$/.test(location.pathname))return;
 const id='11111111-1111-4111-8111-111111111111',user={id,email:'fictional@example.test',email_confirmed_at:'2026-01-01'},session={user,access_token:'fictional',expires_at:Date.now()/1000+600};
 let callbacks=[],calls=[],hold=false,release,authCalls=0;const lesson=Number(location.pathname.match(/(\d+)\.html/)[1]),required=({5:10,6:7,7:7,8:6,9:5,10:5,11:4,12:3,13:4})[lesson];
 window.testWorksheet={calls,hold:()=>hold=true,release:()=>release?.(),authCalls:()=>authCalls,logout:()=>callbacks.forEach(f=>f('SIGNED_OUT',null)),retain:()=>{const r=document.querySelector('[data-grip-worksheet]');window.retained={root:r,form:r.querySelector('form'),fields:r.querySelector('fieldset'),load:r.querySelector('[data-worksheet-load]'),answer:r.querySelector('[data-worksheet-answer]'),status:r.querySelector('[data-worksheet-status]')}}};
 window.ChampionLifeAuth={client:{supabaseUrl:'https://fictional.invalid',rest:{},auth:{getSession:async()=>{authCalls++;return{data:{session}}},getUser:async()=>{authCalls++;return{data:{user}}},onAuthStateChange:f=>callbacks.push(f)},rpc:(name,args)=>{if(name!=='owned_worksheet_transaction')throw Error('Unexpected RPC');calls.push(args);const response={data:{status:'available',course:'getting-a-grip-on-the-basics',lesson,worksheet:`lesson-${lesson}-workbook-sections-v1`,revision:'33333333-3333-4333-8333-333333333333',requiredQuestions:required,savedNonblankAnswers:1,allRequiredAnswersSaved:false,answers:[{question:1,answer:args.p_answers?.[0].answer||'PRIVATE RESPONSE'}],canComplete:false,canCommit:false}};const q={setHeader(){return q},retry(value){if(value!==false)throw Error('retry enabled');return q},abortSignal(){return q},then(resolve,reject){return(hold?new Promise(r=>{release=()=>r(response)}):Promise.resolve(response)).then(resolve,reject)}};return q}}};
 });
 const boot=async lesson=>{await page.goto(origin+`/getting-a-grip-${lesson}.html`);await page.addScriptTag({url:origin+'/assets/js/grip-worksheet.js'});await page.locator('[data-worksheet-load]').click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-answer]').value==='PRIVATE RESPONSE');await page.evaluate(()=>testWorksheet.retain())};
 const state=()=>page.evaluate(()=>({value:retained.answer.value,defaultValue:retained.answer.defaultValue,disabled:retained.fields.disabled,loadDisabled:retained.load.disabled,calls:testWorksheet.calls.length,auth:testWorksheet.authCalls(),status:retained.status.textContent}));
 await boot(5);await page.evaluate(()=>{retained.root.remove();retained.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});await page.waitForTimeout(30);
 if(reproduce){ok((await state()).calls===2,name+'/'+width+' original detached form issues additional mutation');ok((await state()).value==='PRIVATE RESPONSE',name+'/'+width+' original removed root retains protected response');continue}
 ok((await state()).calls===1&&(await state()).value===''&&(await state()).disabled,name+'/'+width+' synchronous detached submit denied and private response cleared');
 for(let lesson=5;lesson<=13;lesson++){
  await boot(lesson);const before=await state();await page.evaluate(()=>retained.root.remove());await page.waitForFunction(()=>retained.answer.value==='');
  ok((await state()).disabled&&(await state()).loadDisabled&&(await state()).defaultValue==='',name+'/'+width+' lesson'+lesson+' removal retires private controls');
  await page.evaluate(()=>{document.querySelector('main').append(retained.root);retained.load.click();retained.form.dispatchEvent(new Event('submit',{cancelable:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))});await page.waitForTimeout(20);
  ok((await state()).calls===before.calls&&(await state()).auth===before.auth&&(await state()).disabled,name+'/'+width+' lesson'+lesson+' reattached stale controls remain terminally retired');
 }
 for(const mode of ['form','fields','answer','load','status']){
  await boot(8);await page.evaluate(mode=>{retained[mode].remove();retained.form.dispatchEvent(new Event('submit',{cancelable:true}))},mode);await page.waitForTimeout(20);
  ok((await state()).calls===1&&(await state()).value===''&&(await state()).disabled,name+'/'+width+' removed '+mode+' cannot retain authority');
 }
 for(const write of [false,true]){
  await boot(13);await page.evaluate(write=>{testWorksheet.hold();if(write)retained.form.dispatchEvent(new Event('submit',{cancelable:true}));else retained.load.click()},write);await page.waitForFunction(()=>testWorksheet.calls.length===2);await page.evaluate(()=>{retained.root.remove();testWorksheet.release()});await page.waitForTimeout(30);
  ok((await state()).value===''&&(await state()).disabled&&(await state()).calls===2,name+'/'+width+' delayed '+(write?'save':'load')+' cannot populate removed controls');
 }
 await boot(9);await page.locator('[data-worksheet-answer="1"]').fill('LEGITIMATE UPDATE');await page.locator('[data-worksheet-form]').evaluate(f=>f.dispatchEvent(new Event('submit',{cancelable:true})));await page.waitForFunction(()=>retained.status.textContent.startsWith('Saved'));
 ok((await state()).value==='LEGITIMATE UPDATE'&&(await state()).calls===2,name+'/'+width+' attached authorized save still succeeds');
 await page.evaluate(()=>{document.querySelector('footer').append(document.createElement('span'));retained.answer.setAttribute('data-test','unrelated')});await page.waitForTimeout(20);
 ok(!(await state()).disabled,name+'/'+width+' unrelated DOM changes preserve usable worksheet');
 await page.evaluate(()=>testWorksheet.logout());ok((await state()).value===''&&(await state()).disabled,name+'/'+width+' Auth retirement still clears');
 if(errors.length)console.error(JSON.stringify({name,width,errors}));ok(errors.length===0,name+'/'+width+' no page errors');
 }finally{await browser.close()}
}
console.log(JSON.stringify({checks,reproduce,hostedAcceptance:false}));
