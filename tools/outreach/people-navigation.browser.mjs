// Existing People runtime, fictional scoped RPCs, no hosted requests or mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://people.invalid',person='11111111-1111-4111-8111-111111111111';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let denied=false,held=false,release=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'no external requests');
   if(u.pathname==='/rpc'){
    const {name,p}=route.request().postDataJSON();calls.push({name,...p});let data;
    if(name==='staff_workspace_context')data={organizations:[{id:'org-a',name:'Organization A'},{id:'org-b',name:'Organization B'}],grants:['org-a','org-b'].map(organization_id=>({organization_id,permission:'people.read',department_ids:null}))};
    else if(p.p_action==='detail')data={person:{id:person,first_name:'Chosen',last_name:'Contact',email:'fixture@example.test'},relationships:[{relationship:'resource_recipient',active:true}]};
    else if(p.p_action==='list'){
     if(held){held=false;await new Promise(r=>release=r)}
     const marker=p.p_payload.search||'Unfiltered';data=Array.from({length:26},(_,i)=>({id:person,first_name:marker,last_name:`Page ${p.p_payload.page} Contact ${i}`,email:'fictional@example.test',relationships:['resource_recipient']}));
    }else throw Error('Unexpected action');
    await route.fulfill({json:denied?{data:null,error:{code:'42501'}}:{data,error:null}});return;
   }
   await route.fulfill({contentType:'text/html',body:'<main id="outreach-people"></main>'});
  });
  await page.goto(origin+'/staff-people.html?org=org-a');
  await page.evaluate(()=>{window.actor={id:'actor-a'};window.ChampionLifeAuth={getUser:async()=>window.actor,getSession:async()=>window.actor?{user:window.actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:(name,p)=>fetch('/rpc',{method:'POST',body:JSON.stringify({name,p})}).then(r=>r.json())}}});
  for(const source of sources)await page.addScriptTag({content:source});
  const input=()=>page.getByPlaceholder('Search by name, email or phone'),lastList=()=>calls.filter(c=>c.p_action==='list').at(-1);
  await input().waitFor();await input().fill('Fixture');const enterBefore=calls.filter(c=>c.p_action==='list').length;await input().press('Enter');await page.waitForTimeout(60);
  const enterWorked=calls.filter(c=>c.p_action==='list').length===enterBefore+1&&lastList().p_payload.search==='Fixture';
  if(process.env.REPRO){ok(!enterWorked,'original Enter defect');await page.getByRole('button',{name:'Search',exact:true}).click()}else ok(enterWorked,'Enter submits one filtered request');
  await page.getByRole('heading',{name:'Fixture Page 0 Contact 0',exact:true}).waitFor();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('heading',{name:'Fixture Page 1 Contact 0',exact:true}).waitFor();
  await page.getByRole('button',{name:'Review Person & follow-up'}).first().click();await page.getByRole('button',{name:'Back to People',exact:true}).click();await input().waitFor();
  if(process.env.REPRO){ok(lastList().p_payload.search===''&&lastList().p_payload.page===1,'original Back loses filter and retains page');console.log(JSON.stringify({engine,width,enterWorked,backPayload:lastList().p_payload}));await page.close();continue}
  ok(lastList().p_payload.search==='Fixture'&&lastList().p_payload.page===1,'Back preserves scoped filter and page');ok(await input().inputValue()==='Fixture','filter text restored');
  await input().fill('Fresh');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('heading',{name:'Fresh Page 0 Contact 0',exact:true}).waitFor();ok(lastList().p_payload.page===0,'new search resets page');
  await page.getByLabel('Organization',{exact:true}).selectOption('org-b');await input().waitFor();ok(lastList().p_org==='org-b'&&lastList().p_payload.search===''&&lastList().p_payload.page===0,'organization switch clears filter and page');
  await input().fill('Private A');await input().press('Enter');await page.getByRole('heading',{name:'Private A Page 0 Contact 0',exact:true}).waitFor();
  await page.evaluate(()=>{window.actor={id:'actor-b'};authChange('SIGNED_IN',{user:actor})});await input().waitFor();ok(lastList().p_payload.search===''&&lastList().p_payload.page===0,'account switch clears prior search');ok(!await page.locator('body').innerText().then(t=>t.includes('Private A')),'previous account query absent');
  // Hold an old list across account change; it must not restore query or rows.
  held=true;await input().fill('Old pending');await input().press('Enter');while(!release)await new Promise(r=>setTimeout(r,5));await page.evaluate(()=>{window.actor={id:'actor-c'};authChange('SIGNED_IN',{user:actor})});await input().waitFor();release();release=null;await page.waitForTimeout(50);ok(await input().inputValue()===''&&!await page.locator('body').innerText().then(t=>t.includes('Old pending')),'late list cannot restore old account query');
  await input().fill('Secret');await input().press('Enter');await input().waitFor();await page.evaluate(()=>authChange('SIGNED_OUT',null));ok(!await page.locator('body').innerText().then(t=>t.includes('Secret')),'logout clears search DOM');
  await page.evaluate(()=>{window.actor=null});await page.waitForTimeout(30);await page.evaluate(()=>{window.actor={id:'actor-d'};authChange('SIGNED_IN',{user:actor})});await input().waitFor();ok(lastList().p_payload.search==='','new login has empty search');
  // Shell pagehide/history protection clears memory; retained form handlers cannot search again.
  await input().fill('History private');await input().press('Enter');await input().waitFor();await page.evaluate(()=>{window.oldFilter=document.querySelector('form.staff-search');dispatchEvent(new Event('staff-protected-clear'))});const clearedCount=calls.length;await page.evaluate(()=>oldFilter.onsubmit(new Event('submit')));ok(calls.length===clearedCount,'protected clear rejects retained submit');ok(await page.locator('#outreach-people').innerText()==='','protected clear removes search DOM');
  await page.evaluate(()=>{window.actor={id:'actor-e'};authChange('SIGNED_IN',{user:actor})});await input().waitFor();ok(lastList().p_payload.search===''&&lastList().p_payload.page===0,'fresh authorized boot after clear has no previous query');
  denied=true;await input().fill('Denied');await input().press('Enter');await page.getByRole('alert').waitFor();ok(!await input().count()&&!await page.getByRole('button',{name:'Review Person & follow-up'}).count(),'permission denial removes query and contacts');
  ok(calls.every(c=>c.name==='staff_workspace_context'||['list','detail'].includes(c.p_action)),'zero mutation requests');ok(errors.length===0,'no browser errors');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} People navigation browser assertions PASS`);
