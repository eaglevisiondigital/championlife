// Household/attendee recovery using the accepted native Staff fixture and exact SDK.
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
   let phase='setup';const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),calls=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);if(process.env.DIAGNOSTIC)console.log(JSON.stringify({event:'pageerror',phase,message:e.message}))});if(process.env.DIAGNOSTIC){for(const event of ['request','requestfinished','requestfailed'])page.on(event,r=>{if(r.url().includes('/auth/'))console.log(JSON.stringify({event,phase,path:new URL(r.url()).pathname,failure:r.failure()?.errorText}))});page.on('framenavigated',f=>{if(f===page.mainFrame())console.log(JSON.stringify({event:'navigated',phase,path:new URL(f.url()).pathname}))});}let responseHold=null,release=null,submitted=false,expired=false,fault=null;page.on('download',()=>{});
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
   const editor=action=>action==='update'?page.locator('details').filter({has:page.getByText('Edit household',{exact:true})}):card().locator('details').filter({has:page.getByText('Update attendee',{exact:true})});
   const field=action=>editor(action).getByLabel(action==='update'?'Private operational notes':'Operational notes',{exact:true});
   const prepare=async action=>{phase='prepare '+action;await open();await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();await editor(action).locator('summary').click();await field(action).fill('Private local draft '+action);await editor(action).getByRole('button',{name:action==='update'?'Save household':'Save attendee',exact:true}).evaluate(b=>{window.editButton=b;window.editHandler=b.onclick;window.editNode=b.parentNode;window.draftField=editNode.querySelector('textarea');});await field(action).evaluate(i=>window.draftField=i);};
   const start=()=>page.evaluate(()=>{window.pending=editHandler()});
   const writes=()=>calls.filter(p=>['update','attendee_update'].includes(p.p_action));
   const latest=async()=> (await execute(worker,'detail',{registration_id:full.id})).data;
   const value=async action=>{const d=await latest();return action==='update'?d:d.attendees.find(a=>a.first_name==='Morgan')};
   const another=async action=>{const v=await value(action);const r=await execute(admin,action,{registration_id:full.id,...(action==='attendee_update'?{attendee_id:v.id}:{}),revision:v.revision,notes:'Other authorized edit'});assert.equal(r.status,200)};
   for(const action of ['update','attendee_update']){
    await prepare(action);let before=await state(),n=writes().length;await start();await page.evaluate(()=>pending);let after=await state();ok(writes().length===n+1,label+' '+action+' confirmed save exactly once');ok((await value(action)).notes==='Private local draft '+action,label+' '+action+' canonical notes saved');preservedHistory(before,after);assert.deepEqual(after.signatures,before.signatures);ok(after.auditRows.length===before.auditRows.length+(action==='update'?1:2),label+' '+action+' exact canonical audits and immutable legal history');
    await prepare(action);if(action==='update')await editor(action).getByLabel(/^Registration status/).selectOption('closed');else await editor(action).getByLabel('Age',{exact:true}).fill('-1');
    // Household status is a valid operation; use native checked_in rejection with no checked-in attendees.
    if(action==='update')await editor(action).getByLabel(/^Registration status/).selectOption('checked_in');before=await state();await start();await page.evaluate(()=>pending);assert.deepEqual(await state(),before);ok(true,label+' '+action+' canonical validation rolls back');ok(await field(action).inputValue()==='Private local draft '+action,label+' '+action+' validation preserves edits');
    if(!process.env.REPRO)ok((await page.getByRole('alert').textContent()).includes('Save rejected'),label+' '+action+' explicit rejection distinguished');
    for(const outcome of ['conflict','committed','not-committed','malformed']){
     await prepare(action);phase=action+' '+outcome;if(outcome==='conflict')await another(action);else fault={action,outcome};before=await state();n=writes().length;await start();await page.evaluate(()=>pending);after=await state();
     ok(writes().length===n+1,label+' '+action+'/'+outcome+' no automatic write retry');preservedHistory(before,after);assert.deepEqual(after.signatures,before.signatures);ok(after.auditRows.length===before.auditRows.length+(['committed','malformed'].includes(outcome)?(action==='update'?1:2):0),label+' '+action+'/'+outcome+' exact commit/audit behavior');
     const count=await page.getByRole('button',{name:'Inspect current record',exact:true}).count();console.log(JSON.stringify({engine,width,action,outcome,inspectionControls:count,message:await page.locator('[data-error]').allTextContents()}));if(process.env.REPRO){reproductions.push({engine,width,action,outcome,count});continue;}
     ok(count===1,label+' '+action+'/'+outcome+' offers separate read-only inspection');ok((await editor(action).innerText()).includes(outcome==='conflict'?'Save conflict':'Save outcome UNKNOWN'),label+' conflict/UNKNOWN accurately distinguished');ok(await field(action).inputValue()==='Private local draft '+action&&await field(action).isDisabled(),label+' private local draft retained read-only');
     await page.evaluate(()=>{editNode.append(editButton);return editHandler()});ok(writes().length===n+1,label+' retired save cannot resubmit even reinserted');
     await another(action);const afterOther=await state(),reads=calls.length;await page.getByRole('button',{name:'Inspect current record',exact:true}).click();await page.locator('[data-edit-current]').getByText('notes: Other authorized edit',{exact:true}).waitFor();
     assert.deepEqual(calls.slice(reads).map(p=>p.p_action),['context','detail']);ok(true,label+' fresh existing-authority reads only');ok(await field(action).inputValue()==='Private local draft '+action,label+' inspection does not overwrite local draft');ok((await page.locator('[data-edit-current]').innerText()).includes('does not prove which request'),label+' no inferred operation attribution');assert.deepEqual(await state(),afterOther);ok(true,label+' inspection creates no mutations/audits');
     await page.getByRole('button',{name:'Discard draft and open current record',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();ok(await field(action).inputValue()==='Other authorized edit',label+' explicit discard loads authoritative revision/values');ok(await page.evaluate(()=>draftField.value)==='',label+' retired draft input cleared');ok(writes().length===n+1,label+' explicit reopen never retries old payload');
    }
    if(process.env.REPRO){await prepare(action);await page.evaluate(()=>dispatchEvent(new Event('pagehide')));console.log(JSON.stringify({originalDraftRetirement:{engine,width,action,retainedValue:await page.evaluate(()=>draftField.value)}}));}
    if(!process.env.REPRO){
     const v=await value(action),raceBefore=await state(),payload={registration_id:full.id,...(action==='attendee_update'?{attendee_id:v.id}:{}),revision:v.revision};const raced=await Promise.all([execute(worker,action,{...payload,notes:'Fictional race one'}),execute(admin,action,{...payload,notes:'Fictional race two'})]);ok(raced.filter(x=>x.status===200).length===1&&raced.filter(x=>x.status===400&&x.error?.code==='P0001').length===1,label+' '+action+' simultaneous revision writers admit exactly one');const raceAfter=await state();ok(raceAfter.auditRows.length===raceBefore.auditRows.length+(action==='update'?1:2),label+' concurrent loser has no audit or partial write');preservedHistory(raceBefore,raceAfter);assert.deepEqual(raceAfter.signatures,raceBefore.signatures);
     for(const change of ['account','campaign','remove','pagehide']){
      await prepare(action);phase=action+' '+change;fault={action,outcome:'committed'};responseHold=action;submitted=false;n=writes().length;await start();for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);
      if(change==='account')await page.evaluate(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));dispatchEvent(new Event('focus'))},{key,value:session(other)});
      else if(change==='campaign')await page.evaluate(B=>{history.pushState({},'',location.pathname+'?campaign='+B);dispatchEvent(new PopStateEvent('popstate'))},B);
      else if(change==='remove')await page.evaluate(()=>{const p=editNode.parentNode;editNode.remove();p.append(editNode)});
      else await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
      release();await page.evaluate(()=>pending);if(['account','campaign'].includes(change)){if(process.env.DIAGNOSTIC)console.log(JSON.stringify({event:'before-denial-settled',phase,visible:await page.getByRole('link',{name:'Verify access again',exact:true}).isVisible()}));await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();ok(await page.locator('#staff-main').isHidden(),label+' '+change+' actual denial settled before next navigation')}await page.evaluate(()=>editHandler());ok(writes().length===n+1,label+' '+action+'/'+change+' submitted write not duplicated');ok(await page.evaluate(()=>draftField.value)==='',label+' '+action+'/'+change+' captured draft cleared');ok(await page.getByRole('button',{name:'Inspect current record',exact:true}).count()===0,label+' '+action+'/'+change+' no stale recovery publication');
     }
     await prepare(action);await another(action);await start();await page.evaluate(()=>pending);responseHold='detail';submitted=false;await page.getByRole('button',{name:'Inspect current record',exact:true}).evaluate(b=>{window.inspectButton=b;window.inspectHandler=b.onclick;window.readPending=inspectHandler()});for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);await page.evaluate(()=>{const p=inspectButton.parentNode;inspectButton.remove();p.append(inspectButton)});release();await page.evaluate(()=>readPending);ok(await page.locator('[data-edit-current]').textContent()==='',label+' retired inspection control cannot publish a late private record');const count=calls.length;await page.evaluate(()=>inspectHandler());ok(calls.length===count,label+' retired inspection cannot issue a new read');
     await prepare(action);await another(action);await start();await page.evaluate(()=>pending);await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);await page.getByRole('button',{name:'Inspect current record',exact:true}).click();await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();ok(await page.evaluate(()=>draftField.value)==='',label+' management revocation clears protected draft despite view access');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','registration.export','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);
     await prepare(action);before=await state();await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);await start();await page.evaluate(()=>pending);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();assert.deepEqual(await state(),before);ok(await page.evaluate(()=>draftField.value)==='',label+' explicit write permission denial clears draft, no write');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','registration.export','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);
    }
   }
   await open();ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' viewport remains responsive');assert.deepEqual(errors,[]);ok(true,label+' no runtime exceptions');await context.close();
   }
  }finally{await browser.close()}
 }
 if(process.env.REPRO){console.log(JSON.stringify({originalReproductions:reproductions}));assert(reproductions.every(x=>x.count===1),'Original conflicting/uncertain edits must offer safe read-only inspection')}
 console.log(JSON.stringify({status:'PASS',checks,actualStaffHost:true,nativePostgres:true,fictionalAuth:true,hosted:false}));
}finally{await db.close()}
