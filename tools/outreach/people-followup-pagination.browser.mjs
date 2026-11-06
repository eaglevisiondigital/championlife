// Real browsers, actual People runtime, fictional origin-locked query transport.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const origin='https://people-pages.invalid',P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222';
const sources=['outreach-staff-common.js','outreach-people.js'].map(n=>readFileSync(n==='outreach-people.js'&&process.env.BASELINE_SOURCE?process.env.BASELINE_SOURCE:new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];
  let caps=['people.read','followup.read','followup.manage'],hold=null,release=null,readFailure=false;
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
     if(readFailure){readFailure=false;await route.fulfill({json:{data:null,error:{code:'XX000',message:'PRIVATE_QUERY_ERROR'}}});return}
     data=tasks.filter(t=>p.filters.every(([k,v])=>t[k]===v));
     data.sort((a,b)=>{for(const[k,opts]of p.order){const n=a[k].localeCompare(b[k]);if(n)return opts.ascending?n:-n}return 0});
     if(p.or){const match=/^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([a-f0-9-]+)\)$/.exec(p.or);assert.ok(match,'typed composite cursor');assert.equal(match[1],match[2]);data=data.filter(t=>t.created_at<match[1]||(t.created_at===match[1]&&t.id<match[3]))}data=data.slice(0,p.limit||100).map(t=>({...t}));
    }else if(action==='update'){const t=tasks.find(t=>p.filters.every(([k,v])=>t[k]===v));if(t){Object.assign(t,p.payload);t.revision++;data={id:t.id}}else data=null}
    else if(action==='insert'){const t=task(206);Object.assign(t,p.payload);tasks.push(t);data={id:t.id}}
    else throw Error('Unexpected action '+action);
    await route.fulfill({json:{data,error:null}});return;
   }
   await route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="staff-portal"><main id="outreach-people"></main></body></html>'});
  });
  await page.goto(origin+'/staff-people.html?org=org-a');
  await page.evaluate(()=>{
   window.actor={id:'actor-a'};window.shell=true;window.StaffWorkspace={active:()=>shell};
   const call=(path,p)=>fetch(path,{method:'POST',body:JSON.stringify(p)}).then(r=>r.json());
   window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:(name,p)=>call('/rpc',{name,p}),from:table=>{
    const p={table,action:'select',filters:[],order:[]};const q={select:columns=>(p.columns=columns,q),eq:(k,v)=>(p.filters.push([k,v]),q),order:(k,opts)=>(p.order.push([k,opts]),q),limit:n=>(p.limit=n,q),or:value=>(p.or=value,q),update:payload=>(p.action='update',p.payload=payload,q),insert:payload=>(p.action='insert',p.payload=payload,q),single:()=>q,maybeSingle:()=>q,then:(resolve,reject)=>call('/table',p).then(resolve,reject)};return q;
   }}};
  });
  await page.addStyleTag({content:readFileSync(new URL('../../assets/css/staff-portal.css',import.meta.url),'utf8')});for(const source of sources)await page.addScriptTag({content:source});
  const open=async(index=0)=>{await page.getByRole('button',{name:'Review Person & follow-up'}).nth(index).click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor()};
  const older=()=>page.getByRole('button',{name:'Older tasks',exact:true}),newer=()=>page.getByRole('button',{name:'Newer tasks',exact:true});
  const visible=()=>page.locator('h4').allTextContents().then(a=>a.filter(t=>/^Task \d+$/.test(t)));
  const back=async()=>{await page.getByRole('button',{name:'Back to People',exact:true}).click();await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor()};
  const waitHeld=async()=>{for(let i=0;!release&&i<400;i++)await new Promise(r=>setTimeout(r,5));assert.ok(release,'held request reached')};
  const reboot=async()=>{caps=['people.read','followup.read','followup.manage'];await page.evaluate(()=>{shell=true;actor={id:'actor-'+Math.random()};authChange('SIGNED_IN',{user:actor})});await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor();await open()};
  await open();
  if(process.env.BASELINE_SOURCE){
   ok((await visible()).length===100,'baseline returns its capped first 100 tasks');ok(!await page.getByRole('heading',{name:'Task 205',exact:true}).count(),'baseline omits an existing open task');ok(await older().count()===0,'baseline provides no route to omitted tasks');console.log(JSON.stringify({engine,width,baselineUnreachableOpenTasks:105}));await page.close();continue;
  }
  const seen=[...await visible()];ok(seen.length===100&&seen[0]==='Task 205'&&seen.at(-1)==='Task 106','first page deterministic with tied creation timestamps');ok(await newer().count()===0,'first page has no previous control');
  const firstRead=calls.find(c=>c.action==='select');ok(firstRead.limit===101&&!firstRead.or,'101 row bounded lookahead without offset');ok(JSON.stringify(firstRead.order)===JSON.stringify([['created_at',{ascending:false}],['id',{ascending:false}]]),'unique ordering tie break');ok(JSON.stringify(firstRead.filters)===JSON.stringify([['organization_id','org-a'],['person_id',P]]),'exact org/person filters');
  await older().focus();await page.keyboard.press('Enter');await page.getByText('Task page 2',{exact:true}).waitFor();seen.push(...await visible());ok(seen.at(-1)==='Task 006','keyboard opens middle page');
  tasks.push(task(300));tasks=tasks.filter(t=>t.id!==task(180).id);
  await older().click();await page.getByText('Task page 3',{exact:true}).waitFor();seen.push(...await visible());ok(seen.length===205&&new Set(seen).size===205,'205 original tasks visited once despite newer insertion/deletion');ok(!seen.includes('Task 300'),'newer concurrent insertion does not shift older cursor pages');const lastRead=calls.filter(c=>c.action==='select').at(-1);ok(lastRead.or.includes('2026-11-01T12:00:00.123456+00:00'),'cursor preserves microseconds and explicit timezone');ok(await older().count()===0,'last page has no older control');ok(await newer().count()===1,'last page can go back');ok(!seen.includes('Task 999')&&!seen.includes('Task 998'),'other person and organization absent');
  await page.getByLabel('Status').last().selectOption('completed');await page.getByRole('button',{name:'Save task status',exact:true}).last().click();await page.getByText('completed · 2026-11-10',{exact:true}).waitFor();ok(await page.getByText('Task page 3',{exact:true}).count()===1,'status save stays on current task page');
  const write=calls.find(c=>c.action==='update');ok(write.filters.some(([k,v])=>k==='id'&&v.endsWith('000000000001'))&&write.filters.some(([k,v])=>k==='revision'&&v===1),'oldest task retains exact identity/revision guard');
  await newer().click();await page.getByText('Task page 2',{exact:true}).waitFor();ok((await visible())[0]==='Task 105','newer page works');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-'+width+'-task-pages.png',fullPage:true})}
  await page.getByLabel('Task title',{exact:true}).fill('Newly requested follow-up');await page.getByRole('button',{name:'Add follow-up task',exact:true}).click();await page.getByRole('heading',{name:'Newly requested follow-up',exact:true}).waitFor();ok(await newer().count()===0,'new task returns to latest page');ok(calls.filter(c=>c.action==='insert').length===1,'one explicit creation only');
  // Each page is freshly authorized; read-only staff can navigate without mutation controls.
  await back();caps=['people.read','followup.read'];await open();ok(await page.getByRole('button',{name:'Save task status',exact:true}).count()===0,'read-only has no write control');await older().click();await page.getByText('Task page 2',{exact:true}).waitFor();ok((await visible()).length===100,'read-only can view next page');
  // An empty later page is not described as an empty entire task list.
  tasks=tasks.filter(t=>t.person_id!==P||t.organization_id!=='org-a'||t.id.endsWith('000000000206'));await older().click();await page.getByText('No tasks on this page. Return to newer tasks or refresh the latest tasks.',{exact:true}).waitFor();ok(await newer().count()===1,'concurrently emptied page remains navigable');
  tasks=[...Array.from({length:205},(_,i)=>task(i+1)),task(999,Q),task(998,P,'org-b')];await reboot();readFailure=true;await older().click();await page.getByRole('status').filter({hasText:'Unable to complete'}).waitFor();ok(!await page.getByText('No follow-up tasks.',{exact:true}).count(),'failed read never claims complete empty result');ok(!(await page.locator('body').innerText()).includes('PRIVATE_QUERY_ERROR'),'failed page hides raw errors');
  // Page controls cannot publish late data after person/account/shell transitions.
  for(const transition of['person','account','organization','clear']){
   await reboot();hold='select';await older().click();await waitHeld();
   if(transition==='person'){await back();await open(1)}
   if(transition==='account'){await page.evaluate(()=>{actor={id:'new-actor'};authChange('SIGNED_IN',{user:actor})});await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor()}
   if(transition==='organization'){await page.evaluate(()=>delete window.StaffWorkspace);await page.getByLabel('Organization',{exact:true}).selectOption('org-b');await page.getByRole('button',{name:'Review Person & follow-up'}).first().waitFor();await open()}
   if(transition==='clear')await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));
   release();release=null;await page.waitForTimeout(50);ok(!await page.getByRole('heading',{name:'Task 105',exact:true}).count(),transition+' rejects late task page');
  }
  await reboot();await page.evaluate(()=>window.oldPage=[...document.querySelectorAll('button')].find(b=>b.textContent==='Older tasks'));await back();await open(1);let before=calls.length;await page.evaluate(()=>oldPage.onclick());ok(calls.length===before,'detached page handler does not query old person');
  await reboot();hold='select';await older().click();await waitHeld();caps=['people.read'];release();release=null;await page.getByRole('alert').waitFor();ok(!await page.getByRole('heading',{name:'Task 105',exact:true}).count(),'post-query revocation clears protected page');
  await reboot();caps=['people.read'];before=calls.filter(c=>c.action==='select').length;await older().click();await page.getByRole('heading',{name:'Morgan Fixture',exact:true}).waitFor();ok(calls.filter(c=>c.action==='select').length===before,'pre-query revoked follow-up permission issues no task read');
  // Exact lookahead boundaries, empty authorized lists and malformed cursor fields.
  for(const size of[0,100,101,200]){
   tasks=Array.from({length:size},(_,i)=>task(i+1));await reboot();ok((await visible()).length===Math.min(size,100),'bounded visible count '+size);ok(await older().count()===(size>100?1:0),'exact lookahead boundary '+size);
   if(size>100){await older().click();await page.getByText('Task page 2',{exact:true}).waitFor();ok((await visible()).length===size-100&&await older().count()===0,'final boundary '+size)}
   if(size===0)ok(await page.getByText('No follow-up tasks.',{exact:true}).count()===1,'empty first page is explicit');
  }
  tasks=Array.from({length:101},(_,i)=>task(i+1));tasks.forEach(t=>t.created_at='not-a-timestamp');await reboot();ok(await older().count()===0,'malformed boundary timestamp cannot create cursor');ok(await page.getByRole('status').innerText()==='Unable to load older tasks. Please refresh and try again.','malformed cursor reports unavailable navigation');
  ok(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'no task snapshots in browser storage');ok(errors.length===0,'no browser exceptions');console.log(JSON.stringify({engine,width,checks}));await page.close();
 }
 await browser.close();
}
console.log(`${checks} People follow-up pagination browser assertions PASS`);
