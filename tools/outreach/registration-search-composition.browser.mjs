// Source-only household-search privacy regression. Every request is intercepted;
// fictional Auth/RPC results are not genuine provider acceptance.
import assert from 'node:assert/strict';
import {beforeRegistrationRetirement} from './registration-control-retirement-contract.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {response,campaign,user} from '../backend-tests/fixtures/outreach-registration-ui.mjs';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',otherCampaign='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const origin='https://search-privacy.invalid',query='Fictional A private lookup +15555550173';
const sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>
 process.env.REVIEW_BASE?execFileSync('git',['show',process.env.REVIEW_BASE+':assets/js/'+n],{encoding:'utf8'}):readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
// Reuse PR90 4f64fa14f03098e31ee8111c8ff1810fbc260542 search regression.
// PR72 9f78e195115f55135d763e1e5373a494e817423b contributes current check-in/roster behavior.
const resets=[["function deny(status){", "function deny(status){search='';"], ["if(g!==generation)return;user=nextUser;", "if(g!==generation)return;if(nextUser?.id!==user?.id)search='';user=nextUser;"], ["'staff-protected-clear',()=>{generation++", "'staff-protected-clear',()=>{search='';generation++"], ["if(session?.user?.id!==user?.id){generation++", "if(session?.user?.id!==user?.id){search='';generation++"], ["'pagehide',()=>{generation++", "'pagehide',()=>{search='';generation++"], ["'popstate',()=>{campaign=", "'popstate',()=>{search='';campaign="]];
if(!process.env.REVIEW_BASE){let normalized=beforeRegistrationRetirement(sources[2]);for(const [before,after] of resets){assert.equal(normalized.split(after).length-1,1,'exact accepted lifecycle reset');normalized=normalized.replace(after,before)}assert.equal(createHash('sha256').update(normalized).digest('hex'),'df48a3f8bcdbbd78f6bc40187489f68131dbe52c5a578607ad2760fdd01437e9','all other current PR72 runtime bytes preserved')}
let checks=0,scenarios=0;const ok=(value,label)=>{assert.ok(value,label);checks++};
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1280])for(const scenario of ['callback','missed-callback-focus','logout','expired','denial','protected-clear','history','bfcache','pending-list','same-account-focus']){
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let denied=false,hold=false,release;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,origin,'no hosted request');
   if(url.pathname!='/rpc')return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="outreach-registration-staff"></div>'});
   const p=route.request().postDataJSON(),actor=route.request().headers()['x-fictional-actor'];calls.push({...p,actor});
   const capturedDenial=denied;
   if(hold&&p.p_action==='list'){hold=false;await new Promise(r=>release=r)}
   return route.fulfill({json:capturedDenial?{data:null,error:{code:'42501'}}:{data:response('outreach_registration_workspace',p),error:null}});
  });
  await page.goto(origin+'/?campaign='+campaign);
  await page.evaluate(user=>{
   window.actor={id:user};window.StaffWorkspace={active:()=>true};
   window.ChampionLifeAuth={getUser:async()=>actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(n,p)=>fetch('/rpc',{method:'POST',headers:{'x-fictional-actor':actor?.id||'anonymous'},body:JSON.stringify(p)}).then(r=>r.json())}};
  },user);
  for(const s of sources)await page.addScriptTag({content:s});
  const field=()=>page.getByLabel('Name, phone, email or reference',{exact:true});
  await field().waitFor();await field().fill(query);await page.getByRole('button',{name:'Search',exact:true}).click();await field().waitFor();
  ok(await field().inputValue()===query,engine+' '+scenario+' initial search works');
  await page.evaluate(()=>{window.detachedSearch=document.querySelector('form');window.oldHandler=detachedSearch.onsubmit});
  const previous=calls.length;
  if(scenario==='callback'||scenario==='missed-callback-focus'||scenario==='pending-list'){
   if(scenario==='pending-list'){
    hold=true;await page.getByRole('button',{name:'Search',exact:true}).click();
    for(let i=0;i<200&&!release;i++)await page.waitForTimeout(5);assert.ok(release,'delayed list started');
   }
   await page.evaluate(({B,scenario})=>{actor={id:B};if(scenario==='missed-callback-focus')dispatchEvent(new Event('focus'));else authChange('SIGNED_IN',{user:actor})},{B,scenario});
  }else if(scenario==='logout'||scenario==='expired'){
   await page.evaluate(scenario=>{actor=null;if(scenario==='expired')dispatchEvent(new Event('focus'));else authChange('SIGNED_OUT',null)},scenario);
   await page.getByRole('heading',{name:'Sign in to continue',exact:true}).waitFor();
   ok(await field().count()===0,'signed out DOM contains no search');
   await page.evaluate(B=>{actor={id:B};authChange('SIGNED_IN',{user:actor})},B);
  }else if(scenario==='denial'){
   denied=true;await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('heading',{name:'Registration access unavailable'}).waitFor();
   ok(await field().count()===0,'denial removes search');denied=false;await page.evaluate(()=>dispatchEvent(new Event('focus')));
  }else if(scenario==='protected-clear'){
   await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));ok(await field().count()===0,'protected clear removes search');await page.evaluate(()=>dispatchEvent(new Event('focus')));
  }else if(scenario==='history'){
   await page.evaluate(c=>{history.pushState({},'',location.pathname+'?campaign='+c);dispatchEvent(new PopStateEvent('popstate'))},otherCampaign);
  }else if(scenario==='bfcache'){
   await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))});
  }else await page.evaluate(()=>dispatchEvent(new Event('focus')));
  await field().waitFor();await page.getByRole('button',{name:'Open household'}).waitFor();
  if(release){release();await page.waitForTimeout(60)}
  const expected=scenario==='same-account-focus'?query:'';
  ok(await field().inputValue()===expected,engine+' '+width+' '+scenario+' search ownership');
  const after=calls.slice(previous).filter(p=>p.p_action==='list'&&(scenario!=='pending-list'||p.actor===B));
  ok(after.length>0&&after.every(p=>p.p_payload.search===expected),'fresh list requests use only current search');
  const retainedCount=calls.length;await page.evaluate(()=>oldHandler(new Event('submit')));await page.waitForTimeout(20);
  ok(calls.length===retainedCount,'retained former form issues zero requests');
  ok(calls.every(p=>['context','list'].includes(p.p_action)),'zero mutation requests');ok(errors.length===0,'no runtime errors');
  if(scenario==='callback'){
   await field().fill('B private query');await page.getByRole('button',{name:'Search',exact:true}).click();await field().waitFor();
   const beforeA=calls.length;await page.evaluate(user=>{actor={id:user};authChange('SIGNED_IN',{user:actor})},user);await field().waitFor();
   ok(await field().inputValue()==='','A to B to A does not transfer searches');
   ok(calls.slice(beforeA).filter(p=>p.p_action==='list').every(p=>p.p_payload.search===''),'A return sends no B query');
  }
  scenarios++;await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,scenarios,browsers:['chromium','webkit'],widths:[390,1280],hosted:false}));
