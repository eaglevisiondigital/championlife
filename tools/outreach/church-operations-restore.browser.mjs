// Real Chromium/WebKit, actual application scripts, fictional controlled HTTP only.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {response,registration,campaign,user} from '../backend-tests/fixtures/outreach-registration-ui.mjs';
const origin='https://operations.invalid',sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
const css=['outreach-campaigns.css','outreach-registration.css','staff-portal.css','staff-workspace.css'].map(n=>readFileSync(new URL('../../assets/css/'+n,import.meta.url),'utf8')).join('\n');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),calls=[],errors=[];
  let members=structuredClone(response('',{p_action:'detail'}).attendees),manage=true,mode='',hold='',release=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'no hosted traffic');
   if(u.pathname!='/rpc'){await route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body class="staff-portal"><div id="outreach-registration-staff"></div></body></html>'});return}
   const p=route.request().postDataJSON();calls.push(p);
   if(p.p_action===hold){hold='';await new Promise(r=>release=r)}
   let data=structuredClone(response('outreach_registration_workspace',p)),error=null;
   if(p.p_action==='context'&&!manage)data.capabilities=['registration.view'];
   if(p.p_action==='detail')data.attendees=structuredClone(members);
   if(p.p_action==='list'){data.summary.minors=members[1].active?1:0;data.summary.attendees=members.filter(a=>a.active&&a.attending).length;data.registrations[0].attendees=data.summary.attendees}
   if(p.p_action==='attendee_update'){
    const a=members.find(a=>a.id===p.p_payload.attendee_id);
    if(mode==='denied')error={code:'42501',message:'PRIVATE DENIAL TOKEN'};
    else if(mode==='conflict'||a.revision!==p.p_payload.revision)error={code:'P0001',message:'PRIVATE DATABASE DETAILS'};
    else{a.active=p.p_payload.active;a.revision++;if(mode==='unknown'){await route.abort();return}}
   }
   await route.fulfill({json:{data:error?null:data,error}});
  });
  await page.goto(origin+'/?campaign='+campaign);
  await page.evaluate(user=>{window.actor={id:user};window.StaffWorkspace={active:()=>true};window.ChampionLifeAuth={getUser:async()=>window.actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(n,p)=>fetch('/rpc',{method:'POST',body:JSON.stringify(p)}).then(r=>r.json())}}},user);
  for(const source of sources)await page.addScriptTag({content:source});
  const open=async()=>{await page.getByRole('button',{name:'Open household'}).click();await page.getByRole('heading',{level:2,name:'Morgan Fixture',exact:true}).waitFor()};
  const list=async()=>{await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByRole('button',{name:'Open household'}).waitFor()};
  const removed=page.locator('[data-removed-attendees]');
  const expand=async()=>{await removed.locator('summary').click();await removed.getByRole('button',{name:'Restore attendee'}).waitFor()};
  const restored=()=>page.locator('.registration-member').filter({has:page.getByRole('heading',{level:3,name:'Alex Fixture',exact:true})}).filter({has:page.getByText('Waiver covered',{exact:true})});
  await page.getByRole('button',{name:'Open household'}).waitFor();await open();
  const child=page.locator('.registration-member').filter({has:page.getByRole('heading',{level:3,name:'Alex Fixture',exact:true})});
  await child.getByText('Update attendee',{exact:true}).click();await child.getByRole('button',{name:'Remove attendee'}).click();await removed.waitFor();
  ok(members[1].active===false,'remove persists inactive attendee');ok(await removed.getAttribute('open')===null,'history collapsed initially');await expand();
  ok((await removed.innerText()).includes('Guardian: Parent'),'guardian relationship preserved in scoped history');
  ok(await removed.getByRole('button',{name:'Check in attendee'}).count()===0,'no inactive check-in action');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'existing styles fit viewport without overflow');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:`${process.env.EVIDENCE_DIR}/${engine}-${width}-removed.png`,fullPage:true})}
  const start=calls.length;await removed.getByRole('button',{name:'Restore attendee'}).focus();ok(await removed.getByRole('button',{name:'Restore attendee'}).evaluate(e=>e===document.activeElement),'restore supports keyboard focus');await page.keyboard.press('Enter');await restored().waitFor();
  const restoreCalls=calls.slice(start).filter(p=>p.p_action==='attendee_update');ok(restoreCalls.length===1,'single restoration mutation');
  assert.deepEqual(Object.keys(restoreCalls[0].p_payload).sort(),['active','attendee_id','registration_id','revision']);checks++;
  ok(restoreCalls[0].p_payload.active===true&&restoreCalls[0].p_payload.revision===2,'exact active flag and captured revision');
  ok(calls.slice(start).findIndex(p=>p.p_action==='context')<calls.slice(start).findIndex(p=>p.p_action==='attendee_update'),'fresh permission check precedes restore');
  ok(!members[1].checked_in_at&&members[1].age===9&&members[1].guardian_relationship==='Parent','no check-in or guardian mutation');
  await list();ok(await page.locator('[data-metric="minors"] strong').innerText()==='1','fresh totals include restored child');
  // Reset fixture to a removed record and reopen with the actual navigation.
  const reset=async()=>{mode='';manage=true;members[1].active=false;members[1].revision++;if(await page.getByRole('button',{name:'Registrations',exact:true}).count())await list();else{await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Open household'}).waitFor()}await open();await expand()};
  await reset();const oldRevision=members[1].revision;mode='conflict';await removed.getByRole('button',{name:'Restore attendee'}).click();await page.getByRole('alert').waitFor();ok((await page.getByRole('alert').innerText()).includes('Reload this household'),'conflict offers fresh reload');ok(!(await page.locator('body').innerText()).includes('PRIVATE'),'raw errors hidden');ok(await removed.getByRole('button',{name:'Restore attendee'}).isDisabled(),'uncertain control stays retired');ok(members[1].revision===oldRevision,'conflict not overwritten');
  mode='';await removed.getByRole('button',{name:'Reload household'}).click();await expand();mode='unknown';const uncertain=calls.length;await removed.getByRole('button',{name:'Restore attendee'}).click();await page.getByRole('alert').waitFor();ok(members[1].active,'server fixture accepted before connection loss');ok(calls.slice(uncertain).filter(p=>p.p_action==='attendee_update').length===1,'unknown does not auto-retry');ok(await removed.getByRole('button',{name:'Restore attendee'}).isDisabled(),'unknown action requires reload');mode='';await removed.getByRole('button',{name:'Reload household'}).click();await restored().waitFor();ok(await removed.count()===0,'reload reconciles accepted unknown result');
  await reset();hold='attendee_update';const doubleStart=calls.length;await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Restore attendee');window.pending=b.onclick();b.onclick()});while(!release)await new Promise(r=>setTimeout(r,5));ok(calls.slice(doubleStart).filter(p=>p.p_action==='attendee_update').length===1,'double invocation submits once');await list();release();release=null;await page.evaluate(()=>pending);ok(await page.getByRole('heading',{name:'Household lookup'}).isVisible(),'late restore cannot reopen old household');
  await open();members[1].active=false;await list();await open();await expand();await page.evaluate(()=>window.oldRestore=[...document.querySelectorAll('button')].find(b=>b.textContent==='Restore attendee'));await list();const detached=calls.length;await page.evaluate(()=>oldRestore.onclick());ok(calls.length===detached,'detached restore submits nothing');
  await reset();manage=false;const revoked=calls.length;await removed.getByRole('button',{name:'Restore attendee'}).click();await page.getByRole('heading',{name:'Registration access unavailable'}).waitFor();ok(!calls.slice(revoked).some(p=>p.p_action==='attendee_update'),'fresh permission loss denies before mutation');ok(!await removed.count(),'denial clears private removed history');
  await reset();mode='denied';await removed.getByRole('button',{name:'Restore attendee'}).click();await page.getByRole('heading',{name:'Registration access unavailable'}).waitFor();ok(!await removed.count(),'backend revocation clears private history');ok(!(await page.locator('body').innerText()).includes('PRIVATE'),'backend denial text sanitized');
  await reset();await page.evaluate(()=>{window.oldRestore=[...document.querySelectorAll('button')].find(b=>b.textContent==='Restore attendee');window.actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};authChange('SIGNED_IN',{user:actor})});const switchAt=calls.length;await page.evaluate(()=>oldRestore.onclick());await page.getByRole('button',{name:'Open household'}).waitFor();ok(!calls.slice(switchAt).some(p=>p.p_action==='attendee_update'),'account switch retires old restore');
  await open();await expand();await page.evaluate(()=>window.actor={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});const silent=calls.length;await removed.getByRole('button',{name:'Restore attendee'}).click();await page.getByRole('heading',{name:'Sign in to continue'}).waitFor();ok(!calls.slice(silent).some(p=>p.p_action==='attendee_update'),'fresh identity check catches silent account replacement');
  // An auth owner, client or client-auth replacement retires the rendered action.
  for(const kind of ['owner','client','clientAuth']){
   await reset();await page.evaluate(kind=>{window.originalAuth=ChampionLifeAuth;window.originalClient=ChampionLifeAuth.client;window.originalClientAuth=ChampionLifeAuth.client.auth;if(kind==='owner')window.ChampionLifeAuth={...ChampionLifeAuth};if(kind==='client')ChampionLifeAuth.client={...ChampionLifeAuth.client};if(kind==='clientAuth')ChampionLifeAuth.client.auth={...ChampionLifeAuth.client.auth}},kind);
   const authStart=calls.length;await removed.getByRole('button',{name:'Restore attendee'}).click();await page.getByRole('heading',{name:'Sign in to continue'}).waitFor();ok(!calls.slice(authStart).some(p=>p.p_action==='attendee_update'),kind+' replacement denies prior control');
   await page.evaluate(()=>{window.ChampionLifeAuth=originalAuth;ChampionLifeAuth.client=originalClient;ChampionLifeAuth.client.auth=originalClientAuth});
  }
  await reset();hold='context';const contextAt=calls.length;await removed.getByRole('button',{name:'Restore attendee'}).click();while(!release)await new Promise(r=>setTimeout(r,5));await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));release();release=null;await page.waitForTimeout(30);ok(!calls.slice(contextAt).some(p=>p.p_action==='attendee_update'),'clear while permission request waits prevents mutation');ok(await page.locator('#outreach-registration-staff').innerText()==='','late context cannot restore private DOM');
  manage=false;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Open household'}).waitFor();await open();ok(!await removed.count(),'view-only gets no removed-attendee management UI');
  ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} attendee restoration browser assertions PASS`);
