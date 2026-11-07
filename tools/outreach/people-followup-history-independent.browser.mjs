// Independent cases; actual-page/SDK synthetic routing scaffold reused from
// people-followup-history.browser.mjs. Assertions below are independently authored.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://history.invalid',backend='https://fictional-history.supabase.co',key='sb-fictional-history-auth-token';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',B='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',O='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',Q='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',P='dddddddd-dddd-4ddd-8ddd-ddddddddddd1',T='11111111-1111-4111-8111-111111111111';
const session=id=>{const exp=Math.floor(Date.now()/1000)+3600,user={id,email:'fictional@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01'};return{access_token:[{alg:'HS256',typ:'JWT'},{sub:id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.'),refresh_token:'fictional',token_type:'bearer',expires_at:exp,expires_in:3600,user}};
const event=(revision,change={})=>({id:'eeeeeeee-eeee-4eee-8eee-'+String(revision).padStart(12,'0'),organization_id:O,task_id:T,occurred_at:'2026-11-06T12:00:00.123456+00:00',action:revision===1?'created':'updated',before_status:revision===1?null:'open',after_status:'open',before_due:revision===1?null:'2026-11-10',after_due:revision===1?null:'2026-11-17',before_revision:revision===1?null:revision-1,after_revision:revision,...change});
const publicPaths=new Set(JSON.parse(readFileSync(resolve(root,'tools/site-build/public-files.json')))),sourceHashes={};let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const context=await browser.newContext({viewport:{width:engine==='chromium'?390:1440,height:950}}),page=await context.newPage(),calls=[],writes=[],errors=[],unexpected=[];
  let actor=A,caps=['people.read','followup.read'],rows=[event(3,{after_status:'completed',after_due:null}),event(2),event(1)],hold=false,release=null,outcome=null,taskExists=true;
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
   if(['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'].includes(req.url()))return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    let sub;try{sub=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
    if(u.pathname==='/auth/v1/user')return sub===actor?send(session(actor).user):send({message:'Fictional expired'},401);
    if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    const p=req.method()==='POST'?req.postDataJSON():null,name=u.pathname.split('/').at(-1),filters=Object.fromEntries(u.searchParams);calls.push({name,filters,p,sub,method:req.method()});
    if(name==='staff_workspace_context')return send({organizations:[{id:O,name:'Church A'},{id:Q,name:'Church B'}],grants:sub===A?[O,Q].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null}))):[]});
    if(name==='outreach_registration_workspace')return send([]);
    if(name==='forms_workspace'&&p?.p_action==='context')return send({capabilities:{profile:'private_draft_v1'},organizations:[]});
    if(name==='communications_workspace'&&p?.p_action==='context')return send({organizations:[],campaigns:[],external_delivery_enabled:false});
    if(name==='people_workspace')return send(p.p_action==='list'?[{id:P,first_name:'Fictional',last_name:p.p_org===O?'Person A':'Person B'}]:{person:{id:P,first_name:'Fictional',last_name:p.p_org===O?'Person A':'Person B'},relationships:[]});
    if(req.method()!=='GET'){writes.push({name,p});return send({code:'42501'},403)}
    if(name==='followup_tasks'){
     if(filters.id)return send(taskExists&&filters.id==='eq.'+T&&filters.person_id==='eq.'+P&&filters.organization_id==='eq.'+O?{id:T}:null);
     return send([{id:T,title:'Existing task',status:'open',due_on:'2026-11-10',revision:3,created_at:'2026-11-01T00:00:00Z'}]);
    }
    if(name==='followup_task_events'){
     const captured=structuredClone(rows),result=outcome;outcome=null;
     if(hold){hold=false;await new Promise(r=>release=r)}
     if(result)return send({code:result==='denied'?'42501':'XX000',message:'PRIVATE_ERROR_DO_NOT_RENDER'},result==='denied'?403:500);
     return send(captured);
    }
    unexpected.push(req.url());return route.abort();
   }
   if(u.origin!==origin){unexpected.push(req.url());return route.abort()}
   const path=u.pathname.slice(1);
   if(['seed','discipleship-login.html'].includes(path))return route.fulfill({body:'<!doctype html>Fictional authentication boundary',contentType:'text/html'});
   if(path==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   assert(publicPaths.has(path),'only actual public source '+path);
   const body=readFileSync(path==='assets/js/outreach-people.js'&&process.env.BASELINE_SOURCE?process.env.BASELINE_SOURCE:resolve(root,path));const hash=sha(body);if(sourceHashes[path])assert.equal(hash,sourceHashes[path]);sourceHashes[path]=hash;
   return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
  });
  const view=()=>page.getByRole('button',{name:'View task history',exact:true}),hide=()=>page.getByRole('button',{name:'Hide task history',exact:true}),panel=()=>page.getByRole('region',{name:'Recent task history'});
  const eventReads=()=>calls.filter(c=>c.name==='followup_task_events');
  const open=async()=>{await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).click();await page.getByRole('heading',{name:'Existing task',exact:true}).waitFor()};
  const fresh=async()=>{actor=A;caps=['people.read','followup.read'];taskExists=true;await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(A)});await page.goto(origin+'/staff-people.html?org='+O);await open()};
  const held=async()=>{for(let n=0;n<500&&!release;n++)await page.waitForTimeout(10);assert(release,'history held')};
  const delivered=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/rest/v1/followup_task_events');release();release=null;await(await response).finished();await page.waitForFunction(()=>![...document.querySelectorAll('[aria-label="Recent task history"]')].some(n=>n.textContent.includes('Loading task history…')))};
  const beginHeld=async()=>{hold=true;await view().evaluate(b=>{window.savedShow=b;window.savedHide=document.querySelector('button');window.pendingIndependentHistory=b.onclick()});await held()};
  const finishHeld=async()=>{release();release=null;await page.evaluate(()=>window.pendingIndependentHistory)};
  const unavailable=async()=>{await panel().getByText('Task history is unavailable. Hide it and try again.',{exact:true}).waitFor();eq(await panel().locator('li').count(),0,engine+' no partially published invalid audit')};
  await fresh();
  rows=[event(3,{before_status:'completed',after_status:'canceled',before_due:null,after_due:null,actor_user_id:'SECRET_ACTOR',before_state:{title:'SECRET_PASTORAL'},after_state:{assigned_user_id:'SECRET_ASSIGNEE',finance:'SECRET_FINANCE'},metadata:{secret:'SECRET_METADATA'}})];
  await view().click();await panel().getByText(/completed → canceled/).waitFor();
  const shown=await panel().innerText();eq(shown.includes('SECRET_'),false,engine+' injected raw metadata/actor/title never published');
  eq(eventReads().at(-1).filters.select.includes('actor_user_id'),false,engine+' actor column not requested');
  eq(eventReads().at(-1).filters.select.includes('*'),false,engine+' no wildcard audit projection');await hide().click();
  const invalid=[
   [event(2),event(3,{organization_id:Q})],
   [event(2),event(3,{task_id:P})],
   [event(2,{before_revision:'1'})],
   [event(2,{after_revision:1.5})],
   [event(1,{after_status:'completed'})],
   [event(2,{before_due:'2026-02-29'})],
   [event(2,{after_status:'SECRET_STATUS'})],
   [event(2,{id:'SECRET_EVENT'})],
   [event(2),event(2)]
  ];
  for(const values of invalid){rows=values;await view().click();await unavailable();eq((await page.locator('body').innerText()).includes('SECRET_'),false,engine+' invalid event text withheld');await hide().click()}
  rows=[event(2)];await beginHeld();await hide().evaluate(b=>{window.savedHide=b;b.onclick()});await finishHeld();eq(await panel().count(),0,engine+' direct hide invalidates captured pending callback');
  await view().click();await panel().getByText(/Revision 2/).waitFor();eq(await panel().locator('li').count(),1,engine+' current control remains useful after hidden late read');await hide().click();
  await beginHeld();await page.getByRole('button',{name:'Back to People',exact:true}).click();await finishHeld();await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).waitFor();
  const retiredReads=eventReads().length;await page.evaluate(async()=>{await savedShow.onclick();savedHide.onclick()});eq(eventReads().length,retiredReads,engine+' detached show/hide callbacks make no audit request');eq(await panel().count(),0,engine+' no detached result published');
  await open();await beginHeld();await page.evaluate(()=>{history.replaceState(null,'','?org=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')});await finishHeld();
  eq((await panel().innerText()).includes('Revision 2'),false,engine+' changed URL scope cannot publish old history');const urlReads=eventReads().length;await page.evaluate(()=>savedShow.onclick());eq(eventReads().length,urlReads,engine+' retained old scope cannot query');
  await fresh();await beginHeld();await page.evaluate(()=>{window.ChampionLifeAuth={client:{auth:{}}}});await finishHeld();eq(await panel().count(),0,engine+' replaced Auth object clears loaded history');const replacementReads=eventReads().length;await page.evaluate(()=>savedShow.onclick());eq(eventReads().length,replacementReads,engine+' replaced Auth retained control cannot query');
  await fresh();await beginHeld();caps=['people.read'];await finishHeld();eq(await panel().count(),0,engine+' same actor revoked permission cannot publish');
  await fresh();await beginHeld();actor=B;await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(B)});await finishHeld();eq(await panel().count(),0,engine+' postread silent principal change clears result');
  await fresh();outcome='denied';await view().evaluate(b=>{window.pendingIndependentHistory=b.onclick()});await page.evaluate(()=>window.pendingIndependentHistory);eq(await panel().count(),0,engine+' same principal server denial clears result');
  eq(writes,[],engine+' history has no application write');eq(unexpected,[],engine+' all network stays fictional');eq(errors,[],engine+' no ignored browser errors');await context.close();
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,sourceHashes,sdkSHA256:sha(sdk),sourceOnly:true,hostedAuthorization:false}));
