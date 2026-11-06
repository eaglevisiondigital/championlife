// Actual financial intake page/runtime + unchanged native PostgreSQL RPCs.
// Fictional Auth transport only; disposable Unix socket DB, every browser request intercepted.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {randomUUID as uuid} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://partner-org.invalid';
const db=await localPostgres(),read=p=>readFile(path.join(root,p),'utf8'),q=(sql,args=[])=>db.query(sql,args);
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const users={dual:uuid(),church:uuid(),nofinance:uuid()},intakes={A:uuid(),B:uuid()};
const permissions=['outreach.view','finance.read','outreach.manage'];
let A,B;
async function rpc(actor,name,args){
 const c=await db.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[users[actor]]);await c.query('set local role authenticated');
 const result=name==='staff_workspace_context'?await c.query('select public.staff_workspace_context() v'):await c.query('select public.outreach_partner_workspace($1,$2,$3) v',[args.p_org,args.p_action,args.p_data]);await c.query('commit');return{status:200,data:result.rows[0].v};
 }catch(error){await c.query('rollback');return{status:error.code==='42501'?403:400,data:null,error:{code:error.code,message:error.message}}}finally{await c.end()}
}
const waitFor=async fn=>{const end=Date.now()+5000;while(!fn()){assert.ok(Date.now()<end,'fixture transport reached expected barrier');await new Promise(r=>setTimeout(r,10))}};
try{
 await db.exec(await read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(await read('supabase/bootstrap/automatic-rls.sql'));
 for(const file of migrationOrder)await db.exec(await read('supabase/migrations/'+file));
 const orgs=(await q("select id,slug from public.organizations where slug in ('champion-life','sowgo')")).rows;A=orgs.find(o=>o.slug==='champion-life').id;B=orgs.find(o=>o.slug==='sowgo').id;
 for(const[key,user]of Object.entries(users)){
  await q("insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())",[user,key+'@example.test']);
  for(const org of key==='church'?[A]:[A,B]){
   await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional reviewer')",[org,user]);
   for(const permission of key==='nofinance'?['outreach.view']:permissions)await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,user,permission]);
  }
 }
 for(const[key,org]of[['A',A],['B',B]])await q(`insert into outreach_partner_intakes(id,organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash)values($1,$2,'sowgo','/outreach-partner.html',$3,$4,'15555550100',25,'Monthly',$5,'fictional')`,[intakes[key],org,{'first-name':'Fictional '+key,'last-name':'Intake',email:key.toLowerCase()+'@example.test',phone:'5555550100','commitment-amount':'25','commitment-frequency':'Monthly'},key.toLowerCase()+'@example.test',uuid()]);
 ok((await rpc('church','outreach_partner_workspace',{p_org:B,p_action:'list',p_data:{}})).status===403,'native wrong organization denied');
 ok((await rpc('nofinance','outreach_partner_workspace',{p_org:B,p_action:'list',p_data:{}})).status===403,'native outreach without finance denied');
 ok((await rpc('dual','outreach_partner_workspace',{p_org:A,p_action:'detail',p_data:{id:intakes.B}})).status===400,'native wrong organization record denied');
 for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
  try{for(const width of[390,1440]){
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),calls=[],unexpected=[],errors=[],pending=[];
   const state={actor:'dual',hold:false};page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin){if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={};'});unexpected.push(url.origin+url.pathname);return route.abort()}
    if(url.pathname==='/__fixture/rpc'&&req.method()==='POST'){
     const {name,args,actor}=req.postDataJSON();if(!['staff_workspace_context','outreach_partner_workspace'].includes(name)||!Object.hasOwn(users,actor)){unexpected.push('invalid fixture RPC');return route.abort()}
     calls.push({name,args,actor});const result=await rpc(actor,name,args);
     if(state.hold&&name==='outreach_partner_workspace'&&args.p_action==='list'&&args.p_org===B)await new Promise(resolve=>pending.push(resolve));
     return route.fulfill({json:result}).catch(()=>{});
    }
    if(req.method()!=='GET'){unexpected.push(req.method()+' '+url.pathname);return route.abort()}
    if(url.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional sign-in boundary</h1>'});
    if(url.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE={};'});
    if(url.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({contentType:'text/javascript',body:`(()=>{let actor=${JSON.stringify(state.actor)};const users=${JSON.stringify(users)},listeners=[];const user=()=>({id:users[actor],email:actor+'@example.test'});window.partnerFixture={switch(key){actor=key;listeners.forEach(f=>f('SIGNED_IN',{user:user()}))}};window.ChampionLifeAuth={getUser:async()=>user(),getSession:async()=>({user:user()}),client:{auth:{onAuthStateChange:f=>{listeners.push(f);return{};}},rpc:async(name,args)=>fetch('/__fixture/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actor,name,args})}).then(r=>r.json())}}})();`});
    const file=path.join(root,url.pathname);try{return route.fulfill({body:await readFile(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
   });
   const open=async(query='?org='+B,actor='dual')=>{state.actor=actor;await page.goto(origin+'/staff-outreach-partners.html'+query)};
   const loaded=()=>page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
   const actions=()=>calls.filter(c=>c.name==='outreach_partner_workspace');
   await open();await loaded();ok(await page.getByLabel('Organization',{exact:true}).inputValue()===B,'handoff selects second authorized organization');ok((await page.locator('#outreach-intakes').innerText()).includes('Fictional B Intake'),'native B row renders');ok(!(await page.locator('#outreach-intakes').innerText()).includes('Fictional A'),'A row absent');
   await page.getByRole('button',{name:'Review intake',exact:true}).click();await page.getByRole('button',{name:'Mark reviewed',exact:true}).waitFor();
   const priorHeading=await page.getByRole('heading',{name:/^Partner intake ·/}).elementHandle();await page.getByRole('button',{name:'Mark reviewed',exact:true}).click();await page.waitForFunction(el=>!el.isConnected,priorHeading);await page.getByRole('heading',{name:'Partner intake · reviewed',exact:true}).waitFor();await page.getByRole('button',{name:'Mark reviewed',exact:true}).waitFor();
   ok(actions().every(c=>c.args.p_org===B),'list/detail/review use selected org only');ok(actions().filter(c=>c.args.p_action==='review').every(c=>c.args.p_data.id===intakes.B),'review targets only selected organization record');
   ok((await q('select status from outreach_partner_intakes where id=$1',[intakes.A])).rows[0].status==='new','other organization intake remains unchanged');
   if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`partner-org-final-${name}-${width}.png`),fullPage:true})}
   for(const query of['?org='+uuid(),'?org=malformed','?org=','?org='+A+'&org='+B]){const before=actions().length;await open(query);await page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor();ok(actions().length===before,'invalid handoff does not query alternative org');ok(await page.locator('#outreach-intakes article').count()===0,'invalid handoff exposes no record')}
   for(const actor of['church','nofinance']){const before=actions().length;await open('?org='+B,actor);await page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor();ok(actions().length===before,actor+' cannot use query to obtain finance/org authority')}
   await open();await loaded();await page.getByLabel('Organization',{exact:true}).selectOption(A);await page.getByText('Fictional A Intake',{exact:true}).waitFor();ok(new URL(page.url()).searchParams.get('org')===A,'selection updates reloadable local URL');await page.reload();await loaded();ok(await page.getByLabel('Organization',{exact:true}).inputValue()===A,'reload retains deliberate organization selection');
   await open();await loaded();state.hold=true;await page.getByRole('button',{name:'Next',exact:true}).click();await waitFor(()=>pending.length);await page.getByLabel('Organization',{exact:true}).selectOption(A);await page.getByText('Fictional A Intake',{exact:true}).waitFor();state.hold=false;pending.splice(0).forEach(f=>f());await page.waitForTimeout(40);ok(!(await page.locator('#outreach-intakes').innerText()).includes('Fictional B'),'late B response cannot replace selected A');
   await open();await loaded();await page.getByRole('button',{name:'Review intake',exact:true}).click();await page.getByRole('button',{name:'Mark reviewed',exact:true}).waitFor();await page.evaluate(()=>{window.oldReview=[...document.querySelectorAll('button')].find(b=>b.textContent==='Mark reviewed');window.oldOrganization=document.querySelector('select[aria-label=Organization]')});
   const auditsBefore=(await q('select count(*)::int n from private.outreach_partner_audit')).rows[0].n;
   await q("update organization_staff_permissions set revoked_at=now() where user_id=$1 and organization_id=$2 and permission='finance.read'",[users.dual,B]);
   await page.getByRole('button',{name:'Mark reviewed',exact:true}).click();await page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor();const before=actions().length;await page.evaluate(()=>oldReview.click());await page.waitForTimeout(40);ok(actions().length===before,'retained mutation control inactive after backend revocation');const deniedUrl=page.url();await page.evaluate(org=>{oldOrganization.value=org;oldOrganization.dispatchEvent(new Event('change'))},A);await page.waitForTimeout(40);ok(actions().length===before,'retained organization control issues no RPC after revocation');ok(page.url()===deniedUrl,'retained organization control cannot rewrite current URL');ok((await q('select count(*)::int n from private.outreach_partner_audit')).rows[0].n===auditsBefore,'revoked review makes no mutation/audit');
   await q("update organization_staff_permissions set revoked_at=null where user_id=$1 and organization_id=$2 and permission='finance.read'",[users.dual,B]);
   await open();await loaded();state.hold=true;await page.getByRole('button',{name:'Next',exact:true}).click();await waitFor(()=>pending.length);await page.evaluate(()=>partnerFixture.switch('church'));await page.waitForURL('**/discipleship-login.html?**');state.hold=false;pending.splice(0).forEach(f=>f());await page.waitForTimeout(40);ok(!(await page.locator('body').innerText()).includes('Fictional B'),'account change retires old private workspace');
   await open();await loaded();ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'approved page fits viewport');ok(unexpected.length===0,'no nonfixture requests '+unexpected.join(','));ok(errors.length===0,'no browser exceptions '+errors.join(','));console.log(JSON.stringify({name,width,checks,rpcCalls:calls.length}));await context.close();
  }}finally{await browser.close()}
 }
 const audits=(await q('select intake_id,actor_id,action from private.outreach_partner_audit')).rows;
 ok(audits.length===4&&audits.every(r=>r.intake_id===intakes.B&&r.actor_id===users.dual&&r.action==='review'),'exact four authorized B reviews create four immutable audit records');
 ok((await q('select count(*)::int n from organization_people')).rows[0].n===0,'journey creates no Person or identity link');
 console.log(JSON.stringify({status:'PASS',checks,audits:audits.length,backend:'unchanged native PostgreSQL RPCs',auth:'fictional intercepted transport',hostedOperations:0}));
}finally{await db.close()}
