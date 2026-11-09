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

 let full,sequence=0;await db.exec('reset role');
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

   const fresh=async()=>{const name='Household'+(++sequence),ms=members.map(m=>({...m,client_key:uuid()}));const result=await execute(admin,'walkup',{request_key:uuid(),first_name:name,last_name:'Fixture',email:'fixture@example.test',phone:'+15555550100',attendees:ms,consents:{ministry_followup:false,communications:false,marketing:false,media:false},waiver:{request_key:uuid(),version_id:version,signer_name:'Morgan Fixture',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:ms.map(m=>m.client_key)}});assert.equal(result.status,200);const row=(await execute(worker,'list',{search:name})).data.registrations;assert.equal(row.length,1);full=(await execute(worker,'detail',{registration_id:row[0].id})).data;return name};
   const card=()=>page.locator('.registration-member').filter({has:page.getByRole('heading',{name:'Alex Fixture',exact:true})});
   const editor=()=>card().locator('details').filter({has:page.getByText('Update attendee',{exact:true})});
   const prepare=async()=>{phase='prepare';const name=await fresh();await open();await page.getByLabel('Name, phone, email or reference',{exact:true}).fill(name);await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('heading',{name:'Household lookup',exact:true}).waitFor();await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();await editor().locator('summary').click();await editor().getByLabel('Operational notes',{exact:true}).fill('Unsaved private draft');await editor().getByRole('button',{name:'Remove attendee',exact:true}).evaluate(b=>{window.editButton=b;window.editHandler=b.onclick;window.editNode=b.parentNode;window.draftField=editNode.querySelector('textarea')});};
   const start=()=>page.evaluate(()=>{window.pending=editHandler()});
   const writes=()=>calls.filter(p=>p.p_action==='attendee_update');
   const value=async()=> (await execute(worker,'detail',{registration_id:full.id})).data.attendees.find(a=>a.first_name==='Alex');
   const another=async()=>{const v=await value();const r=await execute(admin,'attendee_update',{registration_id:full.id,attendee_id:v.id,revision:v.revision,notes:'Concurrent authorized edit'});assert.equal(r.status,200)};
   const legal=(a,b)=>{assert.deepEqual(b.signatures,a.signatures);assert.deepEqual(b.corrections,a.corrections);preservedHistory(a,b);ok(true,label+' immutable signatures, coverage and historical audits preserved')};

   const addition=()=>page.locator('details').filter({has:page.getByText('Add household attendee',{exact:true})});
   const prepareAdd=async()=>{await prepare();await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();await addition().locator('summary').click();for(const[k,v]of [['First name','Late'],['Last name','Child'],['Age','8'],['Guardian relationship','Parent']])await addition().getByLabel(k,{exact:true}).fill(v);await addition().getByLabel(/^Relationship/).selectOption('child');await addition().locator('form').evaluate(f=>{window.addForm=f;window.addControl=f.querySelector('button[type=submit]');window.addHandler=f.onsubmit;window.addDraft=f.querySelector('input');window.invokeAdd=()=>addHandler({preventDefault(){}})});};
   const addWrites=()=>calls.filter(p=>p.p_action==='attendee_add');
   const submitAdd=()=>page.evaluate(()=>{window.addPending=invokeAdd()});
   for(const outcome of ['success','committed','not-committed','malformed','validation']){
    await prepareAdd();phase='addition '+outcome;const before=await state(),totals=(await execute(worker,'list')).data.summary,n=addWrites().length;
    if(['committed','not-committed','malformed'].includes(outcome))fault={action:'attendee_add',outcome};
    if(outcome==='validation')await addition().getByLabel('Guardian relationship',{exact:true}).fill('');
    await submitAdd();await page.evaluate(()=>addPending);const after=await state(),committed=['success','committed','malformed'].includes(outcome);ok(addWrites().length===n+1,label+' '+outcome+' exactly one request, no automatic retry');ok(after.attendees.length===before.attendees.length+(committed?1:0),label+' '+outcome+' exact creation count');legal(before,after);ok(after.auditRows.length===before.auditRows.length+(committed?1:0),label+' '+outcome+' exact addition audit');const currentTotals=(await execute(worker,'list')).data.summary;ok(currentTotals.attendees===totals.attendees+(committed?1:0)&&currentTotals.minors===totals.minors+(committed?1:0),label+' canonical totals accurate');
    if(outcome==='success'){const child=page.locator('.registration-member').filter({has:page.getByRole('heading',{name:'Late Child',exact:true})});ok(await child.getByRole('button',{name:'Check in attendee',exact:true}).isDisabled(),label+' new child requires separate waiver');continue}
    if(outcome==='validation'){ok((await page.getByRole('alert').textContent()).includes('addition rejected'),label+' definitive validation distinguished');ok(await addition().getByLabel('First name',{exact:true}).inputValue()==='Late'&&!await addition().getByLabel('First name',{exact:true}).isDisabled(),label+' rejected draft remains editable');continue}
    await page.getByRole('heading',{name:'Attendee creation outcome UNKNOWN',exact:true}).waitFor();ok(await addition().getByLabel('First name',{exact:true}).isDisabled(),label+' UNKNOWN draft read-only');ok((await addition().innerText()).includes('may already have been created'),label+' truthful uncertainty guidance');await page.evaluate(()=>{addForm.append(addControl);return invokeAdd()});ok(addWrites().length===n+1,label+' removed/reinserted submit permanently retired');
    const stable=await state(),reads=calls.length;await page.getByRole('button',{name:'Inspect current household roster',exact:true}).click();await page.locator('[data-edit-current]').getByText('Read-only current roster; not proof of the original request outcome.',{exact:true}).waitFor();assert.deepEqual(calls.slice(reads).map(x=>x.p_action),['context','detail']);assert.deepEqual(await state(),stable);ok(true,label+' inspection uses fresh scoped reads only');ok((await page.locator('[data-edit-current]').innerText()).includes('Late Child')===committed,label+' roster truthful without inferred causation');ok(await addition().getByLabel('First name',{exact:true}).inputValue()==='Late',label+' inspection preserves local draft');
    const payload=addWrites().at(-1).p_payload;
    if(committed){const nativeBefore=await state();ok((await execute(worker,'attendee_add',payload)).status===200,label+' same canonical key idempotent');assert.deepEqual(await state(),nativeBefore);ok((await execute(worker,'attendee_add',{...payload,first_name:'Conflict'})).status===400,label+' conflicting key rejected');assert.deepEqual(await state(),nativeBefore)}
   }
   await prepareAdd();let n=addWrites().length;responseHold='attendee_add';submitted=false;await submitAdd();for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);const payload=addWrites().at(-1).p_payload;const beforeReplay=await state();const same=await Promise.all([execute(worker,'attendee_add',payload),execute(admin,'attendee_add',payload)]);ok(same.every(x=>x.status===200)&&same[0].data.id===same[1].data.id,label+' concurrent same-key replay returns canonical identity');assert.deepEqual(await state(),beforeReplay);release();await page.evaluate(()=>addPending);
   const firstKey={...payload,client_key:uuid(),first_name:'Concurrent first'};const firstBefore=await state();const firstRace=await Promise.all([execute(worker,'attendee_add',firstKey),execute(admin,'attendee_add',firstKey)]);ok(firstRace.every(x=>x.status===200)&&firstRace[0].data.id===firstRace[1].data.id,label+' concurrent first creation with same key returns one canonical attendee');const firstAfter=await state();ok(firstAfter.attendees.length===firstBefore.attendees.length+1&&firstAfter.auditRows.length===firstBefore.auditRows.length+1,label+' same-key creation has exactly one row/audit');
   const beforeNew=await state();const distinct=await Promise.all([execute(worker,'attendee_add',{...payload,client_key:uuid(),first_name:'Second'}),execute(admin,'attendee_add',{...payload,client_key:uuid(),first_name:'Third'})]);ok(distinct.every(x=>x.status===200)&&distinct[0].data.id!==distinct[1].data.id,label+' distinct authorized concurrent additions kept distinct');ok((await state()).auditRows.length===beforeNew.auditRows.length+2,label+' one audit for each distinct addition');
   for(const change of ['account','campaign','remove','pagehide']){
    await prepareAdd();phase=change;fault={action:'attendee_add',outcome:'committed'};responseHold='attendee_add';submitted=false;n=addWrites().length;await submitAdd();for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);
    if(change==='account')await page.evaluate(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));dispatchEvent(new Event('focus'))},{key,value:session(other)});
    else if(change==='campaign')await page.evaluate(B=>{history.pushState({},'',location.pathname+'?campaign='+B);dispatchEvent(new PopStateEvent('popstate'))},B);
    else if(change==='remove')await page.evaluate(()=>{const p=addForm.parentNode;addForm.remove();p.append(addForm)});
    else await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
    release();await page.evaluate(()=>addPending);if(['account','campaign'].includes(change))await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();await page.evaluate(()=>invokeAdd());ok(addWrites().length===n+1,label+' '+change+' already-submitted creation not repeated');ok(await page.evaluate(()=>addDraft.value)==='',label+' '+change+' captured sensitive draft cleared');ok(await page.getByRole('button',{name:'Inspect current household roster',exact:true}).count()===0,label+' '+change+' stale response not published');
   }
   for(const stage of ['write','inspection']){
    await prepareAdd();if(stage==='inspection'){fault={action:'attendee_add',outcome:'not-committed'};await submitAdd();await page.evaluate(()=>addPending)}const before=await state();await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);if(stage==='write'){await submitAdd();await page.evaluate(()=>addPending)}else await page.getByRole('button',{name:'Inspect current household roster',exact:true}).click();await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();assert.deepEqual(await state(),before);ok(await page.evaluate(()=>addDraft.value)==='',label+' '+stage+' revocation clears private draft');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','registration.export','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);
   }
   await open();ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' responsive');assert.deepEqual(errors,[]);ok(true,label+' strict browser errors empty');await context.close();
   }
  }finally{await browser.close()}
 }
 console.log(JSON.stringify({status:'PASS',checks,actualStaffHost:true,nativePostgres:true,fictionalAuth:true,hosted:false}));
}finally{await db.close()}
