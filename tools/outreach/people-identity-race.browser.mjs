// Actual People runtime; fictional identities and intercepted services only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://people-identity.invalid',person='11111111-1111-4111-8111-111111111111';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,768,1440])for(const outcome of(process.env.REPRO?['old-user']:['old-user','old-null','old-error','logout'])){
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let deny=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'no external requests');
   if(u.pathname==='/fixture'){
    const p=route.request().postDataJSON();calls.push(p);let data;
    if(p.name==='staff_workspace_context')data={organizations:[{id:'org-a',name:'Synthetic organization'}],grants:['people.read','followup.read','followup.manage'].map(permission=>({organization_id:'org-a',permission,department_ids:null}))};
    else if(p.name==='people_workspace')data=p.p.p_action==='list'?[{id:person,first_name:'Current',last_name:'Person'}]:{person:{id:person,first_name:'Current',last_name:'Person'},relationships:[]};
    else if(p.name==='task-read')data=[{id:'task-a',title:'Current follow-up',status:'open',revision:2}];
    else if(p.name==='task-write')data={id:'task-a'};
    else throw Error('Unexpected fixture request');
    await route.fulfill({json:deny?{data:null,error:{code:'42501'},status:403}:{data,error:null}});return;
   }
   await route.fulfill({contentType:'text/html',body:'<main id="outreach-people"></main>'});
  });
  await page.goto(origin+'/staff-people.html?org=org-a');
  await page.evaluate(()=>{
   window.actor={id:'actor-a'};let first=true;
   const run=(name,p)=>fetch('/fixture',{method:'POST',body:JSON.stringify({name,p,actor:window.actor?.id})}).then(r=>r.json());
   window.ChampionLifeAuth={getUser:()=>first?(first=false,new Promise((resolve,reject)=>{window.oldResolve=resolve;window.oldReject=reject})):Promise.resolve(window.actor),getSession:async()=>window.actor?{user:window.actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:run,from:table=>{
    assertTable(table);const filters=[];let value;
    const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},order:()=>q,limit:()=>run('task-read',{filters}),update:v=>{value=v;return q},maybeSingle:()=>run('task-write',{filters,value})};return q;
   }}};
   function assertTable(table){if(table!=='followup_tasks')throw Error('Unexpected table')}
  });
  for(const source of sources)await page.addScriptTag({content:source});
  await page.evaluate(()=>{window.actor={id:'actor-b'};authChange('SIGNED_IN',{user:actor})});
  await page.getByRole('heading',{name:'Current Person',exact:true}).waitFor();
  ok(calls.length>0&&calls.every(c=>c.actor==='actor-b'),'only verified current B loaded People');
  const before=calls.length;
  if(outcome==='logout'){
   await page.evaluate(()=>{window.actor=null;authChange('SIGNED_OUT',null)});
   await page.getByRole('link',{name:'Sign in to your workspace'}).waitFor();
  }
  await page.evaluate(outcome=>{if(outcome==='old-error')oldReject(Error('PRIVATE_STALE_IDENTITY_ERROR'));else oldResolve(outcome==='old-null'?null:{id:'actor-a'})},outcome);
  await page.waitForTimeout(30);
  ok(calls.length===before,'stale verification issues no RPC');
  if(outcome==='logout'){
   ok(!await page.getByRole('heading',{name:'Current Person',exact:true}).count(),'late identity cannot restore signed-out People');
   await page.evaluate(()=>{window.actor={id:'actor-b'};authChange('SIGNED_IN',{user:actor})});
   await page.getByRole('heading',{name:'Current Person',exact:true}).waitFor();
  }
  const input=page.getByPlaceholder('Search by name, email or phone');
  await input.fill('Current');await input.press('Enter');
  if(process.env.REPRO&&outcome==='old-user'){
   await page.getByRole('alert').waitFor();ok((await page.locator('body').innerText()).includes('Your session has expired'),'baseline late A falsely expires current B');
   console.log(JSON.stringify({engine,width,outcome,reproduced:true}));await page.close();continue;
  }
  await page.getByRole('heading',{name:'Current Person',exact:true}).waitFor();
  ok(!await page.getByRole('alert').count(),'current B remains authorized after stale verification');
  await page.getByRole('button',{name:'Review Person & follow-up'}).click();
  await page.getByRole('heading',{name:'Current follow-up',exact:true}).waitFor();
  await page.getByLabel('Status').selectOption('completed');
  const refreshedDetail=page.waitForResponse(r=>r.url()===origin+'/fixture'&&r.request().postDataJSON().name==='people_workspace'&&r.request().postDataJSON().p.p_action==='detail');
  await page.getByRole('button',{name:'Save task status',exact:true}).click();await refreshedDetail;
  await page.getByRole('heading',{name:'Current follow-up',exact:true}).waitFor();
  const writes=calls.filter(c=>c.name==='task-write');
  ok(writes.length===1&&writes[0].actor==='actor-b'&&writes[0].p.value.status==='completed','current B saves one current task');
  ok(['organization_id','person_id','id','revision'].every(k=>writes[0].p.filters.some(([key])=>key===k)),'existing scoped task revision filters preserved');
  ok(calls.every(c=>c.actor==='actor-b'),'no stale A service request');
  deny=true;await page.getByRole('button',{name:'Back to People',exact:true}).click();
  await page.getByRole('alert').waitFor();
  ok(!await page.getByRole('heading',{name:'Current Person',exact:true}).count()&&!await page.getByRole('heading',{name:'Current follow-up',exact:true}).count(),'current permission denial still clears Person and tasks');
  ok(!(await page.locator('body').innerText()).includes('PRIVATE_STALE_IDENTITY_ERROR'),'raw stale error never displayed');
  ok(errors.length===0,'no unhandled browser errors');
  console.log(JSON.stringify({engine,width,outcome,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} People identity race browser assertions PASS`);
