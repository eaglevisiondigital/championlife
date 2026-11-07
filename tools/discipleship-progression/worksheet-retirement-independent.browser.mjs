// Independently authored control-lifetime attacks. Actual lesson HTML/runtime;
// explicit fictional Auth/RPC only, with no genuine provider acceptance claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const root=new URL('../../',import.meta.url),runtime=readFileSync(new URL('assets/js/grip-worksheet.js',root),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex'),origin='https://independent-worksheet.invalid';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,browserType,width]of[['chromium',chromium,390],['webkit',webkit,1440]]){
 const browser=await browserType.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  async function setup(){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[],network=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin){network.push(u.href);return route.abort()}if(u.pathname==='/lesson'){const html=readFileSync(new URL('getting-a-grip-13.html',root),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,'');return route.fulfill({body:html,contentType:'text/html'})}return route.fulfill({body:'',contentType:'text/plain'})});
   await page.goto(origin+'/lesson');
   await page.evaluate(()=>{
    const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];let actor=0,holdRPC=false,holdAuth=false,resolveRPC,resolveAuth;const callbacks=[];
    const session=()=>({user:{id:ids[actor],email:`actor${actor}@example.test`,email_confirmed_at:'2026-01-01'},access_token:'fictional-'+actor,expires_at:Date.now()/1000+600});
    const state=window.harness={calls:[],authCalls:0,holdRPC:()=>holdRPC=true,holdAuth:()=>holdAuth=true,releaseRPC:()=>resolveRPC?.(),releaseAuth:()=>resolveAuth?.(),switchActor:()=>actor=1,logout:()=>callbacks.forEach(f=>f('SIGNED_OUT',null))};
    const client={supabaseUrl:'https://fictional.invalid',rest:{},auth:{getSession:async()=>{state.authCalls++;if(holdAuth){holdAuth=false;await new Promise(r=>resolveAuth=r)}return{data:{session:session()}}},getUser:async()=>({data:{user:session().user}}),onAuthStateChange:f=>callbacks.push(f)},rpc:(name,args)=>{if(name!=='owned_worksheet_transaction')throw Error('Unexpected mutation');state.calls.push(structuredClone(args));const response={data:{status:'available',course:'getting-a-grip-on-the-basics',lesson:13,worksheet:'lesson-13-workbook-sections-v1',revision:'33333333-3333-4333-8333-333333333333',requiredQuestions:4,savedNonblankAnswers:1,allRequiredAnswersSaved:false,answers:[{question:1,answer:args.p_answers?.[0].answer||'PRIVATE_ACTOR_ZERO'}],canComplete:false,canCommit:false}};const q={setHeader(){return q},retry(v){if(v!==false)throw Error('Unsafe retry');return q},abortSignal(){return q},then(resolve,reject){if(!holdRPC)return Promise.resolve(response).then(resolve,reject);holdRPC=false;return new Promise(r=>resolveRPC=()=>r(response)).then(resolve,reject)}};return q}};
    window.ChampionLifeAuth={client};
   });
   await page.addScriptTag({content:runtime});await page.locator('[data-worksheet-load]').click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-answer]').value==='PRIVATE_ACTOR_ZERO');
   await page.evaluate(()=>{const root=document.querySelector('[data-grip-worksheet]');window.retained={root,form:root.querySelector('form'),fields:root.querySelector('fieldset'),status:root.querySelector('[data-worksheet-status]'),load:root.querySelector('[data-worksheet-load]'),answer:root.querySelector('[data-worksheet-answer]')}});
   return{page,errors,network};
  }
  const state=page=>page.evaluate(()=>({value:retained.answer.value,defaultValue:retained.answer.defaultValue,disabled:retained.fields.disabled,loadDisabled:retained.load.disabled,count:harness.calls.length,writes:harness.calls.filter(c=>c.p_answers!==null).length,status:retained.status.textContent,auth:harness.authCalls}));
  for(const target of['root','form','fields','answer','status','load']){
   const{page,errors}=await setup();await page.evaluate(target=>{const old=retained[target],clone=old.cloneNode(true);old.replaceWith(clone);retained.form.dispatchEvent(new Event('submit',{cancelable:true}));retained.load.dispatchEvent(new Event('click'));},target);await page.waitForTimeout(30);const s=await state(page);
   eq(s.value,'',engine+' replacement '+target+' clears retained secret');eq(s.writes,0,engine+' replacement '+target+' never writes');eq(s.count,1,engine+' replacement '+target+' never reads again');eq(s.disabled&&s.loadDisabled,true,engine+' replacement '+target+' disables old controls');eq(errors,[],engine+' replacement '+target+' no runtime exception');await page.close();
  }
  {const{page,errors}=await setup();await page.evaluate(()=>{const parent=retained.root.parentNode;retained.root.remove();parent.append(retained.root);retained.form.dispatchEvent(new Event('submit',{cancelable:true}));retained.load.dispatchEvent(new Event('click'))});await page.waitForTimeout(30);eq((await state(page)).count,1,engine+' same-task reattachment cannot race observer into RPC');eq((await state(page)).value,'',engine+' same-task reattachment clears');eq(errors,[],engine+' reattachment no error');await page.close()}
  for(const stage of['auth','read','write']){
   const{page,errors}=await setup();await page.evaluate(stage=>{if(stage==='auth')harness.holdAuth();else harness.holdRPC();if(stage==='write')retained.form.dispatchEvent(new Event('submit',{cancelable:true}));else retained.load.click()},stage);
   if(stage!=='auth')await page.waitForFunction(()=>harness.calls.length===2);await page.evaluate(()=>{retained.root.remove();harness.releaseAuth();harness.releaseRPC()});await page.waitForTimeout(50);const s=await state(page);
   eq(s.value,'',engine+' pending '+stage+' cannot restore');eq(s.disabled,true,engine+' pending '+stage+' remains disabled');eq(s.count,stage==='auth'?1:2,engine+' pending '+stage+' no new requests after removal');eq(s.writes,stage==='write'?1:0,engine+' pending '+stage+' distinguishes pre-retirement submitted write');eq(errors,[],engine+' pending '+stage+' no errors');await page.close();
  }
  {const{page,errors}=await setup();await page.evaluate(()=>{retained.answer.value='LEGITIMATE_PRIVATE_SAVE';retained.form.dispatchEvent(new Event('input',{bubbles:true}));document.body.append(document.createElement('aside'));retained.form.dispatchEvent(new Event('submit',{cancelable:true}))});await page.waitForFunction(()=>retained.status.textContent.startsWith('Saved'));eq((await state(page)).writes,1,engine+' attached valid save preserved');eq((await state(page)).value,'LEGITIMATE_PRIVATE_SAVE',engine+' attached answer returned');eq((await state(page)).status.includes('does not certify watching or lesson completion'),true,engine+' no certified-completion claim');await page.evaluate(()=>{harness.switchActor();retained.form.dispatchEvent(new Event('submit',{cancelable:true}))});await page.waitForTimeout(30);eq((await state(page)).writes,1,engine+' silent account switch blocks old binding mutation');eq((await state(page)).value,'',engine+' silent account switch clears');eq(errors,[],engine+' attached/account transitions no errors');await page.close()}
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,runtimeSHA256:sha(runtime),hostedAcceptance:false,completionAuthorized:false}));
