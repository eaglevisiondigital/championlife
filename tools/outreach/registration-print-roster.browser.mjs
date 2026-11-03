// Real Chromium/WebKit, actual registration runtime, fictional controlled RPC transport.
// Tests app-triggered print only; previously read data cannot be recalled from the OS.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {response,campaign,user,registration} from '../backend-tests/fixtures/outreach-registration-ui.mjs';
const origin='https://registration.invalid',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>readFileSync(n==='outreach-registration-staff.js'&&process.env.BASELINE_SOURCE?process.env.BASELINE_SOURCE:new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];
  let grant=true,hold=null,release=null,fail=null,detailVersion=0,closeDuringDetail=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,origin,'no provider traffic');
   if(url.pathname==='/rpc'){
    const p=route.request().postDataJSON();calls.push(p);
    if(p.p_action===hold){hold=null;await new Promise(r=>release=r)}
    if(p.p_action===fail){fail=null;await route.fulfill({json:{data:null,error:{code:'XX000',message:'Synthetic service unavailable'}}});return}
    if(p.p_action==='csv'&&!grant){await route.fulfill({json:{data:null,error:{code:'42501'},status:403}});return}
    const data=structuredClone(response('outreach_registration_workspace',p));
    if(p.p_action==='context'&&!grant)data.capabilities=data.capabilities.filter(x=>x!=='registration.export');
    if(p.p_action==='list')data.registrations.push({...data.registrations[0],id:B,name:'Closed During Load'});
    if(p.p_action==='detail'){
     if(p.p_payload.registration_id===B){data.id=B;data.first_name='Closed';data.last_name='During Load';data.status=closeDuringDetail?'closed':'cancelled'}
     else if(detailVersion){data.first_name='Updated';data.phone='+15555550199';data.attendees[0].checked_in_at='2026-11-03T12:00:00Z';data.attendees[1].waiver_covered=false;data.attendees[1].prize_choice='tablet'}
    }
    await route.fulfill({json:{data,error:null}});return;
   }
   await route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="staff-portal"><main id="outreach-registration-staff"></main></body></html>'});
  });
  await page.goto(origin+'/?campaign='+campaign);
  await page.evaluate(({user})=>{window.actor={id:user};window.shell=true;window.prints=[];window.print=()=>prints.push(document.querySelector('.registration-print')?.innerText);window.StaffWorkspace={active:()=>shell};window.ChampionLifeAuth={getUser:async()=>actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(n,p)=>fetch('/rpc',{method:'POST',body:JSON.stringify(p)}).then(r=>r.json()).then(result=>{if(window.invalidateAfterResult===p.p_action){window.invalidateAfterResult=null;queueMicrotask(()=>queueMicrotask(()=>dispatchEvent(new Event('staff-protected-clear'))))}return result})}}},{user});
  for(const name of['outreach-campaigns.css','outreach-registration.css','staff-portal.css']){try{await page.addStyleTag({content:readFileSync(new URL('../../assets/css/'+name,import.meta.url),'utf8')})}catch(e){if(e.code!=='ENOENT')throw e}}
  for(const source of sources)await page.addScriptTag({content:source});
  const list=async()=>{await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByRole('button',{name:'Open household'}).first().waitFor()};
  const preview=async()=>{await page.getByRole('button',{name:'Print backup roster',exact:true}).click();await page.getByRole('button',{name:'Print private roster',exact:true}).waitFor()};
  const reboot=async()=>{grant=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Open household'}).first().waitFor()};
  const waitHeld=async()=>{for(let i=0;!release&&i<400;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release,'held RPC reached')};
  const printed=()=>page.evaluate(()=>prints.length);
  const denied=async()=>page.getByRole('heading',{name:'Registration access unavailable',exact:true}).waitFor();
  await page.getByRole('button',{name:'Open household'}).first().waitFor();
  let start=calls.length;await preview();
  ok(await printed()===0,'preview does not print');
  if(process.env.BASELINE_SOURCE){grant=false;await page.getByRole('button',{name:'Print private roster',exact:true}).click();ok(await printed()===1,'baseline prints despite export revocation');ok(calls.slice(start).filter(p=>p.p_action==='csv').length===1,'baseline makes no new export check');console.log(JSON.stringify({engine,width,baselineUnauthorizedPrint:true}));await page.close();continue}
  ok(calls.slice(start).filter(p=>p.p_action==='csv').length===1,'preview audits export once');ok(calls.at(-1).p_action==='csv','preview final request is authoritative export check');
  ok(await page.locator('.registration-print th').count()===6,'existing six columns retained');ok(await page.locator('.registration-print tr').count()===3,'one adult and child, closed household excluded');
  ok(!(await page.locator('.registration-print').innerText()).includes('Closed During Load'),'detail status supersedes stale active list status');
  await page.evaluate(()=>window.oldPrint=[...document.querySelectorAll('button')].find(b=>b.textContent==='Print private roster'));
  detailVersion=1;start=calls.length;await page.getByRole('button',{name:'Print private roster',exact:true}).click();await page.waitForFunction(()=>prints.length===1);
  const printText=await page.evaluate(()=>prints[0]);ok(printText.includes('Updated Fixture')&&printText.includes('+15555550199'),'print refreshes household contact');ok(printText.includes('Checked in')&&printText.includes('Missing')&&printText.includes('tablet'),'print refreshes check-in, waiver and prize');ok(calls.slice(start).filter(p=>p.p_action==='csv').length===1,'explicit print audits export once');ok(calls.at(-1).p_action==='csv','print authorization is final backend request');
  start=calls.length;await page.evaluate(()=>oldPrint.onclick());ok(calls.length===start,'retired print handle cannot reprint');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-'+width+'-roster.png',fullPage:true})}
  // Existing view authority deliberately remains when export is revoked.
  grant=false;start=calls.length;await page.getByRole('button',{name:'Print private roster',exact:true}).click();await denied();ok(await printed()===1,'revoked export blocks explicit print');ok(calls.slice(start).map(p=>p.p_action).join(',')==='context','fresh context denial stops data collection');ok(await page.locator('.registration-print').count()===0,'observed denial clears roster');
  // Export disappears after allowed context while list/detail calls remain authorized.
  await reboot();hold='detail';await page.getByRole('button',{name:'Print backup roster',exact:true}).click();await waitHeld();grant=false;release();release=null;await denied();ok(await page.locator('.registration-print').count()===0,'mid-build export revocation never exposes table');ok(await printed()===1,'mid-build revocation never prints');
  // Navigation retires a pending print and old export response.
  await reboot();await preview();hold='csv';await page.getByRole('button',{name:'Print private roster',exact:true}).click();await waitHeld();await list();release();release=null;await page.waitForTimeout(60);ok(await printed()===1,'late export after navigation cannot print');ok(await page.locator('.registration-print').count()===0,'late export cannot restore roster');
  // Account switch and URL campaign change reject the delayed previous print.
  for(const transition of['account','campaign','clear','logout','pagehide','microtask']){
   await reboot();await preview();hold='csv';await page.getByRole('button',{name:'Print private roster',exact:true}).click();await waitHeld();
   if(transition==='account')await page.evaluate(()=>{actor={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};authChange('SIGNED_IN',{user:actor})});
   if(transition==='campaign')await page.evaluate(()=>history.pushState({},'',location.pathname+'?campaign=cccccccc-cccc-4ccc-8ccc-cccccccccccc'));
   if(transition==='clear')await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));
   if(transition==='logout')await page.evaluate(()=>{actor=null;authChange('SIGNED_OUT',null)});
   if(transition==='pagehide')await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
   if(transition==='microtask')await page.evaluate(()=>window.invalidateAfterResult='csv');
   release();release=null;await page.waitForTimeout(60);ok(await printed()===1,transition+' blocks delayed print');ok(await page.locator('.registration-print').count()===0,transition+' cannot restore private roster');
   await page.evaluate(({user,campaign})=>{actor={id:user};history.replaceState({},'',location.pathname+'?campaign='+campaign);dispatchEvent(new PopStateEvent('popstate'))},{user,campaign});await page.getByRole('button',{name:'Open household'}).first().waitFor();
  }
  for(const action of['detail','csv']){await reboot();await preview();fail=action;await page.getByRole('button',{name:'Print private roster',exact:true}).click();await page.getByRole('alert').waitFor();ok(await printed()===1,action+' failure does not print');ok(await page.locator('.registration-print').count()===0,action+' failure does not publish partial roster')}
  // No permission => no entry point, even though ordinary household viewing works.
  grant=false;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Open household'}).first().waitFor();ok(await page.getByRole('button',{name:'Print backup roster',exact:true}).count()===0,'view-only worker has no roster action');
  ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} registration printable roster assertions PASS`);
