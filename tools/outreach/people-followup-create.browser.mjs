// Actual People runtime in real browsers; synthetic, origin-locked HTTP transport only.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://people.invalid',P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(n==='outreach-people.js'&&process.env.BASELINE_SOURCE?process.env.BASELINE_SOURCE:new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
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
    }else if(action==='update'){const task=tasks.find(t=>p.filters.every(([k,v])=>t[k]===v));if(task){Object.assign(task,p.payload);task.revision++;data={id:task.id}}else data=null}
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
  const count=()=>calls.filter(c=>c.action==='insert').length;
  const waitHeld=async()=>{for(let i=0;!release&&i<400;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release,'held request reached')};
  const reboot=async()=>{caps=['people.read','followup.read','followup.manage'];await page.evaluate(()=>{actor={id:'actor-'+Math.random()};session=true;shell=true;history.replaceState({},'',location.pathname+'?org=org-a');authChange('SIGNED_IN',{user:actor})});await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor();await open()};
  await open();
  if(process.env.BASELINE_SOURCE){ok(await add().count()===0,'baseline authorized People detail cannot create follow-up');console.log(JSON.stringify({engine,width,baselineMissingCreate:true}));await page.close();continue}
  let before=count();await submit('   ');ok(count()===before,'whitespace title never submits');ok(await page.getByRole('status').innerText()==='Enter a task title using 1–180 characters.','safe actionable validation');
  await page.evaluate(()=>window.oldCreate=document.querySelector('form'));
  await submit('Call about requested next step','2026-11-10');await page.getByRole('heading',{name:'Call about requested next step',exact:true}).waitFor();
  ok(count()===before+1,'one task created');const posted=calls.find(c=>c.action==='insert');ok(JSON.stringify(posted.payload)===JSON.stringify({organization_id:'org-a',person_id:P,title:'Call about requested next step',due_on:'2026-11-10'}),'only exact existing allowed fields sent');ok(posted.columns==='id','minimal returned identity only');
  await page.evaluate(()=>oldCreate.onsubmit(new Event('submit')));ok(count()===before+1,'retired create form cannot duplicate');
  await page.getByLabel('Status').selectOption('completed');await page.getByRole('button',{name:'Save task status',exact:true}).click();await page.getByText('completed · 2026-11-10',{exact:true}).waitFor();ok(tasks[0].status==='completed'&&tasks[0].revision===2,'new task uses existing revision-guarded completion');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-'+width+'-followup.png',fullPage:true})}
  before=count();hold='insert';await title().fill('One request only');await page.evaluate(()=>{const f=document.querySelector('form');window.pendingCreate=f.onsubmit(new Event('submit'));f.onsubmit(new Event('submit'))});await waitHeld();ok(count()===before+1,'double retained invocation submits once');release();release=null;await page.evaluate(()=>pendingCreate);await page.getByRole('heading',{name:'One request only',exact:true}).waitFor();ok(tasks.at(-1).due_on===null,'optional due date is null');
  for(const mode of['lost','malformed','validation']){
   before=count();outcome=mode;await page.evaluate(()=>window.uncertainForm=document.querySelector('form'));await submit('Uncertain '+mode);await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).waitFor();ok(await add().count()===0,mode+' retires uncertain create form');await page.evaluate(()=>uncertainForm.onsubmit(new Event('submit')));ok(count()===before+1,mode+' does not retry insert');ok(!(await page.locator('body').innerText()).includes('RAW_PRIVATE_ERROR'),mode+' never exposes raw error');await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await title().waitFor();ok(count()===before+1,mode+' refresh reads without inserting');if(mode!=='validation')ok(await page.getByRole('heading',{name:'Uncertain '+mode,exact:true}).count()===1,mode+' discovers already committed task');
  }
  // Fresh permissions may lose manage between rendering and submit.
  caps=['people.read','followup.read'];before=count();await submit('Do not create');await page.getByRole('alert').waitFor();ok(count()===before,'lost management permission prevents insert');ok(await add().count()===0,'denial retires form');
  await reboot();await back();caps=['people.read'];await page.getByRole('button',{name:'Review Person & follow-up'}).first().click();await page.getByRole('heading',{name:'Morgan Fixture',exact:true}).waitFor();ok(await add().count()===0,'missing followup.read has no create form');
  // An outstanding permission request cannot authorize the old person or account.
  for(const transition of['person','account','url','clear','client','owner','auth','session']){
   await reboot();before=count();hold='context';await page.evaluate(()=>window.transitionForm=document.querySelector('form'));await submit('Stale '+transition);await waitHeld();
   if(transition==='person'){await back();await open(1)}
   if(transition==='account')await page.evaluate(()=>{actor={id:'new-actor'};authChange('SIGNED_IN',{user:actor})});
   if(transition==='url')await page.evaluate(()=>history.pushState({},'',location.pathname+'?org=org-b'));
   if(transition==='clear')await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));
   if(transition==='client')await page.evaluate(()=>{window.savedClient=ChampionLifeAuth.client;ChampionLifeAuth.client={...savedClient}});
   if(transition==='owner')await page.evaluate(()=>{window.savedAuth=ChampionLifeAuth;window.ChampionLifeAuth={...savedAuth}});
   if(transition==='auth')await page.evaluate(()=>{window.savedClientAuth=ChampionLifeAuth.client.auth;ChampionLifeAuth.client.auth={...savedClientAuth}});
   if(transition==='session')await page.evaluate(()=>session=false);
   release();release=null;await page.waitForTimeout(70);ok(count()===before,transition+' transition prevents insert');
   if(transition==='client')await page.evaluate(()=>ChampionLifeAuth.client=savedClient);
   if(transition==='owner')await page.evaluate(()=>window.ChampionLifeAuth=savedAuth);
   if(transition==='auth')await page.evaluate(()=>ChampionLifeAuth.client.auth=savedClientAuth);
   if(['client','owner','auth'].includes(transition)){await page.evaluate(()=>transitionForm.onsubmit(new Event('submit')));ok(count()===before,'restored '+transition+' cannot revive retired form');ok(await title().count()===0,'observed '+transition+' replacement clears private editor')}
  }
  // A request already accepted cannot be canceled; late result cannot restore the old detail.
  await reboot();hold='insert';await submit('Late accepted');await waitHeld();await back();await open(1);release();release=null;await page.waitForTimeout(70);ok(await page.getByRole('heading',{name:'Taylor Fixture',exact:true}).isVisible(),'late accepted create cannot restore Morgan');ok(await page.getByRole('heading',{name:'Late accepted',exact:true}).count()===0,'late old-person task does not appear in new person');
  for(const mode of ['accepted','lost','validation']){
   await reboot();before=count();hold='insert';outcome=mode==='accepted'?null:mode;await page.evaluate(()=>window.previousAccountForm=document.querySelector('form'));await submit('Previous account '+mode);await waitHeld();await page.evaluate(()=>{actor={id:'replacement-without-callback'}});release();release=null;await page.getByRole('alert').waitFor();
   ok(await page.getByRole('heading',{name:'Morgan Fixture',exact:true}).count()===0,mode+' missed-callback response clears former Person');ok(await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).count()===0,mode+' cannot restore previous-account uncertain-save control');await page.evaluate(()=>previousAccountForm.onsubmit(new Event('submit')));ok(count()===before+1,mode+' retained old-account form sends zero further inserts');
  }
  await reboot();outcome='denied';await submit('Denied at insert');await page.getByRole('alert').waitFor();ok(await add().count()===0,'backend denial clears task create');ok(!(await page.locator('body').innerText()).includes('RAW_PRIVATE_ERROR'),'backend denial keeps raw error private');
  ok(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'task drafts never written to browser storage');ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} People follow-up creation browser assertions PASS`);
