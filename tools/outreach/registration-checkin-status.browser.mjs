// Actual registration source; fictional RPC responses. Never sends provider requests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {response,campaign,user} from '../backend-tests/fixtures/outreach-registration-ui.mjs';
const origin='https://checkin-status.invalid';
const sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>process.env.REVIEW_BASE?execFileSync('git',['show',process.env.REVIEW_BASE+':assets/js/'+n],{encoding:'utf8'}):readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let status='cancelled',permission=true,covered=true,attending=true;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   assert.equal(new URL(route.request().url()).origin,origin,'no hosted traffic');
   if(new URL(route.request().url()).pathname!='/rpc')return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="outreach-registration-staff"></div>'});
   const p=route.request().postDataJSON();calls.push(p);let data=response('outreach_registration_workspace',p);
   if(p.p_action==='context'&&!permission)data.capabilities=data.capabilities.filter(k=>k!=='checkin.manage');
   if(p.p_action==='detail')data={...data,status,attendees:data.attendees.map(a=>({...a,waiver_covered:covered,attending}))};
   return route.fulfill({json:{data,error:null,status:200}});
  });
  await page.goto(origin+'/?campaign='+campaign);
  await page.evaluate(user=>{window.actor={id:user};window.ChampionLifeAuth={getUser:async()=>actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(n,p)=>fetch('/rpc',{method:'POST',body:JSON.stringify(p)}).then(r=>r.json())}}},user);
  for(const s of sources)await page.addScriptTag({content:s});
  const open=async()=>{await page.getByRole('button',{name:'Open household'}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
  const refresh=async()=>{await page.getByRole('button',{name:'Registrations',exact:true}).click();await open()};
  await open();
  if(process.env.REPRO){
   await page.getByRole('button',{name:'Check in attendee',exact:true}).first().click();
   await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();
   ok(calls.filter(p=>p.p_action==='checkin').length===1,'old source submits known-invalid cancelled household check-in');
   console.log(JSON.stringify({engine,width,originalInvalidCheckinRequests:1}));await page.close();continue;
  }
  for(const value of ['cancelled','no_show','closed']){
   status=value;await refresh();const before=calls.length;
   const buttons=page.getByRole('button',{name:'Check in attendee',exact:true});
   ok(await buttons.count()===2,'existing attendee controls preserved');ok(await buttons.first().isDisabled()&&await buttons.nth(1).isDisabled(),value+' controls unavailable');
   ok(await page.getByText('Check-in is unavailable for this household status. An authorized registration manager must reopen the household first.',{exact:true}).count()===1,'clear household-level explanation');
   await page.evaluate(async()=>{for(const b of [...document.querySelectorAll('button')].filter(b=>b.textContent==='Check in attendee'))await b.onclick()});
   ok(calls.length===before,'direct disabled handler generates zero requests');
  }
  // Unknown server states fail closed. They do not become an invented active status.
  status='unexpected';await refresh();ok(await page.getByRole('button',{name:'Check in attendee',exact:true}).first().isDisabled(),'unknown status cannot check in');
  for(const value of ['submitted','confirmed','checked_in']){
   status=value;await refresh();const before=calls.filter(p=>p.p_action==='checkin').length;
   ok(await page.getByRole('button',{name:'Check in attendee',exact:true}).first().isEnabled(),'active status '+value);
   ok(await page.getByText('Check-in is unavailable for this household status.',{exact:false}).count()===0,'no stale restriction after authorized reopen');
   await page.getByRole('button',{name:'Check in attendee',exact:true}).first().click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();
   ok(calls.filter(p=>p.p_action==='checkin').length===before+1,'authorized active check-in sent once');
  }
  covered=false;await refresh();ok(await page.getByRole('button',{name:'Check in attendee',exact:true}).first().isDisabled(),'required waiver still blocks');
  covered=true;attending=false;await refresh();ok(await page.getByRole('button',{name:'Check in attendee',exact:true}).first().isDisabled(),'nonattending still blocks');
  attending=true;permission=false;await refresh();ok(await page.getByRole('button',{name:'Check in attendee',exact:true}).count()===0,'view/manage never substitutes check-in authority');
  permission=true;status='confirmed';await refresh();
  await page.evaluate(()=>{window.oldCheck=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee');actor={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};authChange('SIGNED_IN',{user:actor})});const before=calls.filter(p=>p.p_action==='checkin').length;
  await page.evaluate(()=>oldCheck.onclick());await page.getByRole('button',{name:'Open household'}).waitFor();ok(calls.filter(p=>p.p_action==='checkin').length===before,'retained previous-account control sends no check-in');
  ok(errors.length===0,'no browser errors');await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,hosted:false,reproduction:!!process.env.REPRO}));
