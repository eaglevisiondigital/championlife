// Independent lifecycle assertions. Actual HTML/SDK/fictional transport scaffold reused from author suite.
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
const task=i=>({id:'11111111-1111-4111-8111-'+String(i).padStart(12,'0'),organization_id:O,person_id:P,title:'Task '+String(i).padStart(3,'0'),status:i>205?'completed':'open',due_on:'2026-11-10',revision:1,created_at:'2026-11-01T12:00:00.123456+00:00'});
const publicPaths=new Set(JSON.parse(readFileSync(resolve(root,'tools/site-build/public-files.json')))),sourceHashes={};let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const context=await browser.newContext({viewport:{width:engine==='chromium'?390:1440,height:950}}),page=await context.newPage(),calls=[],writes=[],errors=[],unexpected=[];
  let actor=A,caps=['people.read','followup.read'],tasks=Array.from({length:305},(_,i)=>task(i+1)),hold=false,release=null,outcome=null;
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
    if(name==='followup_tasks'){
     if(req.method()==='PATCH'){
      const payload=req.postDataJSON();writes.push({filters,payload});const row=tasks.find(t=>filters.id==='eq.'+t.id&&filters.revision==='eq.'+t.revision&&filters.person_id==='eq.'+P&&filters.organization_id==='eq.'+O);
      if(row){Object.assign(row,payload);row.revision++}return send(row?{id:row.id}:null);
     }
     if(req.method()==='POST'){const payload=req.postDataJSON();writes.push({payload});const row={...task(400),...payload,status:'open'};tasks.push(row);return send({id:row.id})}
     let selected=tasks.filter(t=>filters.organization_id==='eq.'+t.organization_id&&filters.person_id==='eq.'+t.person_id&&(!filters.status||filters.status==='eq.'+t.status));
     if(filters.or){const m=/id.lt.([a-f0-9-]+)/.exec(filters.or);assert(m,'typed cursor');selected=selected.filter(t=>t.id<m[1])}
     selected.sort((a,b)=>b.id.localeCompare(a.id));const captured=selected.slice(0,Number(filters.limit)).map(t=>({...t})),result=outcome;outcome=null;
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
  const filter=()=>page.getByLabel('Filter follow-up tasks',{exact:true}),older=()=>page.getByRole('button',{name:'Older tasks',exact:true});
  const reads=()=>calls.filter(c=>c.name==='followup_tasks'&&c.method==='GET');
  const visible=()=>page.locator('#outreach-people h4').allTextContents().then(a=>a.filter(t=>/^Task \d+$/.test(t)));
  const open=async()=>{await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor()};
  const fresh=async(manage=false)=>{actor=A;caps=['people.read','followup.read',...(manage?['followup.manage']:[])];tasks=Array.from({length:305},(_,i)=>task(i+1));await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(A)});await page.goto(origin+'/staff-people.html?org='+O);await open()};
  const held=async()=>{for(let n=0;n<500&&!release;n++)await page.waitForTimeout(10);assert(release,'task request held')};
  const delivered=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/rest/v1/followup_tasks');release();release=null;await(await response).finished();await page.waitForTimeout(80)};
  const choose=async value=>{await filter().selectOption(value);await filter().waitFor();eq(await filter().inputValue(),value,engine+' selected '+value)};
  // Independently authored lifecycle controls on the author's actual-source scaffold.
  for(const transition of ['client','auth','route']){
   await fresh();hold=true;await filter().selectOption('open');await held();
   await page.evaluate(transition=>{
    if(transition==='client')ChampionLifeAuth.client={...ChampionLifeAuth.client};
    if(transition==='auth')ChampionLifeAuth.client.auth={...ChampionLifeAuth.client.auth};
    if(transition==='route')history.replaceState(null,'',location.pathname+'?retired=1');
   },transition);
   await delivered();
   eq((await visible()).includes('Task 205'),false,engine+' pending filtered response retired after '+transition);
   eq(await filter().count(),0,engine+' no stale filter recreated after '+transition);
  }
  // Same-context failure remains visible; lifecycle cleanup must not erase it.
  await fresh();hold=true;outcome='error';await filter().selectOption('open');await held();await delivered();
  const sameError=await page.locator('body').innerText();
  eq(sameError.includes('Unable to complete this request'),true,engine+' current request error remains explicit');
  eq(sameError.includes('PRIVATE_ERROR_DO_NOT_RENDER'),false,engine+' current request raw error stays private');
  eq(await page.getByRole('heading',{name:'Fictional Person A',exact:true}).count(),1,engine+' current authorized Person context is preserved on task error');
  // A failed old request must retire the same lost context as a successful one.
  await fresh();hold=true;outcome='error';await filter().selectOption('open');await held();
  await page.evaluate(()=>{ChampionLifeAuth.client={...ChampionLifeAuth.client}});
  await delivered();
  eq(await page.getByRole('heading',{name:'Fictional Person A',exact:true}).count(),0,engine+' rejected pending filter retires private Person detail after client replacement');
  eq(writes,[],engine+' independent read checks issue no writes');
  eq(unexpected,[],engine+' all transport fictional and allowlisted');eq(errors,[],engine+' strict zero browser errors');await context.close();
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,sourceHashes,sdkSHA256:sha(sdk),sourceOnly:true,hostedAuthorization:false}));
