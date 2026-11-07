// Real browsers, actual People runtime, fictional origin-locked query transport.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://people-pages.invalid',P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(n==='outreach-people.js'&&process.env.BASELINE_SOURCE?process.env.BASELINE_SOURCE:new URL('../../assets/js/'+n,import.meta.url),'utf8'));
// PR86 da658ea4c0fd9590e969bbc6ad772f02b3a99b12 reuses PR85 a9dc5260765bcaea8ad18af34ae91270c10b7cfb.
// Exact reviewed adaptations: page/filter arguments and the two page/filter detail returns.
const runtime=sources[1];
if(!process.env.BASELINE_SOURCE){
 let helper=runtime.slice(runtime.indexOf(' function addTaskActions('),runtime.indexOf(' async function detail('));
 for(const [adapted,original,count] of [
  ['personId,g,taskCursors,taskStatus){','personId,g){',1],
  ['detail(personId,taskCursors,taskStatus)','detail(personId)',2],
 ]){
  assert.equal(helper.split(adapted).length-1,count,'exact reviewed helper adaptation count: '+adapted);
  helper=helper.replaceAll(adapted,original);
 }
 assert.equal(createHash('sha256').update(helper).digest('hex'),'8e67f1056799b5f7b4a7cbb580c420672b61e23b50cdd9949b2260d18ef0e374','accepted PR85/86 helper except exact reviewed page/filter return adaptation');
}
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,768,1440]){
  if(process.env.TEST_WIDTH&&Number(process.env.TEST_WIDTH)!==width)continue;
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];
  let caps=['people.read','followup.read','followup.manage'],hold=null,release=null,readFailure=false,outcome=null;
  const task=(i,person=P,organization='org-a')=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0'),organization_id:organization,person_id:person,title:'Task '+String(i).padStart(3,'0'),created_at:'2026-11-01T12:00:00.123456+00:00',status:'open',due_on:'2026-11-10',revision:1});
  let tasks=[...Array.from({length:205},(_,i)=>task(i+1)),task(999,Q),task(998,P,'org-b')];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'external traffic rejected');
   if(u.pathname==='/rpc'||u.pathname==='/table'){
    const p=route.request().postDataJSON(),action=u.pathname==='/rpc'?(p.name==='staff_workspace_context'?'context':p.p.p_action):p.action;calls.push({action,...p});
    if(hold===action){hold=null;await new Promise(r=>release=r)}
    let data;
    if(action==='context')data={organizations:['org-a','org-b'].map(id=>({id,name:id})),grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))};
    else if(action==='list')data=[{id:P,first_name:'Morgan',last_name:'Fixture'},{id:Q,first_name:'Taylor',last_name:'Fixture'}];
    else if(action==='detail')data={person:{id:p.p.p_payload.person_id,first_name:p.p.p_payload.person_id===P?'Morgan':'Taylor',last_name:'Fixture'},relationships:[]};
    else if(action==='select'){
     if(readFailure){readFailure=false,outcome=null;await route.fulfill({json:{data:null,error:{code:'XX000',message:'PRIVATE_QUERY_ERROR'}}});return}
     data=tasks.filter(t=>p.filters.every(([k,v])=>t[k]===v));
     data.sort((a,b)=>{for(const[k,opts]of p.order){const n=a[k].localeCompare(b[k]);if(n)return opts.ascending?n:-n}return 0});
     if(p.or){const match=/^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([a-f0-9-]+)\)$/.exec(p.or);assert.ok(match,'typed composite cursor');assert.equal(match[1],match[2]);data=data.filter(t=>t.created_at<match[1]||(t.created_at===match[1]&&t.id<match[3]))}data=data.slice(0,p.limit||100).map(t=>({...t}));
    }else if(action==='update'){if(outcome==='denied'){outcome=null;await route.fulfill({json:{data:null,error:{code:'42501',message:'PRIVATE_UPDATE_ERROR'}}});return}const t=tasks.find(t=>p.filters.every(([k,v])=>t[k]===v));if(t){Object.assign(t,p.payload);t.revision++;data={id:t.id}}else data=null;if(outcome==='lost'){outcome=null;await route.abort();return}if(outcome==='malformed'){outcome=null;data={id:'wrong-task'}}}
    else if(action==='insert'){const t=task(206);Object.assign(t,p.payload);tasks.push(t);data={id:t.id}}
    else throw Error('Unexpected action '+action);
    await route.fulfill({json:{data,error:null}});return;
   }
   await route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="staff-portal"><main id="outreach-people"></main></body></html>'});
  });
  await page.goto(origin+'/staff-people.html?org=org-a');
  await page.evaluate(()=>{
   window.actor={id:'actor-a'};window.session=true;window.shell=true;window.StaffWorkspace={active:()=>shell};
   const call=(path,p)=>fetch(path,{method:'POST',body:JSON.stringify(p)}).then(r=>r.json());
   window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>session&&actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:(name,p)=>call('/rpc',{name,p}),from:table=>{
    const p={table,action:'select',filters:[],order:[]};const q={select:columns=>(p.columns=columns,q),eq:(k,v)=>(p.filters.push([k,v]),q),order:(k,opts)=>(p.order.push([k,opts]),q),limit:n=>(p.limit=n,q),or:value=>(p.or=value,q),update:payload=>(p.action='update',p.payload=payload,q),insert:payload=>(p.action='insert',p.payload=payload,q),single:()=>q,maybeSingle:()=>q,then:(resolve,reject)=>call('/table',p).then(resolve,reject)};return q;
   }}};
  });
  await page.addStyleTag({content:readFileSync(new URL('../../assets/css/staff-portal.css',import.meta.url),'utf8')});for(const source of sources)await page.addScriptTag({content:source});
  const open=async(index=0)=>{await page.getByRole('button',{name:'Review Person & follow-up'}).nth(index).click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor()};
  const older=()=>page.getByRole('button',{name:'Older tasks',exact:true}),newer=()=>page.getByRole('button',{name:'Newer tasks',exact:true});
  const visible=()=>page.locator('h4').allTextContents().then(a=>a.filter(t=>/^Task \d+$/.test(t)));
  const back=async()=>{await page.getByRole('button',{name:'Back to People',exact:true}).click();await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor()};
  const waitHeld=async()=>{for(let i=0;!release&&i<400;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release,'held request reached')};
  const reboot=async()=>{caps=['people.read','followup.read','followup.manage'];await page.evaluate(()=>{shell=true;window.StaffWorkspace={active:()=>shell};session=true;history.replaceState({},'',location.pathname+'?org=org-a');actor={id:'actor-'+Math.random()};authChange('SIGNED_IN',{user:actor})});await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor();await open()};
  const writes=()=>calls.filter(c=>c.action==='update');
  const target=()=>page.locator('article').filter({has:page.getByRole('heading',{name:'Task 105',exact:true})});
  const date=()=>target().getByLabel('Task due date',{exact:true}),save=()=>target().getByRole('button',{name:'Save due date',exact:true});
  const ready=async()=>{await page.getByText('Task page 2',{exact:true}).waitFor();await date().waitFor()};
  const second=async()=>{await older().click();await ready()};
  const change=async(value,wait=true)=>{await date().fill(value);const old=await save().elementHandle();await save().click();if(wait)try{await page.waitForFunction(e=>!e.isConnected,old)}catch(e){console.log(JSON.stringify({diagnostic:'save did not retire',engine,width,value,actual:await date().inputValue(),status:await page.getByRole('status').innerText(),writes:writes().slice(-2)}));throw e}};
  const row=()=>tasks.find(t=>t.id===task(105).id);
  const readCount=()=>calls.filter(c=>c.action==='select').length;
  await open();await older().click();await page.getByText('Task page 2',{exact:true}).waitFor();
  if(process.env.BASELINE_SOURCE){ok(await save().count()===0,'PR72 pagination has no accepted date editor on older page');await page.close();continue}
  ok((await visible()).length===100&&(await visible())[0]==='Task 105','PR72 page2 boundary preserved');
  let before=writes().length;await save().click();ok(writes().length===before,'unchanged due date has no write');
  await target().getByRole('button',{name:'Remove due date',exact:true}).evaluate(e=>e.onclick());await ready();ok(row().due_on===null,'explicit removal clears existing date');
  before=writes().length;await target().getByRole('button',{name:'Remove due date',exact:true}).click();ok(writes().length===before,'already empty date has no write');
  // Browser native date validity is checked before any permission RPC/write.
  before=calls.length;await date().evaluate(e=>e.setCustomValidity('Synthetic invalid date'));await save().click();ok(calls.length===before,'invalid date has no network activity');await date().evaluate(e=>e.setCustomValidity(''));
  await save().evaluate(e=>window.detachedSave=e);await change('2026-11-17');await ready();await page.getByText('open · 2026-11-17',{exact:true}).waitFor();
  const posted=writes().at(-1);ok(JSON.stringify(posted.payload)===JSON.stringify({due_on:'2026-11-17'}),'reschedule writes only date');ok(JSON.stringify(posted.filters)===JSON.stringify([['organization_id','org-a'],['person_id',P],['id',row().id],['revision',2]]),'exact older task identity and revision');ok(posted.columns==='id','minimal returned identity');
  before=calls.length;await page.evaluate(()=>detachedSave.onclick());ok(calls.length===before,'detached save after successful refresh performs no request');
  await target().getByRole('button',{name:'Remove due date',exact:true}).evaluate(e=>e.onclick());await ready();await target().getByText('open · No due date',{exact:true}).waitFor();ok(row().due_on===null,'explicit remove persists null');
  await target().getByLabel('Status').selectOption('completed');await target().getByRole('button',{name:'Save task status',exact:true}).evaluate(e=>e.onclick());await ready();await target().getByText('completed · No due date',{exact:true}).waitFor();ok(row().status==='completed'&&row().revision===5,'status remains usable after date/remove');
  ok(await newer().count()===1&&await older().count()===1,'both page directions retained after edits');
  before=writes().length;hold='update';await date().fill('2026-12-01');await save().evaluate(e=>{window.pendingSave=e.onclick();e.onclick();e.parentElement.querySelector('button').onclick()});await waitHeld();ok(writes().length===before+1,'pending date/status cannot send competing updates');release();release=null;await page.evaluate(()=>pendingSave);await ready();
  for(const mode of['lost','malformed']){
   before=writes().length;outcome=mode;await save().evaluate(e=>window.uncertainSave=e);await change(mode==='lost'?'2026-12-02':'2026-12-03');await target().getByRole('button',{name:'Refresh follow-up tasks',exact:true}).waitFor();ok(await save().count()===0,mode+' removes save controls');await page.evaluate(()=>uncertainSave.onclick());ok(writes().length===before+1,mode+' cannot replay detached uncertain control');await target().getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await ready();ok(writes().length===before+1&&await date().inputValue()===row().due_on,mode+' reconciliation is read-only on same page');
  }
  row().due_on='2027-01-01';row().revision++;before=writes().length;await change('2027-01-02');await target().getByText('Task changed or access was removed. Refresh the tasks before making another change.',{exact:true}).waitFor();ok(row().due_on==='2027-01-01','stale date cannot overwrite concurrent revision');await target().getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await ready();ok(await date().inputValue()==='2027-01-01'&&writes().length===before+1,'stale recovery reads latest older-page revision');
  // A concurrent new task cannot move the stable older-page cursor during edit refresh.
  tasks.push(task(300));tasks=tasks.filter(t=>t.id!==task(180).id);await change('2027-01-03');await ready();ok((await visible())[0]==='Task 105'&&!(await visible()).includes('Task 300'),'concurrent newer insertion/deletion does not shift edited page');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-'+width+'-due-page2.png',fullPage:true})}
  for(const transition of['newer','person','account','organization','clear','url','owner','client','auth','session','shell']){
   await reboot();await second();before=writes().length;hold='context';await save().evaluate(e=>window.transitionSave=e);await change('2027-02-01',false);await waitHeld();
   if(transition==='newer'){await newer().click();await page.getByText('Task page 1',{exact:true}).waitFor()}
   if(transition==='person'){await back();await open(1)}
   if(transition==='account')await page.evaluate(()=>{actor={id:'replacement'};authChange('SIGNED_IN',{user:actor})});
   if(transition==='organization'){await page.evaluate(()=>delete window.StaffWorkspace);await page.getByLabel('Organization',{exact:true}).selectOption('org-b');await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor()}
   if(transition==='clear')await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));
   if(transition==='url')await page.evaluate(()=>history.pushState({},'',location.pathname+'?org=org-b'));
   if(transition==='owner')await page.evaluate(()=>{window.savedAuth=ChampionLifeAuth;window.ChampionLifeAuth={...savedAuth}});
   if(transition==='client')await page.evaluate(()=>{window.savedClient=ChampionLifeAuth.client;ChampionLifeAuth.client={...savedClient}});
   if(transition==='auth')await page.evaluate(()=>{window.savedClientAuth=ChampionLifeAuth.client.auth;ChampionLifeAuth.client.auth={...savedClientAuth}});
   if(transition==='session')await page.evaluate(()=>session=false);
   if(transition==='shell')await page.evaluate(()=>shell=false);
   release();release=null;await page.waitForTimeout(70);ok(writes().length===before,transition+' while permission request pending denies date write');
   if(transition==='owner')await page.evaluate(()=>window.ChampionLifeAuth=savedAuth);
   if(transition==='client')await page.evaluate(()=>ChampionLifeAuth.client=savedClient);
   if(transition==='auth')await page.evaluate(()=>ChampionLifeAuth.client.auth=savedClientAuth);
   if(['owner','client','auth'].includes(transition)){before=calls.length;await page.evaluate(()=>transitionSave.onclick());ok(calls.length===before,'restored '+transition+' cannot revive retired editor')}
  }
  for(const missing of['people.read','followup.read','followup.manage']){
   await reboot();await second();caps=caps.filter(k=>k!==missing);before=writes().length;await change('2027-03-01');await page.getByRole('alert').waitFor();ok(writes().length===before&&await save().count()===0,'fresh '+missing+' revocation denies/clears older editor');
  }
  await reboot();await back();caps=['people.read','followup.read'];await open();await older().click();await page.getByText('Task page 2',{exact:true}).waitFor();ok(await page.getByRole('button',{name:'Save due date',exact:true}).count()===0,'read-only staff can page without date controls');
  await reboot();await second();hold='update';await change('2027-04-01',false);await waitHeld();await back();await open(1);release();release=null;await page.waitForTimeout(70);ok(await page.getByRole('heading',{name:'Taylor Fixture',exact:true}).count()===1&&!await page.getByRole('heading',{name:'Task 105',exact:true}).count(),'late accepted date update never restores prior person');
  await reboot();await second();outcome='denied';await change('2027-05-01');await page.getByRole('alert').waitFor();ok(await save().count()===0&&!(await page.locator('body').innerText()).includes('PRIVATE_UPDATE_ERROR'),'backend denial clears task data and hides raw error');
  ok(tasks.find(t=>t.id===task(999).id).revision===1&&tasks.find(t=>t.id===task(998).id).revision===1,'other person/org tasks unchanged');
  ok(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'no task browser persistence');ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} People accepted follow-up + pagination composition assertions PASS`);
