// Actual People runtime in real browsers; synthetic, origin-locked HTTP transport only.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://people.invalid',P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(n==='outreach-people.js'&&process.env.BASELINE_SOURCE?process.env.BASELINE_SOURCE:new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 if(process.env.TEST_BROWSER&&engine!==process.env.TEST_BROWSER)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),calls=[],tasks=[],errors=[];let caps=['people.read','followup.read','followup.manage'],hold=null,release=null,outcome=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   assert.equal(new URL(route.request().url()).origin,origin,'reject external traffic');
   const path=new URL(route.request().url()).pathname;
   if(path==='/rpc'||path==='/table'){
    const p=route.request().postDataJSON(),action=path==='/rpc'?(p.name==='staff_workspace_context'?'context':p.p.p_action):p.action;calls.push({action,...p});
    if(hold===action){hold=null;await new Promise(r=>release=r)}
    let data;
    if(action==='context')data={organizations:[{id:'org-a',name:'Organization A'},{id:'org-b',name:'Organization B'}],grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))};
    else if(action==='list')data=[{id:P,first_name:'Morgan',last_name:'Fixture',email:'fixture@example.test',relationships:[]},{id:Q,first_name:'Taylor',last_name:'Fixture',email:'fixture2@example.test',relationships:[]}];
    else if(action==='detail')data={person:{id:p.p.p_payload.person_id,first_name:p.p.p_payload.person_id===P?'Morgan':'Taylor',last_name:'Fixture'},relationships:[]};
    else if(action==='select')data=tasks.filter(t=>p.filters.every(([k,v])=>t[k]===v)).map(t=>({...t})).reverse();
    else if(action==='insert'){
     if(outcome==='denied'){outcome=null;await route.fulfill({json:{data:null,error:{code:'42501',message:'RAW_PRIVATE_ERROR'}}});return}
     if(outcome==='validation'){outcome=null;await route.fulfill({json:{data:null,error:{code:'23514',message:'RAW_PRIVATE_ERROR'}}});return}
     const id='aaaaaaaa-aaaa-4aaa-8aaa-'+String(tasks.length+1).padStart(12,'0');tasks.push({...p.payload,id,status:'open',revision:1});data={id};
     if(outcome==='lost'){outcome=null;await route.abort();return}
     if(outcome==='malformed'){outcome=null;data={}}
    }else if(action==='update'){
     if(outcome==='denied'){outcome=null;await route.fulfill({json:{data:null,error:{code:'42501',message:'RAW_PRIVATE_ERROR'}}});return}
     if(outcome==='validation'){outcome=null;await route.fulfill({json:{data:null,error:{code:'22008',message:'RAW_PRIVATE_ERROR'}}});return}
     const task=tasks.find(t=>p.filters.every(([k,v])=>t[k]===v));if(task){Object.assign(task,p.payload);task.revision++;data={id:task.id}}else data=null;
     if(outcome==='lost'){outcome=null;await route.abort();return}
     if(outcome==='malformed'){outcome=null;data={id:'wrong-task'}}
    }
    else throw Error('Unexpected request '+action);
    await route.fulfill({json:{data,error:null}});return;
   }
   await route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="staff-portal"><main id="outreach-people"></main></body></html>'});
  });
  await page.goto(origin+'/staff-people.html?org=org-a');
  await page.evaluate(()=>{
   window.actor={id:'actor-a'};window.session=true;window.shell=true;window.StaffWorkspace={active:()=>shell};
   const call=(path,p)=>fetch(path,{method:'POST',body:JSON.stringify(p)}).then(r=>r.json());
   window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>session&&actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:(name,p)=>call('/rpc',{name,p}),from:table=>{
    const p={table,action:'select',filters:[]};const q={select:columns=>(p.columns=columns,q),eq:(k,v)=>(p.filters.push([k,v]),q),order:()=>q,limit:()=>q,insert:payload=>(p.action='insert',p.payload=payload,q),update:payload=>(p.action='update',p.payload=payload,q),single:()=>q,maybeSingle:()=>q,then:(resolve,reject)=>call('/table',p).then(resolve,reject)};return q;
   }}};
  });
  await page.addStyleTag({content:readFileSync(new URL('../../assets/css/staff-portal.css',import.meta.url),'utf8')});for(const source of sources)await page.addScriptTag({content:source});
  const open=async(index=0)=>{await page.getByRole('button',{name:'Review Person & follow-up'}).nth(index).click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor()};
  const title=()=>page.getByLabel('Task title',{exact:true}),add=()=>page.getByRole('button',{name:'Add follow-up task',exact:true});
  const submit=async(text,due='')=>{await title().fill(text);await page.getByLabel('Due date (optional)').fill(due);await add().click()};
  const back=async()=>{await page.getByRole('button',{name:'Back to People',exact:true}).click();await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor()};
  const count=()=>calls.filter(c=>c.action==='update').length;
  const waitHeld=async()=>{for(let i=0;!release&&i<400;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release,'held request reached')};
  const reboot=async()=>{caps=['people.read','followup.read','followup.manage'];await page.evaluate(()=>{actor={id:'actor-'+Math.random()};session=true;shell=true;history.replaceState({},'',location.pathname+'?org=org-a');authChange('SIGNED_IN',{user:actor})});await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor();await open()};
  if(process.env.BASELINE_SOURCE)tasks.push({id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',organization_id:'org-a',person_id:P,title:'Welcome requested by guest',status:'open',due_on:'2026-11-10',revision:1});
  await open();
  const date=()=>page.getByLabel('Task due date',{exact:true}),save=()=>page.getByRole('button',{name:'Save due date',exact:true});
  const change=async value=>{await date().fill(value);await save().click()};
  if(process.env.BASELINE_SOURCE){ok(await save().count()===0,'baseline cannot reschedule existing follow-up');await page.close();continue}
  await submit('Welcome requested by guest','2026-11-10');await page.getByRole('heading',{name:'Welcome requested by guest',exact:true}).waitFor();ok(tasks.length===1&&tasks[0].revision===1,'existing creation starts the complete Person follow-up journey');
  let before=count();await save().click();ok(count()===before,'unchanged date does not write or audit');
  await page.evaluate(()=>window.oldSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save due date'));
  await change('2026-11-17');await page.getByText('open · 2026-11-17',{exact:true}).waitFor();
  let posted=calls.find(c=>c.action==='update');ok(JSON.stringify(posted.payload)===JSON.stringify({due_on:'2026-11-17'}),'reschedule writes only date');ok(JSON.stringify(posted.filters)===JSON.stringify([['organization_id','org-a'],['person_id',P],['id',tasks[0].id],['revision',1]]),'exact org/person/task/revision predicate');ok(posted.columns==='id','minimal returned task identity');ok(tasks[0].revision===2&&tasks[0].status==='open','reschedule preserves status');
  await page.evaluate(()=>oldSave.onclick());ok(count()===before+1,'old detached editor cannot write');
  await page.getByRole('button',{name:'Remove due date',exact:true}).click();await page.getByText('open · No due date',{exact:true}).waitFor();ok(tasks[0].due_on===null&&tasks[0].revision===3,'date cleared with explicit null');
  await page.getByLabel('Status').selectOption('completed');await page.getByRole('button',{name:'Save task status',exact:true}).click();await page.getByText('completed · No due date',{exact:true}).waitFor();ok(tasks[0].status==='completed'&&tasks[0].revision===4,'rescheduled task still completes with current revision');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-'+width+'-reschedule.png',fullPage:true})}
  before=count();hold='update';await date().fill('2026-12-01');await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save due date');window.pendingSave=b.onclick();b.onclick();[...document.querySelectorAll('button')].find(b=>b.textContent==='Save task status').onclick()});await waitHeld();ok(count()===before+1,'repeat date/status invocation cannot issue competing updates');release();release=null;await page.evaluate(()=>pendingSave);await page.getByText('completed · 2026-12-01',{exact:true}).waitFor();
  for(const mode of['lost','malformed','validation']){
   before=count();outcome=mode;await page.evaluate(()=>window.uncertainSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save due date'));await change('2026-12-'+(mode==='lost'?'02':mode==='malformed'?'03':'04'));await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).waitFor();ok(await save().count()===0,mode+' retires uncertain update controls');await page.evaluate(()=>uncertainSave.onclick());ok(count()===before+1,mode+' cannot replay update');ok(!(await page.locator('body').innerText()).includes('RAW_PRIVATE_ERROR'),mode+' hides raw errors');await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await date().waitFor();ok(count()===before+1,mode+' review is read-only');ok(await date().inputValue()===tasks[0].due_on,mode+' refresh shows actual saved date');
  }
  // Another authorized editor won the revision race; do not overwrite it.
  tasks[0].due_on='2027-01-01';tasks[0].revision++;before=count();await change('2027-01-02');await page.getByText('Task changed or access was removed. Refresh the tasks before making another change.',{exact:true}).waitFor();ok(tasks[0].due_on==='2027-01-01','stale expected revision cannot overwrite concurrent date');await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await date().waitFor();ok(await date().inputValue()==='2027-01-01'&&count()===before+1,'conflict recovery reads latest date without replay');
  for(const missing of['followup.read','followup.manage','people.read']){
   await reboot();caps=['people.read','followup.read','followup.manage'].filter(k=>k!==missing);before=count();await change('2027-02-01');await page.getByRole('alert').waitFor();ok(count()===before,'fresh missing '+missing+' denies update');ok(await save().count()===0,'denial clears date editor');
  }
  await reboot();await back();caps=['people.read','followup.read'];await open();ok(await save().count()===0,'read-only staff sees no date control');
  for(const transition of['person','account','url','clear','client','owner','auth','session','shell']){
   await reboot();before=count();hold='context';await page.evaluate(()=>window.transitionSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save due date'));await change('2027-03-01');await waitHeld();
   if(transition==='person'){await back();await open(1)}
   if(transition==='account')await page.evaluate(()=>{actor={id:'new-actor'};authChange('SIGNED_IN',{user:actor})});
   if(transition==='url')await page.evaluate(()=>history.pushState({},'',location.pathname+'?org=org-b'));
   if(transition==='clear')await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));
   if(transition==='client')await page.evaluate(()=>{window.savedClient=ChampionLifeAuth.client;ChampionLifeAuth.client={...savedClient}});
   if(transition==='owner')await page.evaluate(()=>{window.savedAuth=ChampionLifeAuth;window.ChampionLifeAuth={...savedAuth}});
   if(transition==='auth')await page.evaluate(()=>{window.savedClientAuth=ChampionLifeAuth.client.auth;ChampionLifeAuth.client.auth={...savedClientAuth}});
   if(transition==='session')await page.evaluate(()=>session=false);
   if(transition==='shell')await page.evaluate(()=>shell=false);
   release();release=null;await page.waitForTimeout(70);ok(count()===before,transition+' transition prevents update');
   if(transition==='client')await page.evaluate(()=>ChampionLifeAuth.client=savedClient);
   if(transition==='owner')await page.evaluate(()=>window.ChampionLifeAuth=savedAuth);
   if(transition==='auth')await page.evaluate(()=>ChampionLifeAuth.client.auth=savedClientAuth);
   if(['client','owner','auth'].includes(transition)){await page.evaluate(()=>transitionSave.onclick());ok(count()===before,'restored '+transition+' cannot revive editor');ok(await date().count()===0,'observed '+transition+' replacement clears editor')}
  }
  await reboot();hold='update';await change('2027-04-01');await waitHeld();await back();await open(1);release();release=null;await page.waitForTimeout(70);ok(await page.getByRole('heading',{name:'Taylor Fixture',exact:true}).isVisible(),'late accepted update cannot restore previous Person');ok(await date().count()===0,'late date does not appear under another Person');
  await reboot();outcome='denied';await change('2027-05-01');await page.getByRole('alert').waitFor();ok(await save().count()===0,'backend denial clears editor');ok(!(await page.locator('body').innerText()).includes('RAW_PRIVATE_ERROR'),'backend denial hides raw error');
  ok(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'no browser task storage');ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} Church guest follow-up reschedule browser assertions PASS`);
