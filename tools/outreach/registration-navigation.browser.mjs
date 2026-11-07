// Actual registration runtime; fictional RPC service only. No hosted requests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {response,registration,campaign,user} from '../backend-tests/fixtures/outreach-registration-ui.mjs';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',origin='https://registration.invalid';
const sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0; const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const [engine,browserType]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let hold=null,release=null,deny=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());assert.equal(u.origin,origin,'no external provider traffic');
  if(u.pathname==='/rpc'){
   const p=route.request().postDataJSON();calls.push(p);
   if(p.p_action===hold){hold=null;await new Promise(r=>release=r)}
   let data=response('outreach_registration_workspace',p);
   if(p.p_action==='list'){data.registrations.push({...data.registrations[0],id:B,name:'Taylor Second'});data.summary.households=2}
   if(p.p_action==='detail'&&p.p_payload.registration_id===B)data={...data,id:B,first_name:'Taylor',last_name:'Second'};
   await route.fulfill({json:deny?{data:null,error:{code:'42501'}}:{data,error:null}});return;
  }
  await route.fulfill({contentType:'text/html',body:'<div id="outreach-registration-staff"></div>'});
 });
 await page.goto(origin+'/?campaign='+campaign);
 await page.evaluate(({user})=>{window.actor={id:user};window.shell=true;window.StaffWorkspace={active:()=>window.shell};window.ChampionLifeAuth={getUser:async()=>window.actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(n,p)=>fetch('/rpc',{method:'POST',body:JSON.stringify(p)}).then(r=>r.json()).then(result=>{if(window.invalidateAfterResult===p.p_action){window.invalidateAfterResult=null;queueMicrotask(()=>queueMicrotask(()=>window.dispatchEvent(new Event('staff-protected-clear'))))}return result})}}},{user});
 for(const source of sources)await page.addScriptTag({content:source});
 const list=async()=>{await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByRole('button',{name:'Open household'}).nth(1).waitFor()};
 const open=async i=>{await page.getByRole('button',{name:'Open household'}).nth(i).click();await page.getByRole('heading',{level:2,name:i?'Taylor Second':'Morgan Fixture',exact:true}).waitFor()};
 await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();await open(0);
 await page.evaluate(()=>{window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household');window.oldCheck=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee');window.oldAdd=[...document.querySelectorAll('form')].find(f=>f.textContent.includes('Add attendee'));window.oldSign=[...document.querySelectorAll('form')].find(f=>f.textContent.includes('Record signature'))});
 await list();await open(1);const before=calls.length;
 await page.evaluate(async()=>{await oldSave.onclick();await oldCheck.onclick();await oldAdd.onsubmit(new Event('submit'));await oldSign.onsubmit(new Event('submit'))});
 const stale=calls.slice(before).filter(p=>['update','checkin','attendee_add','sign'].includes(p.p_action));
 if(process.env.REPRO){console.log(JSON.stringify({engine,width,originalExploit:stale.map(p=>({action:p.p_action,subject:p.p_payload.registration_id}))}));ok(stale.length>0,'pre-fix wrong-subject requests reproduced');await page.close();continue}
 ok(stale.length===0,'detached household controls cannot submit');ok(await page.getByRole('heading',{level:2,name:'Taylor Second',exact:true}).isVisible(),'B remains displayed');
 // A request submitted while authorized may complete; it must not replace the newer view.
 hold='update';await page.getByText('Edit household',{exact:true}).click();await page.getByRole('button',{name:'Save household',exact:true}).click();await page.waitForFunction(()=>document.querySelector('button')!==null);while(!release)await new Promise(r=>setTimeout(r,5));
 const acceptedBeforeNav=calls.filter(p=>p.p_action==='update').length;await list();await open(0);release();release=null;await page.waitForTimeout(50);
 ok(await page.getByRole('heading',{level:2,name:'Morgan Fixture',exact:true}).isVisible(),'pending old save cannot restore B or clear A');ok(calls.filter(p=>p.p_action==='update').length===acceptedBeforeNav,'no duplicate after late response');
 // Direct retained handler duplicate calls are blocked even before the network completes.
 hold='checkin';await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee');window.pending=b.onclick();b.onclick()});while(!release)await new Promise(r=>setTimeout(r,5));
 ok(calls.filter(p=>p.p_action==='checkin').length===1,'double retained invocation submits once');release();release=null;await page.evaluate(()=>pending);await page.getByRole('heading',{level:2,name:'Morgan Fixture',exact:true}).waitFor();

 // Normal form actions remain available, without acquiring credit or extra permissions.
 for(const [label,action]of[['Add attendee','attendee_add'],['Record signature','sign']]){
  const n=calls.filter(p=>p.p_action===action).length;
  await page.evaluate(async label=>{const f=[...document.querySelectorAll('form')].find(f=>[...f.querySelectorAll('button')].some(b=>b.textContent===label));await f.onsubmit(new Event('submit'))},label);
  ok(calls.filter(p=>p.p_action===action).length===n+1,'normal '+action+' submits once');
  ok(calls.at(-1).p_payload.registration_id===registration,'normal action reloads same household');
 }
 // Configuration forms and dynamically mounted walk-up handlers are also navigation scoped.
 await page.getByRole('button',{name:'Configuration',exact:true}).click();await page.getByRole('heading',{name:'Registration configuration',exact:true}).waitFor();
 await page.evaluate(()=>{window.oldConfig=[...document.querySelectorAll('form')][0];window.oldWaiver=[...document.querySelectorAll('form')][1]});await list();await open(1);const configCount=calls.length;
 await page.evaluate(async()=>{await oldConfig.onsubmit(new Event('submit'));await oldWaiver.onsubmit(new Event('submit'))});ok(calls.length===configCount,'stale configuration and waiver forms issue no requests');
 // Delayed export cannot download private CSV after navigation.
 await page.evaluate(()=>{window.downloads=0;window.OutreachRegistrationForm.download=()=>window.downloads++});hold='csv';await page.getByRole('button',{name:'Export CSV',exact:true}).click();while(!release)await new Promise(r=>setTimeout(r,5));await list();release();release=null;await page.waitForTimeout(50);ok(await page.evaluate(()=>downloads)===0,'stale CSV does not download');
 // URL campaign changes block detached controls even before the navigation event runs.
 await open(0);await page.evaluate(()=>{window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household');history.pushState({},'',location.pathname+'?campaign=cccccccc-cccc-4ccc-8ccc-cccccccccccc')});const routeCount=calls.length;await page.evaluate(()=>oldSave.onclick());ok(calls.length===routeCount,'changed campaign URL invalidates previous controls');
 await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate')));await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();ok(calls.at(-1).p_campaign==='cccccccc-cccc-4ccc-8ccc-cccccccccccc','popstate requests fresh campaign authorization');
 await page.evaluate(campaign=>{history.replaceState({},'',location.pathname+'?campaign='+campaign);dispatchEvent(new PopStateEvent('popstate'))},campaign);await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();await open(0);
 await page.evaluate(()=>{window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household');dispatchEvent(new PageTransitionEvent('pagehide'))});const historyCount=calls.length;await page.evaluate(()=>oldSave.onclick());ok(calls.length===historyCount,'pagehide rejects retained handler');ok(await page.locator('#outreach-registration-staff').innerText()==='','pagehide clears private DOM');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();await open(0);
 // Same tab account switch cannot reuse the old actor's controls.
 await page.evaluate(()=>{window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household');window.actor={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};window.authChange('SIGNED_IN',{user:window.actor})});const switchCount=calls.length;await page.evaluate(()=>oldSave.onclick());await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();ok(calls.slice(switchCount).every(p=>p.p_action!=='update'),'account switch blocks prior actor mutation');await open(0);

 // Invalidation between the RPC's own check and its caller continuation must not reopen details.
 await page.evaluate(()=>window.invalidateAfterResult='update');await page.getByText('Edit household',{exact:true}).click();const microStart=calls.length;await page.getByRole('button',{name:'Save household',exact:true}).click();await page.waitForTimeout(50);
 ok(calls.slice(microStart).filter(p=>p.p_action==='update').length===1,'microtask case includes exactly the already submitted request');ok(calls.slice(microStart).every(p=>!['context','detail'].includes(p.p_action)),'microtask invalidation prevents post-RPC reauthorization/navigation');ok(await page.locator('#outreach-registration-staff').innerText()==='','microtask invalidation cannot restore old household');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();await open(0);
 // Shell invalidation and user transition destroy old action authority immediately.
 await page.evaluate(()=>{window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household');window.dispatchEvent(new Event('staff-protected-clear'))});const clearCount=calls.length;await page.evaluate(()=>oldSave.onclick());ok(calls.length===clearCount,'shell clear rejects detached save');ok(await page.locator('#outreach-registration-staff').innerText()==='','protected clear remains empty');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();await open(0);
 await page.evaluate(()=>{window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household');window.actor=null;window.authChange('SIGNED_OUT',null)});const logoutCount=calls.length;await page.evaluate(()=>oldSave.onclick());await page.getByRole('heading',{name:'Sign in to continue'}).waitFor();ok(calls.slice(logoutCount).every(p=>p.p_action!=='update'),'logout rejects old mutation');
 await page.evaluate(({user})=>{window.actor={id:user};window.authChange('SIGNED_IN',{user:window.actor})},{user});await page.getByRole('button',{name:'Open household'}).nth(1).waitFor();await open(1);
 deny=true;await page.getByText('Edit household',{exact:true}).click();await page.getByRole('button',{name:'Save household',exact:true}).click();await page.getByRole('heading',{name:'Registration access unavailable'}).waitFor();ok(!await page.getByRole('heading',{level:2,name:'Taylor Second',exact:true}).count(),'current explicit denial clears details');
 ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks,mutations:calls.filter(p=>['update','checkin','attendee_add','sign'].includes(p.p_action)).length}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} registration navigation browser assertions PASS`);
