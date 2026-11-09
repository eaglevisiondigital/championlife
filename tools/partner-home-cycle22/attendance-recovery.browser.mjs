// Interrupted attendance recovery: actual Staff/SDK, canonical disposable PostgreSQL, fictional identities.
// Reuses the accepted event-day fixture; no provider traffic or SQL changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {session} from '../staff-cycle7/people-registration-fixture.mjs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),admin=uuid(),worker=uuid(),other=uuid(),A=uuid(),B=uuid();let checks=0;const reproductions=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const actor=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
const staff=(action,p={},campaign=A)=>q('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p]).then(r=>r.rows[0].v);
try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const f of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const org=(await q("select organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].organization_id;
 for(const id of[admin,worker,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic administrator')",[org,admin]);await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic fixture')",[org,admin]);await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,admin]);
 for(const[id,code]of[[A,'synthetic_roster_a'],[B,'synthetic_roster_b']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Test','US','UTC','approved')",[id,org,code]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason)values($1,$2,'local_leader',array['view','registration.view','registration.manage','registration.export','checkin.manage'],true,'Synthetic fixture')",[A,worker]);
 await actor(admin);await staff('configure',{revision:0,public_slug:'synthetic-roster-a',enabled:true,waiver_required:true,prize_choices:[{id:'bike',label:'Bicycle'}]});
 const version=(await staff('waiver_publish',{template_key:'synthetic-only',version:1,effective_at:'2026-01-01T00:00:00Z',text:'SYNTHETIC TEST WAIVER. Not approved for real events.'})).id;
 const members=[{client_key:uuid(),first_name:'Morgan',last_name:'Fixture',age:38,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,prize_choice:null,answers:{}},{client_key:uuid(),first_name:'Alex',last_name:'Fixture',age:9,relationship:'child',guardian_relationship:'Parent',attending:true,prize_participation:true,prize_choice:'bike',answers:{}}];
 members.push({...members[1],client_key:uuid(),first_name:'Nonattending',age:15,attending:false});
 await staff('walkup',{request_key:uuid(),first_name:'Morgan',last_name:'Fixture',email:'fixture@example.test',phone:'+15555550100',attendees:members,consents:{ministry_followup:false,communications:false,marketing:false,media:false},waiver:{request_key:uuid(),version_id:version,signer_name:'Morgan Fixture',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:members.map(m=>m.client_key)}});

 let full;await db.exec('reset role');
 const root=new URL('../../',import.meta.url),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),origin='https://household-native.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
 assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
 const publicFiles=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));
 const execute=async(who,action,p={},campaign=A)=>{const c=await db.connect();try{await c.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await c.query('set role authenticated');return{data:(await c.query('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p])).rows[0].v,error:null,status:200}}catch(e){return{data:null,error:{code:e.code,message:e.message},status:e.code==='42501'?403:400}}finally{await c.end()}};
 const state=async()=>({registration:(await q('select revision,first_name,status,notes,consents from outreach_event_registrations where id=$1',[full.id])).rows[0],attendees:(await q('select id,client_key,first_name,age,guardian_relationship,active,revision,checked_in_at from outreach_event_attendees where registration_id=$1 order by id',[full.id])).rows,signatures:(await q('select to_jsonb(s) v from outreach_waiver_signatures s where registration_id=$1 order by id',[full.id])).rows,corrections:(await q('select to_jsonb(c) v from outreach_waiver_corrections c join outreach_waiver_signatures s on s.id=c.signature_id where s.registration_id=$1 order by c.signature_id',[full.id])).rows,auditRows:(await q('select to_jsonb(a) v from outreach_campaign_audit a where campaign_id=$1 order by id',[A])).rows,audits:(await q('select kind,count(*)::int n from outreach_campaign_audit where campaign_id=$1 group by kind order by kind',[A])).rows});
 const preservedHistory=(before,after)=>{const rows=new Map(after.auditRows.map(x=>[x.v.id,x]));for(const old of before.auditRows)assert.deepEqual(rows.get(old.v.id),old)};
 const audit=(s,kind)=>s.audits.find(x=>x.kind===kind)?.n||0;
 for(const [engine,type]of Object.entries({chromium,webkit})){
  if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
  const browser=await type.launch({headless:true});try{
   for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),calls=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let responseHold=null,release=null,submitted=false,expired=false,fault=null;page.on('download',()=>{});
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url()),reply=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
    if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(u.origin===backend){
     const token=req.headers().authorization?.split(' ')[1];let who;try{who=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub}catch{}
     if(u.pathname==='/auth/v1/user')return !expired&&[worker,other].includes(who)?reply(session(who).user):reply({message:'Fictional denied'},401);
     if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
     const name=u.pathname.split('/').at(-1),p=req.postDataJSON();
     if(name==='staff_workspace_context')return reply({organizations:[],grants:[]});
     if(name==='communications_workspace')return reply({external_delivery_enabled:false,organizations:[],campaigns:[]});
     if(name==='forms_workspace')return reply({capabilities:{profile:'private_draft_v1'},organizations:[]});
     assert.equal(name,'outreach_registration_workspace','No inherited People/decisions/finance/learning RPCs');calls.push({...p,actor:who});
     const f=fault?.action===p.p_action?fault:null;if(f)fault=null;
     const r=f?.outcome==='not-committed'?null:await execute(who,p.p_action,p.p_payload,p.p_campaign);
     if(responseHold===p.p_action){responseHold=null;submitted=true;await new Promise(resolve=>release=resolve)}
     if(f){if(f.outcome==='malformed')return reply({unexpected:true});return route.abort('failed')}
     return reply(r.error||r.data,r.status);
    }
    assert.equal(u.origin,origin);assert.equal(req.method(),'GET');const path=u.pathname.slice(1);
    if(['seed','discipleship-login.html'].includes(path))return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional login</h1>'});
    if(path==='assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'})});
    assert(publicFiles.has(path));return route.fulfill({body:process.env.REVIEW_BASE&&['assets/js/staff-workspace.js','assets/js/outreach-registration-staff.js'].includes(path)?execFileSync('git',['show',process.env.REVIEW_BASE+':'+path],{cwd:root}):readFileSync(new URL(path,root)),contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/png'});
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(worker)});

   const label=engine+'/'+width;
   const open=async()=>{expired=false;await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(worker)});await page.goto(origin+'/staff-outreach-registration.html?campaign='+A);await page.getByRole('heading',{name:'Household lookup',exact:true}).waitFor();await page.evaluate(()=>{window.downloads=[];window.prints=[];const original=OutreachRegistrationForm.download;OutreachRegistrationForm.download=(...args)=>{downloads.push(args);return original(...args)};window.print=()=>prints.push(document.querySelector('.registration-print')?.innerText)})};
   const rows=(await execute(worker,'list')).data.registrations;assert.equal(rows.length,1);full=(await execute(worker,'detail',{registration_id:rows[0].id})).data;await open();
   const card=()=>page.locator('.registration-member').filter({has:page.getByRole('heading',{name:'Morgan Fixture',exact:true})});
   const openDetail=async()=>{await open();await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const attendance=()=>calls.filter(p=>['checkin','reverse'].includes(p.p_action));
   const reset=async()=>{await execute(worker,'reverse',{registration_id:full.id,attendee_id:full.attendees.find(a=>a.first_name==='Morgan').id,reason:'Synthetic reset only'});await openDetail()};
   const start=async(action)=>{const control=card().getByRole('button',{name:action==='checkin'?'Check in attendee':'Reverse check-in',exact:true});if(action==='reverse')await card().getByLabel('Reason for check-in correction',{exact:true}).fill('Fictional correction');await control.evaluate(b=>{window.oldButton=b;window.oldHandler=b.onclick;window.pending=oldHandler()})};
   const refresh=()=>page.getByRole('button',{name:'Refresh current attendance',exact:true});
   for(const action of ['checkin','reverse']){
    await reset();if(action==='reverse'){await start('checkin');await page.evaluate(()=>pending);}
    const before=await state(),n=attendance().length;await start(action);await page.evaluate(()=>pending);
    ok(attendance().length===n+1,label+' confirmed '+action+' sends exactly once');
    ok(await card().getByRole('button',{name:action==='checkin'?'Reverse check-in':'Check in attendee',exact:true}).count()===1,label+' confirmed '+action+' shows canonical state');
    const after=await state();preservedHistory(before,after);assert.deepEqual(after.signatures,before.signatures);ok(after.auditRows.length===before.auditRows.length+1,label+' confirmed mutation keeps legal history and one audit');
   }
   // A canonical database rejection is distinct from a lost response.
   await reset();await start('checkin');await page.evaluate(()=>pending);await card().getByLabel('Reason for check-in correction',{exact:true}).fill('x');
   const denialBefore=await state();await card().getByRole('button',{name:'Reverse check-in',exact:true}).click();await page.getByRole('alert').waitFor();
   ok((await page.getByRole('alert').textContent()).includes('Correction reason required'),label+' explicit SQL rejection remains understandable');assert.deepEqual(await state(),denialBefore);ok(true,label+' rejected mutation changes no records or audit');
   for(const action of ['checkin','reverse'])for(const outcome of ['committed','not-committed','malformed']){
    await reset();if(action==='reverse'){await start('checkin');await page.evaluate(()=>pending);}
    const before=await state(),n=attendance().length;fault={action,outcome};await start(action);await page.evaluate(()=>pending);
    const after=await state();ok(attendance().length===n+1,label+' '+action+'/'+outcome+' no automatic retry');
    ok(after.auditRows.length===before.auditRows.length+(outcome==='not-committed'?0:1),label+' '+action+'/'+outcome+' actual SQL commitment recorded');
    preservedHistory(before,after);assert.deepEqual(after.signatures,before.signatures);ok(true,label+' uncertain operation preserves signatures and prior audits');
    const hasRecovery=await refresh().count();console.log(JSON.stringify({engine,width,action,outcome,hasRecovery,message:await page.locator('[data-error]').allTextContents()}));
    if(process.env.REPRO){reproductions.push({engine,width,action,outcome,hasRecovery});continue;}
    ok(hasRecovery===1,label+' truthful uncertainty and separate read-only refresh offered');
    ok((await page.locator('#outreach-registration-staff').innerText()).includes('Do not repeat this change'),label+' no unsafe retry guidance');
    await page.evaluate(()=>{document.getElementById('outreach-registration-staff').append(oldButton);return oldHandler()});ok(attendance().length===n+1,label+' old mutation control remains retired after reinsertion');
    const readStart=calls.length;await refresh().click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();
    assert.deepEqual(calls.slice(readStart).map(p=>p.p_action),['context','detail']);ok(true,label+' refresh uses fresh existing read permissions only');
    const actual=(await execute(worker,'detail',{registration_id:full.id})).data.attendees.find(a=>a.first_name==='Morgan');
    ok(await card().getByRole('button',{name:actual.checked_in_at?'Reverse check-in':'Check in attendee',exact:true}).count()===1,label+' refreshed actual state matches SQL');
    ok((await page.getByRole('alert').textContent()).includes('does not prove which request'),label+' current state never attributed to uncertain request');
    assert.deepEqual(await state(),after);ok(true,label+' reconciliation has no mutation or audit side effect');
   }
   if(!process.env.REPRO){
    // Two authorized operators serialize through the unchanged canonical SQL locks.
    await reset();const attendee=full.attendees.find(a=>a.first_name==='Morgan').id;
    const before=await state(),n=attendance().length;fault={action:'checkin',outcome:'committed'};responseHold='checkin';submitted=false;await start('checkin');for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);
    const concurrent=await Promise.all([execute(admin,'reverse',{registration_id:full.id,attendee_id:attendee,reason:'Other authorized correction'}),execute(admin,'checkin',{registration_id:full.id,attendee_id:attendee})]);assert(concurrent.every(x=>x.status===200));release();await page.evaluate(()=>pending);
    await refresh().click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();const actual=(await execute(worker,'detail',{registration_id:full.id})).data.attendees.find(a=>a.id===attendee);
    ok(await card().getByRole('button',{name:actual.checked_in_at?'Reverse check-in':'Check in attendee',exact:true}).count()===1,label+' concurrent authorized state displayed without attribution');ok(attendance().length===n+1,label+' concurrent updates cause no browser retry');const after=await state();preservedHistory(before,after);assert.deepEqual(after.signatures,before.signatures);ok(true,label+' concurrent immutable audit/legal history preserved');
    // Read recovery controls obey permanent retirement and fresh permission checks.
    await reset();fault={action:'checkin',outcome:'committed'};await start('checkin');await page.evaluate(()=>pending);await refresh().evaluate(b=>{window.readButton=b;window.readHandler=b.onclick;const p=b.parentNode;b.remove();p.append(b)});const count=calls.length;await page.evaluate(()=>readHandler());ok(calls.length===count,label+' removed/reinserted recovery control cannot issue even a read');
    await reset();fault={action:'checkin',outcome:'committed'};await start('checkin');await page.evaluate(()=>pending);await q("update outreach_campaign_assignments set capabilities=array['view'] where campaign_id=$1 and user_id=$2",[A,worker]);await refresh().click();await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();ok(await page.locator('#staff-main').isHidden(),label+' revoked read permission denies recovery and clears protected content');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','registration.export','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);
    await reset();await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);const denied=await state();await start('checkin');await page.evaluate(()=>pending);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();assert.deepEqual(await state(),denied);ok(true,label+' explicit mutation permission denial has no write or uncertain-success claim');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','registration.export','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);
    for(const change of ['account','campaign']){
     await reset();fault={action:'checkin',outcome:'committed'};responseHold='checkin';submitted=false;await start('checkin');for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);const count=attendance().length;
     if(change==='account')await page.evaluate(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));dispatchEvent(new Event('focus'))},{key,value:session(other)});else await page.evaluate(B=>{history.pushState({},'',location.pathname+'?campaign='+B);dispatchEvent(new PopStateEvent('popstate'))},B);
     release();await page.evaluate(()=>pending);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();ok(await page.locator('.registration-member').count()===0&&await refresh().count()===0,label+' '+change+' hides stale response and recovery controls');await page.evaluate(()=>oldHandler());ok(attendance().length===count,label+' '+change+' captured handler cannot retry');
    }
   }
   await open();ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' mobile/desktop layout remains within viewport');assert.deepEqual(errors,[]);ok(true,label+' no browser exceptions');await context.close();
   }
  }finally{await browser.close()}
 }
 if(process.env.REPRO){console.log(JSON.stringify({originalReproductions:reproductions}));assert(reproductions.every(x=>x.hasRecovery===1),'Every uncertain original operation must offer safe read-only recovery')}
 console.log(JSON.stringify({status:'PASS',checks,actualStaffHost:true,nativePostgres:true,fictionalAuth:true,hosted:false}));
}finally{await db.close()}
