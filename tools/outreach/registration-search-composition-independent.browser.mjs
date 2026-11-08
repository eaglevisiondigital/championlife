// Independent local intercepted-browser review. No provider/host acceptance.
import assert from 'node:assert/strict';
import {beforeRegistrationRetirement} from './registration-control-retirement-contract.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const repo=process.env.REVIEW_ROOT?pathToFileURL(process.env.REVIEW_ROOT+'/'):new URL('../../',import.meta.url);
const {chromium,webkit}=await import(new URL('tools/backend-tests/node_modules/playwright/index.mjs',repo));
const {response,campaign,user}=await import(new URL('tools/backend-tests/fixtures/outreach-registration-ui.mjs',repo));
const source=n=>readFileSync(new URL('assets/js/'+n,repo),'utf8');
const runtime=source('outreach-registration-staff.js');
const base=execFileSync('git',['show','9f78e195115f55135d763e1e5373a494e817423b:assets/js/outreach-registration-staff.js'],{cwd:repo,encoding:'utf8'});
const accepted=execFileSync('git',['show','4f64fa14f03098e31ee8111c8ff1810fbc260542:assets/js/outreach-registration-staff.js'],{cwd:repo,encoding:'utf8'});
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const changes=[['function deny(status){',"search='';"],["if(g!==generation)return;user=nextUser;","if(g!==generation)return;if(nextUser?.id!==user?.id)search='';user=nextUser;"],["'staff-protected-clear',()=>{","search='';"],["if(session?.user?.id!==user?.id){","search='';"],["'pagehide',()=>{","search='';"],["'popstate',()=>{","search='';"]];
let composed=base;for(const [site,addition] of changes){const replacement=site.includes('user=nextUser')?addition:site+addition;check(accepted.includes(replacement),true,'accepted PR90 exact reset '+site);composed=composed.replace(site,replacement)}
check(beforeRegistrationRetirement(runtime),composed,'entire runtime equals current base plus six accepted resets; roster/checkin preserved');
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',origin='https://independent-search.invalid',query='Fictional A lookup +15555550009';
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1280])for(const scenario of ['missed-callback-late-list','late-denial','late-auth','history-denial-refresh']){
  const page=await browser.newPage({viewport:{width,height:850}}),calls=[],errors=[];
  let nextHold=null,release,denyNext=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   assert.equal(new URL(route.request().url()).origin,origin,'no external request');
   if(new URL(route.request().url()).pathname!='/rpc')return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="outreach-registration-staff"></div>'});
   const p=route.request().postDataJSON(),actor=route.request().headers()['x-actor'];calls.push({...p,actor});
   const mode=nextHold&&p.p_action==='list'?nextHold:null;if(mode)nextHold=null;
   const denied=denyNext;denyNext=false;
   const data=response('outreach_registration_workspace',p);
   if(mode){await new Promise(r=>release=r);if(mode==='late-data')data.registrations[0].name='OLD ACCOUNT PRIVATE SENTINEL';}
   return route.fulfill({json:mode==='late-denial'||denied?{error:{code:'42501'},data:null}:{error:null,data}});
  });
  await page.goto(origin+'/?campaign='+campaign);
  await page.evaluate(user=>{
   window.actor={id:user};window.rpcPending=0;window.StaffWorkspace={active:()=>true};
   window.ChampionLifeAuth={getUser:async()=>{const captured=structuredClone(actor);if(window.holdAuth){window.holdAuth=false;await new Promise(r=>window.releaseAuth=r)}return captured},client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(n,p)=>{rpcPending++;try{return await fetch('/rpc',{method:'POST',headers:{'x-actor':actor?.id||'none'},body:JSON.stringify(p)}).then(r=>r.json())}finally{rpcPending--}}}};
  },user);
  for(const n of ['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'])await page.addScriptTag({content:source(n)});
  const input=page.getByLabel('Name, phone, email or reference',{exact:true});
  const ready=async()=>{await input.waitFor();await page.getByRole('button',{name:'Open household',exact:true}).waitFor();};
  const idle=()=>page.waitForFunction(()=>rpcPending===0);
  await ready();await input.fill(query);await page.getByRole('button',{name:'Search',exact:true}).click();await ready();await idle();
  await page.evaluate(()=>{window.oldHandlers=[document.querySelector('form').onsubmit,...Array.from(document.querySelectorAll('button')).filter(b=>['Open household','Print backup roster','Export CSV'].includes(b.textContent)).map(b=>b.onclick)];});
  const mark=calls.length;
  if(scenario==='missed-callback-late-list'||scenario==='late-denial'){
   nextHold=scenario==='late-denial'?'late-denial':'late-data';await page.getByRole('button',{name:'Search',exact:true}).click();
   for(let i=0;i<100&&!release;i++)await page.waitForTimeout(10);assert.ok(release,'actual list waiting');
   await page.evaluate(B=>{actor={id:B};dispatchEvent(new Event('focus'))},B); // Deliberately no Auth callback.
   await ready();check(await input.inputValue(),'','new account misses callback but drops prior query');
   await input.fill('B fresh search');await page.getByRole('button',{name:'Search',exact:true}).click();await ready();
   release();await idle();check(await input.inputValue(),'B fresh search','old response cannot overwrite or deny current account search');
   check((await page.locator('body').innerText()).includes('OLD ACCOUNT PRIVATE SENTINEL'),false,'old account result never reaches DOM');
  }else if(scenario==='late-auth'){
   await page.evaluate(()=>{window.holdAuth=true;dispatchEvent(new Event('focus'))});await page.waitForFunction(()=>typeof releaseAuth==='function');
   await page.evaluate(B=>{actor={id:B};authChange('SIGNED_IN',{user:actor})},B);await ready();
   check(await input.inputValue(),'','new callback clears query while older verification pending');
   await page.evaluate(()=>releaseAuth());await page.waitForTimeout(30);await idle();
   check(await input.inputValue(),'','late old verification cannot restore search');
  }else{
   denyNext=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Registration access unavailable'}).waitFor();
   check(await input.count(),0,'denial removes old search controls');
   await page.evaluate(()=>{history.pushState({},'',location.pathname);dispatchEvent(new PopStateEvent('popstate'))});await page.getByRole('heading',{name:'Choose an outreach campaign'}).waitFor();
   await page.evaluate(c=>{history.pushState({},'',location.pathname+'?campaign='+c);dispatchEvent(new PopStateEvent('popstate'))},campaign);await ready();
   check(await input.inputValue(),'','history through chooser cannot restore denied search');
  }
  const account=scenario==='history-denial-refresh'?user:B;
  check(calls.slice(mark).filter(p=>p.p_action==='list'&&p.actor===account).every(p=>p.p_payload.search!==query),true,'no prior identifying query crosses retirement boundary');
  const before=calls.length;await page.evaluate(async()=>{for(const h of oldHandlers)await h(new Event('submit',{cancelable:true}))});await idle();
  check(calls.length,before,'detached search/open/export/print handlers issue zero requests');
  await input.fill('Current account query');await page.getByRole('button',{name:'Search',exact:true}).click();await ready();await idle();
  await page.evaluate(()=>dispatchEvent(new Event('focus')));await ready();await idle();
  check(await input.inputValue(),'Current account query','same-account verified refresh preserves working search');
  check(calls.at(-1).p_payload.search,'Current account query','fresh same-account list uses current query');
  check(calls.every(p=>['context','list','campaigns'].includes(p.p_action)),true,'no roster/check-in/export or mutation request leaked');
  check(errors,[],'no runtime page errors');await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,browsers:['chromium','webkit'],widths:[390,1280],hosted:false}));
