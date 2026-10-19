// Local browser + real disposable SQL acceptance. Auth transport is synthetic;
// no Supabase project, external provider or production credential is contacted.
import assert from 'node:assert/strict';import {buildSite} from '../site-build/build.mjs';import {createServer} from 'node:http';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {randomUUID as uuid} from 'node:crypto';import {database,read} from './unified-outreach.fixture.mjs';
const {chromium}=await import(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const artifact=await buildSite({env:{CONTEXT:'branch-deploy',BRANCH:'codex/unified-outreach-gate0-reconciliation'}});assert.equal(artifact.backend,'blocked','local browser artifact must be isolated/disabled');
const db=await database(async db=>{for(const[decision,total]of[['salvation',14],['rededication',9],['learn_more',7],['prayer_followup',18]])for(let i=0;i<total;i++)await db.query("insert into outreach_registrations(first_name,last_name,email,phone,decision,prayer_request,consent,source)values('Synthetic','Acceptance','synthetic@example.test','+15555550100',$1,'Synthetic prayer only',true,'bessemer_al_2026')",[decision]);});
const q=(s,p=[])=>db.query(s,p),users=Object.fromEntries(['leader','bessemer','huntsville','readonly','followup','revoked'].map(k=>[k,uuid()]));let browser,server;const result={environment:'local synthetic Auth transport + actual disposable SQL',checks:[],screenshots:[],revocations:[]};
const evidence=process.env.EVIDENCE_DIR||'/private/tmp/champion-unified-browser';mkdirSync(evidence,{recursive:true});
try{
 const orgs=(await q('select id,slug from organizations')).rows,org=slug=>orgs.find(o=>o.slug===slug).id,cs=(await q('select id,code from outreach_campaigns')).rows,B=cs.find(c=>c.code==='bessemer_al_2026').id,H=cs.find(c=>c.code==='huntsville_al_2026').id;
 for(const[k,id]of Object.entries(users))await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,k+'-synthetic@example.test']);
 for(const slug of ['champion-life','sowgo']){await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic leadership')",[org(slug),users.leader]);await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic local acceptance')",[org(slug),users.leader]);for(const perm of ['people.read','staff.manage','care.read','finance.read','outreach.view','outreach.manage','communications.view'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org(slug),users.leader,perm]);}
 for(const k of ['readonly','followup','revoked'])await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'internal_team',$3,'Synthetic local acceptance')",[B,users[k],k==='readonly'?['view','decision.view']:['view','decision.view','decision.manage']]);
 const churches={};for(const[k,cid]of[['bessemer',B],['huntsville',H]]){const id=uuid();churches[k]=id;await q("insert into outreach_partner_churches(id,campaign_id,name,slug,created_by)values($1,$2,$3,$4,$5)",[id,cid,'Synthetic '+k+' Church','synthetic-'+k,users.leader]);await q("insert into outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,granted_by,reason)values($1,$2,$3,array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes'],$4,'Synthetic local acceptance')",[id,cid,users[k],users.leader]);}
 const decision=(await q('select id from outreach_registrations limit 1')).rows[0].id;await q("insert into outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason)values($1,$2,$3,$4,'Synthetic central assignment')",[B,churches.bessemer,decision,users.leader]);
 // Local synthetic Huntsville decision gives that partner page real protected data/controls.
 const huntsvilleDecision=(await q("insert into outreach_registrations(first_name,last_name,email,phone,decision,prayer_request,consent,source)values('Synthetic','Huntsville Acceptance','synthetic@example.test','+15555550100','salvation','Synthetic prayer only',true,'huntsville_al_2026') returning id")).rows[0].id;
 await q("insert into outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason)values($1,$2,$3,$4,'Synthetic central assignment')",[H,churches.huntsville,huntsvilleDecision,users.leader]);
 const registry=(await q("select proname,proargnames,pronargdefaults,oid::regprocedure::text signature, array(select format_type(t,null) from unnest(proargtypes) t) types from pg_proc where pronamespace='public'::regnamespace and prokind='f'")).rows;
 const allowed=new Set(JSON.parse(read('tools/site-build/public-files.json')));let queue=Promise.resolve();
 // Serialize synthetic administrative flag changes with RPCs on the same SQL connection.
 const asOwner=work=>{queue=queue.then(async()=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[users.leader]);return work();});return queue;};
 const authScript=`window.ChampionLifeAuth={getUser:async()=>window.__testUser,getSession:async()=>window.__testUser?{user:window.__testUser}:null,signOut:async()=>{window.__testUser=null;},client:{auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};}},rpc:async(name,args={})=>{const r=await fetch('/__test_rpc',{method:'POST',headers:{'content-type':'application/json','x-profile':window.__testProfile},body:JSON.stringify({name,args})});return await r.json();}}};`;
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__test_rpc'){
   let body='';for await(const chunk of req)body+=chunk;
   const execute=async()=>{try{const {name,args}=JSON.parse(body),keys=Object.keys(args),match=registry.filter(f=>f.proname===name&&keys.every(k=>f.proargnames?.includes(k))&&keys.length>=(f.proargnames||[]).length-f.pronargdefaults);if(match.length!==1)throw Error('Ambiguous or missing RPC '+name);const f=match[0],id=users[req.headers['x-profile']];await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));const sql='select public.'+name+'('+keys.map((k,i)=>k+'=> $'+(i+1)+'::'+f.types[f.proargnames.indexOf(k)]).join(',')+') v';const data=(await q(sql,keys.map(k=>args[k]))).rows[0].v;return{data,error:null};}catch(e){console.error('Local RPC error:',e.message);return{data:null,error:{code:e.code||'TEST',message:e.message},status:e.code==='42501'?403:400};}};
   const current=queue.then(execute);queue=current.then(()=>{});const data=await current;res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;
  }
  const file=url.pathname.slice(1)||'staff-home.html';if(file==='assets/js/champion-life-auth.js'){res.setHeader('content-type','text/javascript');res.end(authScript);return;}
  if(!allowed.has(file)){res.statusCode=404;res.end('Not found');return;}
  res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(readFileSync(new URL('../../dist/'+file,import.meta.url)));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'chrome'});
 for(const profile of Object.keys(users))for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({profile,id})=>{window.__testProfile=profile;window.__testUser={id,email:profile+'-synthetic@example.test'};},{profile,id:users[profile]});
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.fulfill({status:200,contentType:'text/javascript',body:''}));
  const target=['bessemer','huntsville'].includes(profile)?'staff-outreach-partner.html?partner='+churches[profile]:profile==='leader'?'staff-outreach-overview.html':'staff-outreach-decisions.html?campaign='+B;
  await page.goto(origin+'/'+target);await page.getByText(profile+'-synthetic@example.test',{exact:true}).waitFor();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+' '+width+' overflow');assert.equal(errors.length,0,errors.join('; '));
  result.checks.push(profile+' '+width+' layout/identity/no overflow/no page errors');
  if(width===390){await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Close menu'}).waitFor({state:'visible'});await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Menu',exact:true}).getAttribute('aria-expanded'),'false');result.checks.push(profile+' mobile menu and keyboard Escape');}
  const path=evidence+'/'+profile+'-'+width+'.png';await page.screenshot({path,fullPage:true});result.screenshots.push(path);
  if(profile==='leader'&&width===1440){for(const route of ['staff-home.html','staff-outreach-campaigns.html','staff-outreach-reports.html','staff-outreach-settings.html','staff-access.html','staff-outreach-event-day.html','staff-outreach-team.html','staff-outreach-pre-event.html','staff-outreach-prizes.html','staff-communications.html']){const selectedRoute=route.startsWith('staff-outreach-')&&!route.includes('reports')&&!route.includes('settings')?route+'?campaign='+B:route;await page.goto(origin+'/'+selectedRoute);await page.waitForTimeout(220);assert.equal(await page.locator('.campaign-denied,.staff-state').count(),0,route+' authorized workspace should load');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' overflow');assert.equal(errors.length,0,route+': '+errors.join(';'));result.checks.push('leader product route '+route);} }
  if(['bessemer','huntsville','revoked'].includes(profile)){
   const partnerProfile=profile!=='revoked',recordName=profile==='huntsville'?'Synthetic Huntsville Acceptance':'Synthetic Acceptance';
   await page.getByRole('button',{name:partnerProfile?'Open record':'Open',exact:true}).first().click();
   await page.getByRole('heading',{name:recordName,exact:true}).waitFor();
   await page.getByRole('button',{name:partnerProfile?'Record follow-up':'Save follow-up',exact:true}).waitFor();
   const main=page.locator('main');
   assert.ok((await main.textContent()).includes('synthetic@example.test'),'real protected contact is initially rendered');
   assert.ok(await main.locator('input,select,textarea').count()>0,'protected module controls are initially attached');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+' protected detail overflow');
   const before=evidence+'/'+profile+'-'+width+'-protected.png';await page.screenshot({path:before,fullPage:true});result.screenshots.push(before);
   const table=partnerProfile?'outreach_partner_users':'outreach_campaign_assignments';
   const revoked=await asOwner(()=>q('update public.'+table+' set active=false where user_id=$1 returning user_id',[users[profile]]));
   assert.equal(revoked.rows.length,1,'revoke exactly this synthetic fixture authority');
   try{
    await page.evaluate(()=>window.StaffWorkspace.refresh());
    const recovery=page.locator('main > .staff-state[role="status"]');
    await recovery.getByRole('heading',{name:'Access changed',exact:true}).waitFor();
    await page.waitForTimeout(120);
    assert.equal(await recovery.isVisible(),true,'recovery is visibly rendered on the module page');
    assert.equal(await recovery.evaluate(node=>node.isConnected),true,'recovery remains attached to the live document');
    const text=await main.textContent();for(const token of [recordName,'synthetic@example.test','+15555550100','Synthetic prayer only'])assert.equal(text.includes(token),false,'protected data cleared: '+token);
    assert.equal(await main.locator('button,input,select,textarea,form,table').count(),0,'all protected module controls removed');
    assert.equal(await page.locator('nav a').count(),0,'all now-unauthorized navigation removed');
    const recoveryHref=await recovery.locator('a').getAttribute('href');assert.ok(allowed.has(recoveryHref),'recovery destination is in the actual published manifest');
    assert.equal(recoveryHref,'staff-home.html','Outreach retains its published staff-home recovery');
    assert.equal(await page.evaluate(()=>window.ChampionLifeAuth.getUser().then(user=>user.id)),users[profile],'current synthetic session stays signed in');
    assert.equal(errors.length,0,errors.join('; '));
    const after=evidence+'/'+profile+'-'+width+'-revoked.png';await page.screenshot({path:after,fullPage:true});result.screenshots.push(after);
    result.revocations.push({profile,width,page:target,kind:partnerProfile?'partner church':'campaign decisions',attachedVisibleStatus:true,protectedDataRemoved:true,protectedControlsRemoved:true,unauthorizedNavigationRemoved:true,recoveryHref,sameSession:true,sqlRevocation:true});
    result.checks.push(profile+' '+width+' real-SQL same-session module revocation leaves visible published recovery and clears data/controls/navigation');
   }finally{
    // Restore only this local synthetic active flag so the next viewport starts authorized.
    const restored=await asOwner(()=>q('update public.'+table+' set active=true where user_id=$1 returning user_id',[users[profile]]));assert.equal(restored.rows.length,1);
   }
  }
  await context.close();
 }
 writeFileSync(evidence+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks:result.checks.length,screenshots:result.screenshots.length,evidence}));
}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await db.close();}
